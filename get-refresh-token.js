// Script to get Google Drive refresh token
// Run: node get-refresh-token.js
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const { exec } = require('child_process');

const CREDS_FILE = 'client_secret_61802593959-1gveqfbjj32qp5qf921fgsj87f4nm02g.apps.googleusercontent.com.json';
const PORT       = 3001;
const REDIRECT   = `http://localhost:${PORT}`;
const SCOPE      = 'https://www.googleapis.com/auth/drive';

const { client_id, client_secret } = JSON.parse(fs.readFileSync(CREDS_FILE)).installed;

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

// Open browser
exec(`start "" "${authUrl}"`);
console.log('🌐 Đang mở trình duyệt để xác thực Google...');
console.log('Nếu trình duyệt không mở, truy cập link sau:\n' + authUrl + '\n');

// Local server to catch redirect with auth code
const server = http.createServer((req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  if (!code) { res.end('Waiting...'); return; }

  res.end('<h2 style="font-family:sans-serif;padding:40px">✅ Thành công! Quay lại terminal để xem kết quả.</h2>');
  server.close();

  // Exchange code for tokens
  const body = new URLSearchParams({ code, client_id, client_secret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }).toString();
  const req2 = https.request(
    { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
    (res2) => {
      let data = '';
      res2.on('data', c => data += c);
      res2.on('end', () => {
        const tokens = JSON.parse(data);
        if (!tokens.refresh_token) {
          console.error('❌ Không nhận được refresh_token. Thử revoke access rồi chạy lại:');
          console.error('   https://myaccount.google.com/permissions');
          return;
        }
        console.log('\n✅ XONG! Copy các dòng sau vào file .env:\n');
        console.log(`GOOGLE_CLIENT_ID=${client_id}`);
        console.log(`GOOGLE_CLIENT_SECRET=${client_secret}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`GOOGLE_DRIVE_FOLDER_ID=    <-- điền sau khi tạo folder trên Drive`);
        console.log('\n📁 Bước tiếp: Tạo folder trên Google Drive, copy ID từ URL rồi điền vào GOOGLE_DRIVE_FOLDER_ID');
      });
    }
  );
  req2.write(body);
  req2.end();
});

server.listen(PORT, () => console.log(`⏳ Đang chờ xác thực trên port ${PORT}...`));
