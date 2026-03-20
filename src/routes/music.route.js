/**
 * music.route.js
 * GET /api/music         — list tracks from Google Drive music folder
 * GET /api/music/:fileId — stream audio file from Google Drive
 */

const express = require('express');
const { google } = require('googleapis');
const { listMusicFiles } = require('../utils/drive.service');

const router = express.Router();

// Shared OAuth2 client (reused to avoid per-request token refresh)
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth });

// GET /api/music — returns shuffled track list
router.get('/', async (_req, res) => {
  try {
    const tracks = await listMusicFiles();
    // Shuffle on each request so playlist order varies per session
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    res.json({ tracks: shuffled });
  } catch (err) {
    console.error('[Music] Failed to list tracks:', err.message);
    res.status(500).json({ error: 'Không thể tải danh sách nhạc.' });
  }
});

// GET /api/music/:fileId — stream audio from Drive with range support
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const rangeHeader = req.headers.range;

    // Fetch file metadata to get size and mime type
    const { data: meta } = await drive.files.get({
      fileId,
      fields: 'size, mimeType, name',
    });

    const fileSize = parseInt(meta.size, 10);
    const mimeType = meta.mimeType || 'audio/mpeg';

    if (rangeHeader) {
      // Partial content for seek support
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunk = end - start + 1;

      const stream = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
      );

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk,
        'Content-Type':   mimeType,
        'Cache-Control':  'public, max-age=3600',
      });
      stream.data.pipe(res);
    } else {
      const stream = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
        'Cache-Control':  'public, max-age=3600',
      });
      stream.data.pipe(res);
    }
  } catch (err) {
    console.error('[Music stream] Error:', err.message);
    res.status(404).json({ error: 'Không tìm thấy bài nhạc.' });
  }
});

module.exports = router;
