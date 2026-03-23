/**
 * metadata.store.js
 * Lightweight JSON-file store for per-image metadata (date, original name).
 * Stored at uploads/metadata.json as: { "filename": { date, originalName } }
 *
 * In-memory cache: reads file once, invalidates on every write.
 * Avoids disk I/O on every GET /api/gallery request.
 */

const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const STORE_PATH = path.resolve(uploadDir, 'metadata.json');

// In-memory cache — null means cache is cold (needs a read)
let cache = null;

function readStore() {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
  return cache;
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  cache = data; // update cache in place — no need to re-read
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
  return readStore()[filename] || null;
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

/**
 * Merge additional fields into an existing metadata entry.
 * No-op if the filename is not in the store.
 * @param {string} filename
 * @param {object} fields - e.g. { favorite: true } or { caption: 'text' }
 */
function updateImageMeta(filename, fields) {
  const store = readStore();
  if (!store[filename]) return;
  Object.assign(store[filename], fields);
  writeStore(store);
}

module.exports = { saveImageMeta, getImageMeta, getAllMeta, deleteImageMeta, updateImageMeta };
