/**
 * gallery.js
 * Handles: page navigation, hamburger nav, all gallery rendering modes,
 * memory preview (5 photos), memory page (15-20 photos),
 * lightbox with next/prev/download/swipe, and image deletion.
 */

// ── Constants ──────────────────────────────────────────────
const HOME_MEMORY_COUNT = 6;
const MEMORY_PAGE_COUNT = 18;

// ── State ──────────────────────────────────────────────────
let allImages       = [];
let currentPage     = 'home';
let homeGalleryMode = 'full'; // 'full' | 'timeline'

// Lightbox state
let lightboxImages = [];
let lightboxIndex  = 0;
let touchStartX    = 0;

// ── DOM refs ───────────────────────────────────────────────
const hamburger         = document.getElementById('hamburger');
const navOverlay        = document.getElementById('navOverlay');
const navDrawer         = document.getElementById('navDrawer');

const homeMemoryGrid    = document.getElementById('homeMemoryGrid');
const homeMemoryEmpty   = document.getElementById('homeMemoryEmpty');
const refreshHomeMemory = document.getElementById('refreshHomeMemory');

const homeGalleryGrid   = document.getElementById('homeGalleryGrid');
const homeGalleryEmpty  = document.getElementById('homeGalleryEmpty');

const memoryPageGrid    = document.getElementById('memoryPageGrid');
const memoryPageEmpty   = document.getElementById('memoryPageEmpty');
const refreshMemoryPage = document.getElementById('refreshMemoryPage');

const uploadPageGallery      = document.getElementById('uploadPageGallery');
const uploadPageGalleryEmpty = document.getElementById('uploadPageGalleryEmpty');

const lightbox         = document.getElementById('lightbox');
const lightboxImage    = document.getElementById('lightboxImage');
const lightboxClose    = document.getElementById('lightboxClose');
const lightboxPrev     = document.getElementById('lightboxPrev');
const lightboxNext     = document.getElementById('lightboxNext');
const lightboxDownload = document.getElementById('lightboxDownload');

// ── Page navigation ────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  currentPage = pageId;
  closeNav();

  if (pageId === 'memory') renderMemoryPage();
  if (pageId === 'upload') renderUploadPageGallery();
}

// ── Hamburger / Nav drawer ─────────────────────────────────
function openNav() {
  navDrawer.classList.add('open');
  navOverlay.classList.add('visible');
  hamburger.setAttribute('aria-expanded', 'true');
}

function closeNav() {
  navDrawer.classList.remove('open');
  navOverlay.classList.remove('visible');
  hamburger.setAttribute('aria-expanded', 'false');
}

hamburger.addEventListener('click', () => {
  navDrawer.classList.contains('open') ? closeNav() : openNav();
});

navOverlay.addEventListener('click', closeNav);

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-page]');
  if (link) { e.preventDefault(); showPage(link.dataset.page); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')     { closeNav(); closeLightbox(); }
  if (e.key === 'ArrowRight') lightboxGoNext();
  if (e.key === 'ArrowLeft')  lightboxGoPrev();
});

// ── Lightbox ───────────────────────────────────────────────
function openLightboxAt(url) {
  const idx = allImages.findIndex((img) => img.url === url);
  lightboxImages = allImages;
  lightboxIndex  = idx !== -1 ? idx : 0;
  showLightboxSlide();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function showLightboxSlide() {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;

  lightboxImage.src        = img.url;
  lightboxDownload.href    = img.url;
  lightboxDownload.setAttribute('download', img.originalName || img.filename);

  // Show/hide nav arrows based on position
  lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  lightboxNext.style.visibility = lightboxIndex < lightboxImages.length - 1 ? 'visible' : 'hidden';
}

function lightboxGoNext() {
  if (lightboxIndex < lightboxImages.length - 1) {
    lightboxIndex++;
    showLightboxSlide();
  }
}

function lightboxGoPrev() {
  if (lightboxIndex > 0) {
    lightboxIndex--;
    showLightboxSlide();
  }
}

function closeLightbox() {
  lightbox.classList.remove('active');
  lightboxImage.src = '';
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', lightboxGoPrev);
lightboxNext.addEventListener('click', lightboxGoNext);

// Click outside image to close
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Touch swipe for lightbox
lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });

lightbox.addEventListener('touchend', (e) => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) {
    diff > 0 ? lightboxGoNext() : lightboxGoPrev();
  }
}, { passive: true });

