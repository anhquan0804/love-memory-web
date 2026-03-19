# Love Memory Web — Hướng dẫn Deploy & Phát triển

## Tổng quan

Web kỷ niệm tình yêu cá nhân (Quân & Lành), chạy trên **Fly.io** với ảnh lưu trên **Google Drive**.

- **Production URL:** https://lovememory-quanlanh.fly.dev
- **Stack:** Node.js + Express, Google Drive API, Fly.io
- **Ảnh:** 43 ảnh trên Google Drive, proxy qua `/api/image/:fileId`
- **Metadata:** `uploads/metadata.json` trên Fly.io volume (`uploads_data`)

---

## Yêu cầu trên máy mới

### 1. Cài đặt

```bash
# Node.js 18+
node -v

# flyctl CLI
# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
# Mac/Linux
curl -L https://fly.io/install.sh | sh

# Đăng nhập Fly.io
flyctl auth login
```

### 2. Clone & cài dependencies

```bash
git clone <repo-url>
cd VibeCode
npm install
```

### 3. Tạo file `.env` (không commit, chứa secrets)

```env
PORT=3000
UPLOAD_DIR=./uploads

# Tên 2 người hiển thị trên web
NAME_1=Quân
NAME_2=Lành

# Google Drive API (lấy từ Fly.io secrets hoặc hỏi Quân)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=1PoFLfMoCttS2OOiE6WninEPcilGHsXCu
```

> Nếu không có credentials, xem mục "Lấy lại Google credentials" bên dưới.

---

## Chạy local (development)

```bash
npm start
# Server tại http://localhost:3000
```

Lưu ý: Khi chạy local, ảnh sẽ proxy qua `localhost:3000/api/image/:fileId` → cần `.env` có Google credentials.

---

## Deploy lên Fly.io

### Deploy code mới

```bash
flyctl deploy -a lovememory-quanlanh
```

### Xem logs

```bash
flyctl logs -a lovememory-quanlanh
```

### Xem trạng thái app

```bash
flyctl status -a lovememory-quanlanh
```

### SSH vào VM

```bash
flyctl ssh console -a lovememory-quanlanh
```

---

## Quản lý secrets trên Fly.io

### Xem danh sách secrets (không thấy giá trị)

```bash
flyctl secrets list -a lovememory-quanlanh
```

### Set/update secrets

```bash
# Windows PowerShell — set UTF-8 trước để không mất dấu tiếng Việt
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:OutputEncoding = [System.Text.Encoding]::UTF8

flyctl secrets set NAME_1="Quân" NAME_2="Lành" -a lovememory-quanlanh
flyctl secrets set GOOGLE_CLIENT_ID="..." -a lovememory-quanlanh
flyctl secrets set GOOGLE_CLIENT_SECRET="..." -a lovememory-quanlanh
flyctl secrets set GOOGLE_REFRESH_TOKEN="..." -a lovememory-quanlanh
flyctl secrets set GOOGLE_DRIVE_FOLDER_ID="1PoFLfMoCttS2OOiE6WninEPcilGHsXCu" -a lovememory-quanlanh
```

---

## Quản lý metadata.json trên Fly.io volume

metadata.json chứa thông tin 43 ảnh (fileId trên Drive, ngày chụp, tên gốc).

### Upload metadata.json lên VM (Windows — dùng Git Bash)

```bash
export PATH="$PATH:/c/Users/<username>/.fly/bin"

# QUAN TRỌNG: dùng MSYS_NO_PATHCONV=1 để tránh path bị convert
MSYS_NO_PATHCONV=1 flyctl ssh sftp put --app lovememory-quanlanh \
  "d:\\VibeCode\\uploads\\metadata.json" \
  "/app/uploads/metadata.json"
```

### Download metadata.json từ VM về máy

```bash
MSYS_NO_PATHCONV=1 flyctl ssh sftp get --app lovememory-quanlanh \
  "/app/uploads/metadata.json" \
  "uploads/metadata.json"
```

### Xóa file trên VM

```bash
MSYS_NO_PATHCONV=1 flyctl ssh console --command "rm /app/uploads/metadata.json" \
  -a lovememory-quanlanh
```

---

## Lấy lại Google Drive credentials (nếu cần)

### Bước 1: Google Cloud Console
1. Vào https://console.cloud.google.com → Project: **Love Memory** (hoặc tên project đã tạo)
2. APIs & Services → Credentials
3. Tải OAuth 2.0 Client ID xuống dạng JSON → lưu vào thư mục project

### Bước 2: Lấy refresh token

```bash
node get-refresh-token.js
# Mở link hiện ra trong browser, đăng nhập Google, copy code
# Paste vào terminal → sẽ in ra GOOGLE_REFRESH_TOKEN
```

---

## Thêm ảnh mới

### Qua web (production)
Vào https://lovememory-quanlanh.fly.dev → kéo thả ảnh vào phần upload

### Migrate ảnh từ máy local lên Drive (nếu cần)
```bash
# Đặt ảnh vào uploads/ rồi chạy
node migrate-to-drive.js
# Sau đó upload metadata.json mới lên VM (xem phần trên)
```

---

## Cấu trúc dự án

```
VibeCode/
├── server.js                   # Entry point Express
├── fly.toml                    # Config Fly.io
├── Dockerfile                  # node:18-slim (dùng slim vì sharp cần glibc)
├── docker-compose.yml          # Local Docker (optional)
├── package.json
│
├── src/
│   ├── config/
│   │   └── multer.config.js    # Upload config: JPEG/PNG/WEBP/GIF/HEIC, 25MB
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── upload.route.js     # POST /api/upload → sharp → Google Drive
│   │   ├── gallery.route.js    # GET/DELETE /api/gallery
│   │   ├── image.route.js      # GET /api/image/:fileId (proxy Drive → client)
│   │   └── config.route.js     # GET /api/config (trả NAME_1, NAME_2)
│   └── utils/
│       ├── drive.service.js    # uploadToDrive, deleteFromDrive
│       └── metadata.store.js   # read/write uploads/metadata.json
│
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── gallery.js          # Gallery, lightbox, delete, animations
│       ├── upload.js           # Drag & drop upload
│       └── music.js            # Background music toggle
│
└── uploads/                    # Local (gitignored), trên Fly.io là volume mount
    └── metadata.json           # Source of truth cho 43 ảnh
```

---

## Scripts tiện ích

| File | Dùng để |
|---|---|
| `start-tunnel.js` | Chạy Cloudflare tunnel + gửi URL qua Telegram |
| `start-tunnel.bat` | Chạy server + tunnel (Windows double-click) |
| `restart.bat` | Kill node processes và restart |
| `migrate-to-drive.js` | Upload ảnh local lên Google Drive |
| `fix-drive-urls.js` | Đổi driveUrl sang `/api/image/:fileId` format |
| `get-refresh-token.js` | Lấy OAuth2 refresh token lần đầu |

---

## Ghi chú kỹ thuật

- **Dockerfile:** Dùng `node:18-slim` (Debian), KHÔNG dùng `node:18-alpine` vì sharp cần glibc
- **Image proxy:** Ảnh được stream từ Google Drive qua `/api/image/:fileId` để tránh CORS và Google's redirect issues. OAuth client được tạo 1 lần dùng chung (không tạo mới mỗi request)
- **HEIC:** Tự động convert sang JPEG khi upload
- **Windows + SFTP:** Luôn dùng `MSYS_NO_PATHCONV=1` khi upload file lên Fly.io để tránh path bị Git Bash convert sai
- **Tiếng Việt + PowerShell:** Set `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` trước khi set secrets có dấu
