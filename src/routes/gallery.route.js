const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { getAllMeta, getImageMeta, deleteImageMeta } = require('../utils/metadata.store');
const { deleteFromDrive } = require('../utils/drive.service');

const router = express.Router();

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];

// GET /api/gallery
// Returns all images sorted by date (newest first).
// Prefers Drive URL for cloud-stored images; falls back to local /uploads for old images.
// Supports ETag — returns 304 Not Modified when data has not changed.
router.get('/', (req, res) => {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const metadata  = getAllMeta();

  // Build list from metadata (source of truth for Drive-uploaded images)
  const metaImages = Object.entries(metadata).map(([filename, meta]) => ({
    filename,
    url:          meta.driveUrl || `/uploads/${filename}`,
    date:         meta.date || null,
    originalName: meta.originalName || filename,
  }));

  // Also scan local uploads folder for any files not yet in metadata
  let localOnlyImages = [];
  try {
    const files        = fs.readdirSync(uploadDir);
    const inMetadata   = new Set(Object.keys(metadata));
    localOnlyImages    = files
      .filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()) && !inMetadata.has(f))
      .map((f) => ({ filename: f, url: `/uploads/${f}`, date: null, originalName: f }));
  } catch { /* uploadDir may not exist on cloud hosting */ }

  const images = [...metaImages, ...localOnlyImages].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  // ETag based on image count + filenames — browser gets 304 when nothing changed
  const etag = crypto
    .createHash('md5')
    .update(images.map((i) => i.filename).join(','))
    .digest('hex');

  res.setHeader('ETag', `"${etag}"`);
  res.setHeader('Cache-Control', 'private, no-cache');

  if (req.headers['if-none-match'] === `"${etag}"`) {
    return res.status(304).end();
  }

  res.json({ images });
});

// DELETE /api/gallery/:filename
// Deletes from Google Drive (if applicable) and local disk, then removes metadata.
router.delete('/:filename', async (req, res, next) => {
  const safeName = path.basename(req.params.filename);

  if (safeName === 'metadata.json') {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  const meta = getImageMeta(safeName);

  // Delete from Google Drive if the image was uploaded there
  if (meta && meta.driveFileId) {
    try {
      await deleteFromDrive(meta.driveFileId);
    } catch (err) {
      console.error('[Drive] Delete failed for', safeName, ':', err.message);
      // Continue anyway — remove metadata even if Drive delete fails
    }
  }

  // Delete local file if it still exists
  const filePath = path.join(path.resolve(process.env.UPLOAD_DIR || './uploads'), safeName);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  deleteImageMeta(safeName);
  res.json({ message: 'Deleted.' });
});

module.exports = router;