// ── Delete ─────────────────────────────────────────────────
async function deleteImage(filename) {
  if (!confirm('Xóa ảnh này?')) return;
  try {
    const res = await fetch(`/api/gallery/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'Xóa thất bại');
    await refreshGallery();
  } catch (err) {
    alert('Không thể xóa: ' + err.message);
  }
}

// ── Item builder helpers ───────────────────────────────────
function makeImg(image) {
  const el = document.createElement('img');
  el.src     = image.url;
  el.alt     = image.originalName || 'Ảnh kỷ niệm';
  el.loading = 'lazy';
  return el;
}

function makeDeleteBtn(image) {
  const btn = document.createElement('button');
  btn.className = 'item-delete-btn';
  btn.setAttribute('aria-label', 'Xóa ảnh');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  btn.addEventListener('click', (e) => { e.stopPropagation(); deleteImage(image.filename); });
  return btn;
}

/**
 * Attach click-to-lightbox and long-press-to-delete to any item element.
 */
function attachInteractivity(item, image) {
  item.addEventListener('click', () => openLightboxAt(image.url));
  item.appendChild(makeDeleteBtn(image));

  // Long press on mobile triggers delete
  let longPressTimer;
  item.addEventListener('touchstart', () => {
    longPressTimer = setTimeout(() => deleteImage(image.filename), 700);
  }, { passive: true });
  item.addEventListener('touchend',  () => clearTimeout(longPressTimer));
  item.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
}

/**
 * Standard gallery item (masonry grid).
 */
function makeItem(image, extraClass = '') {
  const item = document.createElement('div');
  item.className = `gallery-item${extraClass ? ' ' + extraClass : ''}`;
  item.appendChild(makeImg(image));
  attachInteractivity(item, image);
  return item;
}

// ── Date helpers ───────────────────────────────────────────
const fmtFull  = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtGroup = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' });

function formatDate(iso) {
  if (!iso) return '';
  try { return fmtFull.format(new Date(iso)); } catch { return ''; }
}

function groupKey(iso) {
  if (!iso) return 'Không rõ ngày';
  try { return fmtGroup.format(new Date(iso)); } catch { return 'Không rõ ngày'; }
}

function pickRandom(images, n) {
  const pool = [...images];
  const result = [];
  while (result.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(i, 1)[0]);
  }
  return result;
}

// ── Spin refresh button icon ───────────────────────────────
function spinRefreshBtn(btn) {
  btn.classList.remove('btn-icon--spinning');
  void btn.offsetWidth; // force reflow to restart animation
  btn.classList.add('btn-icon--spinning');
  btn.querySelector('svg').addEventListener('animationend', () => {
    btn.classList.remove('btn-icon--spinning');
  }, { once: true });
}

// Format date — wedding style: "15 · Tháng 3 · 2024"
function formatDateWedding(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')} · Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`;
  } catch { return ''; }
}

// IntersectionObserver for scroll-reveal
const scrollRevealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      // Add is-visible to entry wrapper AND the inner card
      entry.target.classList.add('is-visible');
      const card = entry.target.querySelector('.memory-preview-item');
      if (card) card.classList.add('is-visible');
      scrollRevealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

// ── HOME: Memory scroll section ────────────────────────────
function renderHomeMemory() {
  // Disconnect old observers before clearing
  homeMemoryGrid.querySelectorAll('.memory-scroll-entry').forEach((el) => {
    scrollRevealObserver.unobserve(el);
  });

  homeMemoryGrid.innerHTML = '';
  homeMemoryGrid.appendChild(homeMemoryEmpty);

  if (allImages.length === 0) { homeMemoryEmpty.style.display = 'block'; return; }
  homeMemoryEmpty.style.display = 'none';

  pickRandom(allImages, HOME_MEMORY_COUNT).forEach((img, idx) => {
    // Wrapper entry (card + date)
    const entry = document.createElement('div');
    entry.className = 'memory-scroll-entry';

    // Photo card
    const item = document.createElement('div');
    const dirClass = idx % 2 === 0 ? 'from-left' : 'from-right';
    item.className = `memory-preview-item ${dirClass}${idx === 0 ? ' memory-preview-item--featured' : ''}`;
    item.appendChild(makeImg(img));
    attachInteractivity(item, img);
    entry.appendChild(item);

    // Date — outside the card, below it
    const dateLabel = formatDateWedding(img.date);
    if (dateLabel) {
      const dateEl = document.createElement('span');
      dateEl.className   = 'memory-entry__date';
      dateEl.textContent = dateLabel;
      entry.appendChild(dateEl);
    }

    homeMemoryGrid.appendChild(entry);

      // Observe the entry wrapper — is-visible added to entry triggers both card + date
    scrollRevealObserver.observe(entry);
  });
}

refreshHomeMemory.addEventListener('click', () => {
  spinRefreshBtn(refreshHomeMemory);
  renderHomeMemory();
});

// ── HOME: Main gallery ─────────────────────────────────────
function renderHomeGallery() {
  homeGalleryGrid.innerHTML = '';
  homeGalleryGrid.appendChild(homeGalleryEmpty);

  if (allImages.length === 0) { homeGalleryEmpty.style.display = 'block'; return; }
  homeGalleryEmpty.style.display = 'none';

  if (homeGalleryMode === 'full') {
    renderFullGrid(allImages, homeGalleryGrid);
  } else {
    renderTimelineGrid(allImages, homeGalleryGrid);
  }
}

document.querySelectorAll('.mode-btn[data-gallery="home"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn[data-gallery="home"]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    homeGalleryMode = btn.dataset.mode;
    renderHomeGallery();
  });
});

