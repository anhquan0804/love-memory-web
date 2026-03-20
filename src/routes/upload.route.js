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
  upload.array('images', 10)(req, res, async (multerErr) => {
    // Multer-level errors
    if (multerErr instanceof multer.MulterError) {
      if (multerErr.code === 'LIMIT_FILE_SIZE')  return res.status(400).json({ error: 'File quá nặng. Tối đa 25MB mỗi ảnh.' });
      if (multerErr.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Quá nhiều file. Tối đa 10 ảnh mỗi lần.' });
      return res.status(400).json({ error: multerErr.message });
    }
    if (multerErr) return res.status(400).json({ error: multerErr.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Không có file nào được tải lên.' });

    try {
      // Process files in batches of 2 to limit Sharp memory usage on 256MB RAM
      const CONCURRENCY = 2;
      const processed = [];
      for (let i = 0; i < req.files.length; i += CONCURRENCY) {
        const batch = req.files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (file) => {
            const date  = await extractImageDate(file.path);
            const proc  = await processImage(file);
            saveImageMeta(proc.filename, { date, originalName: file.originalname });
            return { file, proc, date };
          })
        );
        processed.push(...results);
      }

      // Respond immediately — Drive upload happens in background
      res.status(201).json({
        message: `Upload thành công ${processed.length} ảnh.`,
        files: processed.map(({ proc, date, file }) => ({
          filename: proc.filename,
          url:      `/uploads/${proc.filename}`,
          date,
          size:     file.size,
        })),
      });

      // Background: upload to Google Drive after response is sent
      for (const { proc } of processed) {
        uploadToDrive(proc.filePath, proc.filename, proc.ext)
          .then(({ fileId, driveUrl }) => {
            const meta = require('../utils/metadata.store').getAllMeta();
            if (meta[proc.filename]) {
              saveImageMeta(proc.filename, { ...meta[proc.filename], driveFileId: fileId, driveUrl });
            }
            if (fs.existsSync(proc.filePath)) fs.unlinkSync(proc.filePath);
          })
          .catch((driveErr) => {
            console.error('[Drive] Background upload failed for', proc.filename, ':', driveErr.message);
          });
      }
    } catch (err) {
      console.error('[Upload] Processing error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Lỗi xử lý ảnh. Vui lòng thử lại.' });
      }
    }
  });
});

module.exports = router;
