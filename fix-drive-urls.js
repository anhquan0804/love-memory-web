/**
 * fix-drive-urls.js
 * Updates all driveUrls in metadata.json from uc?export=view to thumbnail format.
 * Run: node fix-drive-urls.js
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const STORE_PATH = path.resolve('./uploads/metadata.json');
const metadata   = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

let updated = 0;

for (const [filename, meta] of Object.entries(metadata)) {
  if (meta.driveFileId) {
    metadata[filename].driveUrl = `/api/image/${meta.driveFileId}`;
    updated++;
  }
}

fs.writeFileSync(STORE_PATH, JSON.stringify(metadata, null, 2), 'utf8');
console.log(`✅ Updated ${updated} URLs in metadata.json`);
