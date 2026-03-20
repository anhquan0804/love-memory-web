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

// Lightbox zoom & pan state
let zoomScale      = 1;
let zoomPanX       = 0;
let zoomPanY       = 0;
let isPinching     = false;
let pinchStartDist = 0;
let pinchStartScale= 1;
let isDragging     = false;
let dragStartX     = 0;
let dragStartY     = 0;
let touchStartX    = 0;
let lastTapTime    = 0;
let lastTapX       = 0;
let lastTapY       = 0;

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
const lightboxCounter  = document.getElementById('lightboxCounter');
const lightboxPrev     = document.getElementById('lightboxPrev');
const lightboxNext     = document.getElementById('lightboxNext');
const lightboxDownload = document.getElementById('lightboxDownload');

// ── Page navigation ────────────────────────────────────────
function showPage(pageId) {
  const target = document.getElementById(`page-${pageId}`);
  if (!target) return;

  // Swap active page with enter animation
  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active', 'page--entering'));
  target.classList.add('active', 'page--entering');
  target.addEventListener('animationend', () => target.classList.remove('page--entering'), { once: true });

  window.scrollTo(0, 0);

  // Sync nav links (desktop drawer)
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  // Sync bottom nav (mobile)
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageId);
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
  if (link) { e.preventDefault(); showPage(link.dataset.page); return; }

  if (e.target.closest('[data-action="toggle-theme"]')) {
    e.preventDefault();
    applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')     { closeNav(); closeLightbox(); }
  if (e.key === 'ArrowRight') lightboxGoNext();
  if (e.key === 'ArrowLeft')  lightboxGoPrev();
});

// ── Lightbox ───────────────────────────────────────────────
function updateLightboxCounter() {
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
}

function openLightboxAt(url) {
  const idx = allImages.findIndex((img) => img.url === url);
  lightboxImages = allImages;
  lightboxIndex  = idx !== -1 ? idx : 0;

  const img = lightboxImages[lightboxIndex];
  if (!img) return;

  resetZoom();
  updateLightboxCounter();
  lightboxImage.src = img.url;
  lightboxDownload.href = img.url;
  lightboxDownload.setAttribute('download', img.originalName || img.filename);
  lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  lightboxNext.style.visibility = lightboxIndex < lightboxImages.length - 1 ? 'visible' : 'hidden';

  // Entrance animation: scale + fade in
  lightboxImage.classList.remove('lightbox__image--entering');
  void lightboxImage.offsetWidth; // force reflow to restart animation
  lightboxImage.classList.add('lightbox__image--entering');
  lightboxImage.addEventListener('animationend', () => {
    lightboxImage.classList.remove('lightbox__image--entering');
  }, { once: true });

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
  preloadAdjacentImages();
}

function showLightboxSlide(direction = 'none') {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;

  resetZoom();
  updateLightboxCounter();
  lightboxPrev.style.visibility = lightboxIndex > 0 ? 'visible' : 'hidden';
  lightboxNext.style.visibility = lightboxIndex < lightboxImages.length - 1 ? 'visible' : 'hidden';
  lightboxDownload.href = img.url;
  lightboxDownload.setAttribute('download', img.originalName || img.filename);

  // Remove any ongoing animation classes
  lightboxImage.classList.remove(
    'lightbox__image--entering',
    'lightbox__image--slide-next',
    'lightbox__image--slide-prev'
  );

  // Quick fade out, then swap src and slide in
  lightboxImage.style.opacity = '0';
  lightboxImage.addEventListener('transitionend', () => {
    lightboxImage.src = img.url;
    lightboxImage.style.opacity = ''; // clear inline — animation takes over

    if (direction === 'next') {
      lightboxImage.classList.add('lightbox__image--slide-next');
    } else if (direction === 'prev') {
      lightboxImage.classList.add('lightbox__image--slide-prev');
    } else {
      lightboxImage.style.opacity = '1';
    }

    lightboxImage.addEventListener('animationend', () => {
      lightboxImage.classList.remove('lightbox__image--slide-next', 'lightbox__image--slide-prev');
    }, { once: true });

    preloadAdjacentImages();
  }, { once: true });
}

function lightboxGoNext() {
  if (lightboxIndex < lightboxImages.length - 1) {
    lightboxIndex++;
    showLightboxSlide('next');
  }
}

function lightboxGoPrev() {
  if (lightboxIndex > 0) {
    lightboxIndex--;
    showLightboxSlide('prev');
  }
}

// Silently preload the images adjacent to the current one into browser cache
function preloadAdjacentImages() {
  [-1, 1].forEach((offset) => {
    const idx = lightboxIndex + offset;
    if (idx >= 0 && idx < lightboxImages.length) {
      const pre = new Image();
      pre.src = lightboxImages[idx].url;
    }
  });
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
  resetZoom();
  setTimeout(() => { if (!lightbox.classList.contains('active')) lightboxImage.src = ''; }, 250);
}

