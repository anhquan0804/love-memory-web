/**
 * metadata.store.js
 * Lightweight JSON-file store for per-image metadata (date, original name).
 * Stored at uploads/metadata.json as: { "filename": { date, originalName } }
 */

const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const STORE_PATH = path.resolve(uploadDir, 'metadata.json');

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Save metadata entry for a single image file.
 * @param {string} filename - saved filename on disk
 * @param {{ date: string, originalName: string }} meta
 */
function saveImageMeta(filename, meta) {
  const store = readStore();
  store[filename] = meta;
  writeStore(store);
}

/**
 * Get metadata for a single image.
 * @param {string} filename
 * @returns {{ date: string, originalName: string } | null}
 */
function getImageMeta(filename) {
  const store = readStore();
  return store[filename] || null;
}

/**
 * Get all metadata as a plain object.
 */
function getAllMeta() {
  return readStore();
}

/**
 * Remove metadata entry for a deleted image.
 * @param {string} filename
 */
function deleteImageMeta(filename) {
  const store = readStore();
  delete store[filename];
  writeStore(store);
}

module.exports = { saveImageMeta, getImageMeta, getAllMeta, deleteImageMeta };
