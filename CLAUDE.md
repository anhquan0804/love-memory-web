# CLAUDE.md — Love Memory Web

Tài liệu này tổng hợp toàn bộ context của dự án để Claude có thể tiếp tục làm việc ở bất kỳ máy nào.

---

## 1. Tổng quan dự án

**Tên:** Love Memory Web
**Mục tiêu:** Trang web kỷ niệm tình yêu cá nhân, hiện đang chạy trên PC nhà (localhost:3000), expose ra ngoài qua Cloudflare Tunnel.
**Chủ sở hữu:** Anh Quân — credit xuất hiện ở footer web.
**Cặp đôi:** Quân & Lành (cấu hình trong `.env`, không hardcode).

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Backend | Node.js + Express v5 |
| Upload | Multer v2 |
| Image processing | Sharp (resize max 2048px, 85% quality, auto-rotate EXIF) |
| EXIF metadata | exifr |
| Frontend | HTML/CSS/JS thuần — không dùng framework |
| Container | Docker + docker-compose |
| Metadata store | `uploads/metadata.json` (JSON file đơn giản, không dùng DB) |

---

## 3. Cấu trúc thư mục

```
d:/VibeCode/
├── server.js                   # Express app entry point
├── .env                        # PORT, UPLOAD_DIR, NAME_1, NAME_2
├── Dockerfile                  # node:18-slim (Debian, dùng slim thay vì alpine vì sharp cần glibc)
├── docker-compose.yml          # mount ./uploads làm volume
├── .dockerignore               # loại trừ node_modules, uploads, .env
├── .gitignore                  # loại trừ node_modules, uploads, .env
├── package.json
│
├── src/
│   ├── config/
│   │   └── multer.config.js    # storage, fileFilter (JPEG/PNG/WEBP/GIF/HEIC), limit 25MB/file, 10 files
│   ├── middleware/
│   │   └── errorHandler.js     # global Express error handler
│   ├── routes/
│   │   ├── upload.route.js     # POST /api/upload — multer + sharp compress + EXIF extract + metadata save
│   │   ├── gallery.route.js    # GET /api/gallery + DELETE /api/gallery/:filename
│   │   └── config.route.js     # GET /api/config — trả NAME_1, NAME_2 từ .env
│   └── utils/
│       └── metadata.store.js   # read/write uploads/metadata.json (saveImageMeta, getAllMeta, deleteImageMeta)
│
├── public/
│   ├── index.html              # SPA — 3 pages: home, memory, upload
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── gallery.js          # page nav, gallery render, lightbox, delete
│       └── upload.js           # drag & drop upload, preview
│
└── uploads/                    # ảnh lưu local (mount ra host trong Docker)
    └── metadata.json           # { filename: { date, originalName } }
```

---

## 4. Quy tắc lập trình (Coding Rules)

- **Comment trong code:** Tiếng Anh
- **Giải thích cho user:** Tiếng Việt
- **Modular:** Mỗi concern ở file riêng (route, config, util)
- **Error handling:** Tất cả upload errors đều được catch và trả JSON rõ ràng
- **Tên biến/hàm:** Tường minh (`uploadImage`, không dùng `upImg`)
- **Không dùng framework frontend** — giữ nhẹ và nhanh
- **Không dùng database** — metadata.json đủ dùng cho scale hiện tại

---

## 5. Tính năng đã implement

### Backend
- `POST /api/upload` — nhận tối đa 10 file/lần, tối đa 25MB/file
  - Chấp nhận: JPEG, PNG, WEBP, GIF, HEIC/HEIF
  - HEIC tự động convert sang JPEG
  - Sharp resize max 2048px, compress 85% (GIF bỏ qua)
  - Auto-rotate ảnh theo EXIF orientation (quan trọng cho ảnh iPhone)
  - Extract EXIF date (DateTimeOriginal) — fallback về upload time nếu không có
  - Lưu metadata vào `metadata.json`
- `GET /api/gallery` — trả danh sách ảnh + metadata, sort theo date mới nhất
- `DELETE /api/gallery/:filename` — xóa file khỏi disk + xóa khỏi metadata.json
- `GET /api/config` — trả `{ name1, name2 }` từ `.env`

### Frontend — SPA với 3 pages

**Trang chủ (page-home):**
- Hero: tên 2 người (load từ `/api/config`, không hardcode)
- Section Kỷ niệm: 5 ảnh random từ gallery + nút refresh để pick 5 ảnh khác
- Section Thêm ảnh: drag & drop upload, preview thumbnails trước khi upload
- Section Thư viện ảnh: 2 mode — Đầy đủ (masonry grid) và Timeline (nhóm theo tháng)