// ── Zoom helpers ───────────────────────────────────────────
function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyZoom() {
  // translate is in pre-scale space, so divide pan by scale to get screen-pixel movement
  lightboxImage.style.transform = `scale(${zoomScale}) translate(${zoomPanX / zoomScale}px, ${zoomPanY / zoomScale}px)`;
  lightboxImage.classList.toggle('lightbox__image--zoomed', zoomScale > 1);
}

function resetZoom() {
  zoomScale = 1;
  zoomPanX  = 0;
  zoomPanY  = 0;
  lightboxImage.style.transform = '';
  lightboxImage.classList.remove('lightbox__image--zoomed', 'lightbox__image--dragging');
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', lightboxGoPrev);
lightboxNext.addEventListener('click', lightboxGoNext);

// Click outside image to close
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

// ── Lightbox: touch (swipe + pinch zoom + pan) ─────────────
lightbox.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    isPinching      = true;
    pinchStartDist  = getPinchDist(e.touches);
    pinchStartScale = zoomScale;
  } else {
    isPinching  = false;
    touchStartX = e.touches[0].clientX;
    dragStartX  = e.touches[0].clientX;
    dragStartY  = e.touches[0].clientY;
  }
}, { passive: true });

lightbox.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = getPinchDist(e.touches);
    zoomScale = Math.min(4, Math.max(1, pinchStartScale * (dist / pinchStartDist)));
    if (zoomScale === 1) { zoomPanX = 0; zoomPanY = 0; }
    applyZoom();
  } else if (e.touches.length === 1 && zoomScale > 1) {
    // Pan when zoomed in
    e.preventDefault();
    zoomPanX  += e.touches[0].clientX - dragStartX;
    zoomPanY  += e.touches[0].clientY - dragStartY;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    applyZoom();
  }
}, { passive: false });

lightbox.addEventListener('touchend', (e) => {
  if (isPinching) { isPinching = false; return; }

  const touch = e.changedTouches[0];
  const now   = Date.now();
  const dt    = now - lastTapTime;
  const isDoubleTap = dt < 280 && Math.abs(touch.clientX - lastTapX) < 30 && Math.abs(touch.clientY - lastTapY) < 30;

  if (isDoubleTap) {
    // Double-tap: toggle zoom to 2.5x at tap position
    if (zoomScale > 1) {
      resetZoom();
    } else {
      zoomScale = 2.5;
      const rect = lightboxImage.getBoundingClientRect();
      const cx   = touch.clientX - (rect.left + rect.width  / 2);
      const cy   = touch.clientY - (rect.top  + rect.height / 2);
      zoomPanX = cx * (1 - zoomScale);
      zoomPanY = cy * (1 - zoomScale);
      applyZoom();
    }
    lastTapTime = 0;
    return;
  }

  lastTapTime = now;
  lastTapX    = touch.clientX;
  lastTapY    = touch.clientY;

  if (zoomScale > 1) return; // don't swipe when zoomed in
  const diff = touchStartX - touch.clientX;
  if (Math.abs(diff) > 50) {
    diff > 0 ? lightboxGoNext() : lightboxGoPrev();
  }
}, { passive: true });

// ── Lightbox: scroll wheel zoom (desktop) ─────────────────
lightbox.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.2 : -0.2;
  zoomScale = Math.min(4, Math.max(1, zoomScale + delta));
  if (zoomScale === 1) { zoomPanX = 0; zoomPanY = 0; }
  applyZoom();
}, { passive: false });

// ── Lightbox: mouse drag to pan when zoomed (desktop) ─────
lightboxImage.addEventListener('mousedown', (e) => {
  if (zoomScale <= 1) return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  lightboxImage.classList.add('lightbox__image--dragging');
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  zoomPanX  += e.clientX - dragStartX;
  zoomPanY  += e.clientY - dragStartY;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  applyZoom();
});

window.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  lightboxImage.classList.remove('lightbox__image--dragging');
});

// Double-click: toggle zoom to 2.5x at cursor position (desktop)
lightboxImage.addEventListener('dblclick', (e) => {
  if (zoomScale > 1) {
    resetZoom();
  } else {
    zoomScale = 2.5;
    const rect = lightboxImage.getBoundingClientRect();
    const cx   = e.clientX - (rect.left + rect.width  / 2);
    const cy   = e.clientY - (rect.top  + rect.height / 2);
    zoomPanX = cx * (1 - zoomScale);
    zoomPanY = cy * (1 - zoomScale);
    applyZoom();
  }
});

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
  el.classList.add('lazy-img');
  el.addEventListener('load',  () => el.classList.add('img--loaded'), { once: true });
  el.addEventListener('error', () => el.classList.add('img--loaded'), { once: true });
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
  item.className = `gallery-item skeleton${extraClass ? ' ' + extraClass : ''}`;
  const img = makeImg(image);
  img.addEventListener('load',  () => item.classList.remove('skeleton'), { once: true });
  img.addEventListener('error', () => item.classList.remove('skeleton'), { once: true });
  item.appendChild(img);

  // Date overlay — visible on hover (desktop)
  if (image.date) {
    const overlay = document.createElement('div');
    overlay.className   = 'item-date-overlay';
    overlay.textContent = formatDate(image.date);
    item.appendChild(overlay);
  }

  attachInteractivity(item, image);
  galleryEntranceObserver.observe(item);
  return item;
}

