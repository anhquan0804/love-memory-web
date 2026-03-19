/**
 * migrate-to-drive.js
 * One-time script: uploads all existing local images to Google Drive,
 * updates metadata.json with driveFileId + driveUrl, then deletes local files.
 *
 * Run: node migrate-to-drive.js
 * Safe to re-run — skips images already uploaded (has driveFileId in metadata).
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { uploadToDrive }  = require('./src/utils/drive.service');
const { getAllMeta, saveImageMeta } = require('./src/utils/metadata.store');

const UPLOAD_DIR        = path.resolve(process.env.UPLOAD_DIR || './uploads');
const SUPPORTED_EXT     = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

async function migrate() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log('Không tìm thấy thư mục uploads/. Không có gì để migrate.');
    return;
  }

  const files    = fs.readdirSync(UPLOAD_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXT.includes(ext);
  });

  if (files.length === 0) {
    console.log('Không có ảnh nào trong uploads/ để migrate.');
    return;
  }

  const metadata = getAllMeta();
  const toUpload = files.filter((f) => !metadata[f]?.driveFileId);

  console.log(`Tìm thấy ${files.length} ảnh — ${toUpload.length} chưa có trên Drive.\n`);

  if (toUpload.length === 0) {
    console.log('Tất cả ảnh đã được sync lên Drive rồi!');
    return;
  }

  let success = 0;
  let failed  = 0;

  for (const filename of toUpload) {
    const filePath = path.join(UPLOAD_DIR, filename);
    const ext      = path.extname(filename).toLowerCase();
    const existing = metadata[filename] || {};

    process.stdout.write(`Uploading ${filename}... `);
    try {
      const { fileId, driveUrl } = await uploadToDrive(filePath, filename, ext);

      saveImageMeta(filename, {
        ...existing,
        driveFileId: fileId,
        driveUrl,
      });

      // Delete local file after successful upload
      fs.unlinkSync(filePath);

      console.log(`✅ Done (${fileId.slice(0, 8)}...)`);
      success++;
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Thành công: ${success} ảnh`);
  if (failed > 0) console.log(`❌ Thất bại: ${failed} ảnh (file local vẫn còn)`);
  console.log('\nDone! Kiểm tra folder LoveMemory trên Google Drive nhé.');
}

migrate().catch((err) => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
