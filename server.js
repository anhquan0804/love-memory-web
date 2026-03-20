require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const compression = require('compression');

const galleryRoute = require('./src/routes/gallery.route');
const uploadRoute  = require('./src/routes/upload.route');
const configRoute  = require('./src/routes/config.route');
const imageRoute   = require('./src/routes/image.route');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip compress all responses
app.use(compression());

// Parse JSON request bodies
app.use(express.json());

// Allow cross-origin requests (useful when accessing via Cloudflare Tunnel)
app.use(cors());

// Serve static frontend files from /public — cache 7 days in browser
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

// Serve uploaded images at /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limit upload endpoint: max 50 requests per hour per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều request upload. Vui lòng thử lại sau 1 giờ.' },
});

// API routes
app.use('/api/config',  configRoute);
app.use('/api/gallery', galleryRoute);
app.use('/api/upload',  uploadLimiter, uploadRoute);
app.use('/api/image',   imageRoute);

// Global error handler — must be registered after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Love Memory server running at http://localhost:${PORT}`);
});
