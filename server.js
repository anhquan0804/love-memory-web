require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const galleryRoute = require('./src/routes/gallery.route');
const uploadRoute  = require('./src/routes/upload.route');
const configRoute  = require('./src/routes/config.route');
const imageRoute   = require('./src/routes/image.route');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Allow cross-origin requests (useful when accessing via Cloudflare Tunnel)
app.use(cors());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded images at /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/config',  configRoute);
app.use('/api/gallery', galleryRoute);
app.use('/api/upload',  uploadRoute);
app.use('/api/image',   imageRoute);

// Global error handler — must be registered after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Love Memory server running at http://localhost:${PORT}`);
});
