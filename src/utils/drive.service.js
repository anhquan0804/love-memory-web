/**
 * drive.service.js
 * Google Drive helper: upload image, delete image.
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

module.exports = { uploadToDrive, deleteFromDrive };