// ── Hero background ────────────────────────────────────────
function updateHeroBackground() {
  if (allImages.length === 0) return;
  const img  = allImages[Math.floor(Math.random() * allImages.length)];
  const hero = document.querySelector('.hero');
  if (hero) hero.style.setProperty('--hero-bg', `url("${img.url}")`);
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

// IntersectionObserver for gallery item staggered entrance
const galleryEntranceObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('item--visible');
      galleryEntranceObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.05 });

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

  pickRandom(allImages, MEMORY_PAGE_COUNT).forEach((img, i) => {
    const item = makeItem(img);
    item.style.setProperty('--i', Math.min(i, 16));
    memoryPageGrid.appendChild(item);
  });
}

refreshMemoryPage.addEventListener('click', renderMemoryPage);

// ── UPLOAD PAGE: Simple gallery ────────────────────────────
function renderUploadPageGallery() {
  uploadPageGallery.innerHTML = '';
  uploadPageGallery.appendChild(uploadPageGalleryEmpty);

  if (allImages.length === 0) { uploadPageGalleryEmpty.style.display = 'block'; return; }
  uploadPageGalleryEmpty.style.display = 'none';

  allImages.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'upload-page-item skeleton';
    item.style.setProperty('--i', Math.min(i, 16));
    const imgEl = makeImg(img);
    imgEl.addEventListener('load',  () => item.classList.remove('skeleton'), { once: true });
    imgEl.addEventListener('error', () => item.classList.remove('skeleton'), { once: true });
    item.appendChild(imgEl);

    if (img.date) {
      const cap = document.createElement('span');
      cap.className   = 'upload-page-item__date';
      cap.textContent = formatDate(img.date);
      item.appendChild(cap);
    }

    attachInteractivity(item, img);
    galleryEntranceObserver.observe(item);
    uploadPageGallery.appendChild(item);
  });
}

// ── Shared: Full masonry grid ──────────────────────────────
function renderFullGrid(images, container) {
  images.forEach((img, i) => {
    const item = makeItem(img);
    item.style.setProperty('--i', Math.min(i, 16));
    container.appendChild(item);
  });
}

// ── Shared: Timeline grid ──────────────────────────────────
function renderTimelineGrid(images, container) {
  const groups = [];
  const map    = new Map();
  let   globalIdx = 0;

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

    items.forEach((img, i) => {
      const item = document.createElement('div');
      item.className = 'timeline-item skeleton';
      item.style.setProperty('--i', Math.min(globalIdx++, 16));
      const imgEl = makeImg(img);
      imgEl.addEventListener('load',  () => item.classList.remove('skeleton'), { once: true });
      imgEl.addEventListener('error', () => item.classList.remove('skeleton'), { once: true });
      item.appendChild(imgEl);

      const cap = document.createElement('span');
      cap.className   = 'timeline-item__date';
      cap.textContent = formatDate(img.date);
      item.appendChild(cap);

      attachInteractivity(item, img);
      galleryEntranceObserver.observe(item);
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

// ── Dark mode toggle ───────────────────────────────────────
const themeToggle        = document.getElementById('themeToggle');
const themeIcon          = document.getElementById('themeIcon');
const themeLabel         = document.getElementById('themeLabel');
const bottomNavTheme     = document.getElementById('navItemDisplay');
const bottomNavThemeIcon = document.getElementById('navItemDisplayIcon');
const bottomNavThemeLabel = document.getElementById('navItemDisplayLabel');

const moonSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const sunSvg  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonSvgLg = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const sunSvgLg  = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  // Drawer toggle
  themeIcon.innerHTML    = isDark ? sunSvg : moonSvg;
  themeLabel.textContent = isDark ? 'Giao diện sáng' : 'Giao diện tối';
  // Bottom nav toggle (mobile)
  bottomNavThemeIcon.innerHTML    = isDark ? sunSvgLg : moonSvgLg;
  bottomNavThemeLabel.textContent = isDark ? 'Sáng' : 'Tối';
}

// Init toggle state from current theme
applyTheme(document.documentElement.getAttribute('data-theme') === 'dark');

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
});


// ── Init ───────────────────────────────────────────────────
(async () => {
  await Promise.all([loadConfig(), fetchImages()]);
  updateHeroBackground();
  renderHomeMemory();
  renderHomeGallery();
})();