**Trang Kỷ niệm (page-memory):**
- 15-20 ảnh random từ gallery + nút reload để chọn lại

**Trang Thêm ảnh (page-upload):**
- Upload form + gallery bên dưới hiển thị tất cả ảnh đã lưu

**Navigation:**
- Hamburger button (fixed top-right) → side drawer
- Footer links ở mỗi page
- Tên 2 người trong nav drawer và hero được inject bằng JS

### Lightbox
- Click ảnh bất kỳ → mở fullscreen
- Nút prev/next để duyệt qua các ảnh
- Swipe trái/phải trên mobile
- Keyboard: ← → để navigate, Escape để đóng
- Nút download ảnh gốc về máy
- Click ngoài ảnh để đóng

### Xóa ảnh
- Desktop: hover vào ảnh → hiện icon thùng rác góc phải trên → click để xóa
- Mobile: long-press 700ms → confirm xóa
- Confirm dialog trước khi xóa
- Sau khi xóa: tự động refresh toàn bộ gallery

---

## 6. Cấu hình .env

```env
PORT=3000
UPLOAD_DIR=./uploads

# Couple names displayed on the website
NAME_1=Quân
NAME_2=Lành
```

**Khi thêm Google Drive (Phase 2), .env sẽ có thêm:**
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

---

## 7. Docker

```bash
# Chạy lần đầu hoặc sau khi sửa code
docker compose up --build -d

# Chỉ restart không build lại
docker compose up -d

# Xem log
docker compose logs -f

# Dừng
docker compose down
```

**Lưu ý quan trọng:**
- Dùng `node:18-slim` (Debian) thay vì `node:18-alpine` vì Sharp cần glibc
- Thư mục `uploads/` được mount ra host → ảnh không mất khi rebuild container
- `.env` không copy vào image, được đọc qua `env_file` trong docker-compose
- Container tự restart khi PC khởi động lại (`restart: unless-stopped`)

---

## 8. Expose ra ngoài (Cloudflare Tunnel)

Hiện tại dùng Quick Tunnel (link tạm thời, mỗi lần restart sẽ đổi link):
```bash
cloudflared tunnel --url http://localhost:3000
```
Trả về link dạng `https://random-name.trycloudflare.com`

---

## 9. Roadmap & Kế hoạch

### Phase 1 — Hiện tại (localhost + Cloudflare Tunnel) ✅
- Web chạy trên PC nhà
- Ảnh lưu ở `D:\VibeCode\uploads\`
- Expose tạm thời qua Cloudflare Quick Tunnel

### Phase 2 — Planned (chưa implement)

**Google Drive integration:**
- Khi upload ảnh → tự động đẩy lên một folder Google Drive chỉ định
- Gallery load ảnh từ Google Drive link (không cần disk)
- Cần từ user: `client_id`, `client_secret`, `refresh_token`, `folder_id`
- Cần install thêm: `googleapis` npm package
- Tôi (Claude) đã viết script để lấy refresh token — chờ user cung cấp credentials

**Cloud hosting (Fly.io):**
- Đăng ký Fly.io bằng GitHub (không cần thẻ để bắt đầu)
- Deploy Docker container lên Fly.io (free tier)
- Disk cloud chỉ chứa container (~2GB), ảnh thật lưu trên Google Drive
- Mục tiêu: web sống 24/7 ngay cả khi PC nhà tắt

### Phase 3 — Ideas (chưa quyết định)
- Caption cho ảnh khi upload
- Nhạc nền toggle
- Ngày kỷ niệm realtime counter
- Tìm kiếm/filter ảnh theo tháng

---

## 10. Dependencies hiện tại

```json
{
  "cors": "^2.8.6",
  "dotenv": "^17.3.1",
  "exifr": "^7.1.3",
  "express": "^5.2.1",
  "multer": "^2.1.1",
  "sharp": "^0.34.5"
}
```

**Sẽ thêm ở Phase 2:**
```
googleapis  — Google Drive API
```

---

## 11. Lưu ý khi làm việc tiếp

- Mỗi khi thêm npm package mới → `docker compose up --build` để rebuild image
- `metadata.json` là source of truth cho date và originalName của ảnh
- Nếu xóa ảnh thủ công qua file explorer → phải tự xóa entry trong `metadata.json`
- Sharp convert HEIC → đổi đuôi file thành `.jpg` → filename trong metadata thay đổi so với tên gốc
- Không dùng `node:18-alpine` trong Dockerfile vì sharp sẽ crash