// ── MEMORY PAGE: 15-20 random photos ──────────────────────
function renderMemoryPage() {
  memoryPageGrid.innerHTML = '';
  memoryPageGrid.appendChild(memoryPageEmpty);

  if (allImages.length === 0) { memoryPageEmpty.style.display = 'block'; return; }
  memoryPageEmpty.style.display = 'none';

  pickRandom(allImages, MEMORY_PAGE_COUNT).forEach((img) => {
    memoryPageGrid.appendChild(makeItem(img));
  });
}

refreshMemoryPage.addEventListener('click', renderMemoryPage);

// ── UPLOAD PAGE: Simple gallery ────────────────────────────
function renderUploadPageGallery() {
  uploadPageGallery.innerHTML = '';
  uploadPageGallery.appendChild(uploadPageGalleryEmpty);

  if (allImages.length === 0) { uploadPageGalleryEmpty.style.display = 'block'; return; }
  uploadPageGalleryEmpty.style.display = 'none';

  allImages.forEach((img) => {
    const item = document.createElement('div');
    item.className = 'upload-page-item';
    item.appendChild(makeImg(img));

    if (img.date) {
      const cap = document.createElement('span');
      cap.className   = 'upload-page-item__date';
      cap.textContent = formatDate(img.date);
      item.appendChild(cap);
    }

    attachInteractivity(item, img);
    uploadPageGallery.appendChild(item);
  });
}

// ── Shared: Full masonry grid ──────────────────────────────
function renderFullGrid(images, container) {
  images.forEach((img) => container.appendChild(makeItem(img)));
}

// ── Shared: Timeline grid ──────────────────────────────────
function renderTimelineGrid(images, container) {
  const groups = [];
  const map    = new Map();

  images.forEach((img) => {
    const key = groupKey(img.date);
    if (!map.has(key)) {
      const g = { label: key, items: [] };
      groups.push(g);
      map.set(key, g);
    }
    map.get(key).items.push(img);
  });

  groups.forEach(({ label, items }) => {
    const header = document.createElement('div');
    header.className   = 'timeline-header';
    header.textContent = label;
    container.appendChild(header);

    const subGrid = document.createElement('div');
    subGrid.className = 'timeline-grid';

    items.forEach((img) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.appendChild(makeImg(img));

      const cap = document.createElement('span');
      cap.className   = 'timeline-item__date';
      cap.textContent = formatDate(img.date);
      item.appendChild(cap);

      attachInteractivity(item, img);
      subGrid.appendChild(item);
    });

    container.appendChild(subGrid);
  });
}

// ── Data ───────────────────────────────────────────────────
async function fetchImages() {
  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error('Gallery fetch failed');
    const data = await res.json();
    allImages = data.images;
  } catch (err) {
    console.error('[Gallery]', err.message);
  }
}

async function refreshGallery() {
  await fetchImages();
  renderHomeMemory();
  renderHomeGallery();
  if (currentPage === 'memory') renderMemoryPage();
  if (currentPage === 'upload') renderUploadPageGallery();
}

// Expose for upload.js
window.refreshGallery = refreshGallery;

// ── Config: load names from .env via server ────────────────
async function loadConfig() {
  try {
    const res  = await fetch('/api/config');
    const data = await res.json();
    const name1 = data.name1 || '';
    const name2 = data.name2 || '';
    document.querySelectorAll('.js-name1').forEach((el) => { el.textContent = name1; });
    document.querySelectorAll('.js-name2').forEach((el) => { el.textContent = name2; });
    document.title = `${name1} & ${name2}`;
  } catch (err) {
    console.error('[Config]', err.message);
  }
}

// ── Parallax scroll for memory items ──────────────────────
let parallaxRaf;
function updateMemoryParallax() {
  homeMemoryGrid.querySelectorAll('.memory-preview-item.is-visible').forEach((item) => {
    const rect   = item.getBoundingClientRect();
    const center = rect.top + rect.height / 2 - window.innerHeight / 2;
    const offset = center * 0.07; // 7% parallax depth
    const img = item.querySelector('img');
    if (img) img.style.transform = `scale(1.1) translateY(${offset}px)`;
  });
}

window.addEventListener('scroll', () => {
  cancelAnimationFrame(parallaxRaf);
  parallaxRaf = requestAnimationFrame(updateMemoryParallax);
}, { passive: true });

// ── Init ───────────────────────────────────────────────────
(async () => {
  await Promise.all([loadConfig(), fetchImages()]);
  renderHomeMemory();
  renderHomeGallery();
})();
