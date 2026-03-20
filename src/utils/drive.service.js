/**
 * drive.service.js
 * Google Drive helper: upload image, delete image, list music files.
 * Uses OAuth2 with refresh token — no user interaction required after setup.
 */

const { google } = require('googleapis');
const fs = require('fs');

const MIME_MAP = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

/**
 * Upload a local image file to Google Drive folder.
 * Sets the file as publicly readable so it can be embedded directly.
 * @returns {{ fileId: string, driveUrl: string }}
 */
async function uploadToDrive(filePath, filename, ext) {
  const drive    = google.drive({ version: 'v3', auth: getAuth() });
  const mimeType = MIME_MAP[ext] || 'image/jpeg';

  const { data } = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: 'id',
  });

  // Make the file accessible to anyone with the link
  await drive.permissions.create({
    fileId: data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    fileId:   data.id,
    driveUrl: `/api/image/${data.id}`,
  };
}

/**
 * Delete a file from Google Drive by file ID.
 */
async function deleteFromDrive(fileId) {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  await drive.files.delete({ fileId });
}

// Simple in-memory cache for music list (TTL: 5 minutes)
let musicCache = { tracks: null, fetchedAt: 0 };
const MUSIC_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * List all audio files in the music Drive folder.
 * Results are cached 5 minutes to avoid hitting the API on every page load.
 * @returns {Promise<Array<{ id: string, title: string }>>}
 */
async function listMusicFiles() {
  const now = Date.now();
  if (musicCache.tracks && now - musicCache.fetchedAt < MUSIC_CACHE_TTL) {
    return musicCache.tracks;
  }

  const drive    = google.drive({ version: 'v3', auth: getAuth() });
  const folderId = process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID;

  const { data } = await drive.files.list({
    q:       `'${folderId}' in parents and (mimeType contains 'audio/' or mimeType = 'video/mp4') and trashed = false`,
    fields:  'files(id, name)',
    orderBy: 'name',
    pageSize: 100,
  });

  const tracks = (data.files || []).map((f) => ({
    id:    f.id,
    title: f.name.replace(/\.[^.]+$/, ''), // strip extension for display
  }));

  musicCache = { tracks, fetchedAt: now };
  return tracks;
}

/**
 * List all image files in the photo Drive folder (GOOGLE_DRIVE_FOLDER_ID).
 * Filters out files already tracked in metadata (by driveFileId).
 * @param {Set<string>} knownFileIds - set of driveFileIds already in metadata
 * @returns {Promise<Array<{ id, name, createdTime }>>}
 */
async function listNewImageFiles(knownFileIds) {
  const drive    = google.drive({ version: 'v3', auth: getAuth() });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const { data } = await drive.files.list({
    q:        `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields:   'files(id, name, createdTime)',
    orderBy:  'createdTime desc',
    pageSize: 1000,
  });

  return (data.files || []).filter((f) => !knownFileIds.has(f.id));
}

/**
 * Make an existing Drive file publicly readable (reader, anyone).
 */
async function makePublic(fileId) {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
}

module.exports = { uploadToDrive, deleteFromDrive, listMusicFiles, listNewImageFiles, makePublic };
