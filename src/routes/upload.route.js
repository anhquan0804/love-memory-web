const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const upload  = require('../config/multer.config');
const { saveImageMeta }              = require('../utils/metadata.store');
const { uploadToDrive }              = require('../utils/drive.service');

const router = express.Router();

// exifr uses ESM by default; require the CJS build explicitly
let exifr;
try { exifr = require('exifr'); } catch { exifr = null; }

/**
 * Extract capture date from EXIF metadata.
 * Falls back to current time if unavailable.
 * @param {string} filePath
 * @returns {Promise<string>} ISO date string
 */
async function extractImageDate(filePath) {
  if (!exifr) return new Date().toISOString();
  try {
    const data = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate', 'DateTime']);
    if (data) {
      const raw = data.DateTimeOriginal || data.CreateDate || data.DateTime;
      if (raw instanceof Date && !isNaN(raw)) return raw.toISOString();
    }
  } catch { /* EXIF unreadable — use upload time */ }
  return new Date().toISOString();
}

/**
 * Resize and compress an uploaded image using sharp.
 * HEIC/HEIF files are converted to JPEG.
 * GIF files are left untouched.
 */
async function processImage(file) {
  const ext    = path.extname(file.filename).toLowerCase();
  const isHeic = ext === '.heic' || ext === '.heif';
  const isGif  = ext === '.gif';

  if (isGif) return { filename: file.filename, filePath: file.path, ext };

  const resizeOptions = { width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true };

  try {
    const instance = sharp(file.path).rotate();

    if (isHeic) {
      const newFilename = file.filename.replace(/\.(heic|heif)$/i, '.jpg');
      const newPath     = path.join(path.dirname(file.path), newFilename);
      await instance.resize(resizeOptions).jpeg({ quality: 85, progressive: true }).toFile(newPath);
      fs.unlinkSync(file.path);
      return { filename: newFilename, filePath: newPath, ext: '.jpg' };
    }

    const tmpPath  = file.path + '.tmp';
    const pipeline = instance.resize(resizeOptions);

    if (ext === '.jpg' || ext === '.jpeg') {
      await pipeline.jpeg({ quality: 85, progressive: true }).toFile(tmpPath);
    } else if (ext === '.png') {
      await pipeline.png({ compressionLevel: 8 }).toFile(tmpPath);
    } else if (ext === '.webp') {
      await pipeline.webp({ quality: 85 }).toFile(tmpPath);
    } else {
      await pipeline.toFile(tmpPath);
    }

    fs.unlinkSync(file.path);
    fs.renameSync(tmpPath, file.path);
    return { filename: file.filename, filePath: file.path, ext };

  } catch (err) {
    console.error('[Sharp] Processing failed for', file.filename, ':', err.message);
    return { filename: file.filename, filePath: file.path, ext };
  }
}

// POST /api/upload
router.post('/', (req, res, _next) => {
  upload.array('images', 10)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')  return res.status(400).json({ error: 'File quá nặng. Tối đa 25MB mỗi ảnh.' });
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Quá nhiều file. Tối đa 10 ảnh mỗi lần.' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Không có file nào được tải lên.' });

    // Process files in batches of 2 to limit Sharp memory usage on 256MB RAM
    const CONCURRENCY = 2;
    const uploaded = [];
    for (let i = 0; i < req.files.length; i += CONCURRENCY) {
      const batch = req.files.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const date      = await extractImageDate(file.path);
          const processed = await processImage(file);

          // Upload to Google Drive
          let driveFileId  = null;
          let driveUrl     = null;
          let driveSuccess = true;
          try {
            const result = await uploadToDrive(processed.filePath, processed.filename, processed.ext);
            driveFileId  = result.fileId;
            driveUrl     = result.driveUrl;

            // Delete local file after successful Drive upload
            if (fs.existsSync(processed.filePath)) fs.unlinkSync(processed.filePath);
          } catch (driveErr) {
            // Drive upload failed — keep local file as fallback
            driveSuccess = false;
            console.error('[Drive] Upload failed for', processed.filename, ':', driveErr.message);
          }

          saveImageMeta(processed.filename, {
            date,
            originalName: file.originalname,
            ...(driveFileId && { driveFileId, driveUrl }),
          });

          return {
            filename:     processed.filename,
            url:          driveUrl || `/uploads/${processed.filename}`,
            date,
            size:         file.size,
            driveSuccess,
          };
        })
      );
      uploaded.push(...batchResults);
    }

    const driveFailures = uploaded.filter((f) => !f.driveSuccess).length;
    const message = driveFailures > 0
      ? `Upload thành công ${uploaded.length} ảnh, nhưng ${driveFailures} ảnh không lưu được lên Drive (giữ local).`
      : `Upload thành công ${uploaded.length} ảnh.`;

    res.status(201).json({ message, files: uploaded });
  });
});

module.exports = router;
