/**
 * image.route.js
 * Proxies images from Google Drive through our server.
 * GET /api/image/:fileId — streams the Drive file to the client.
 *
 * Optimizations:
 * - Reuse a single OAuth2 client (shared access token, not refreshed per request)
 * - Skip metadata call — stream directly with image/jpeg fallback
 */

const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

// Shared OAuth2 client — reused across all requests to avoid per-request token refresh
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth });

router.get('/:fileId', async (req, res) => {
  try {
    // Stream file content directly — skip metadata call to halve API requests
    const stream = await drive.files.get(
      { fileId: req.params.fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // cache 7 days
    stream.data.pipe(res);

  } catch (err) {
    console.error('[Image proxy] Error:', err.message);
    res.status(404).json({ error: 'Image not found' });
  }
});

module.exports = router;
