/**
 * music.js — Playlist player
 * Fetches track list from /api/music (Google Drive music folder).
 */

// ── Elements ───────────────────────────────────────────────
const audio              = document.getElementById('bgMusic');

// Drawer (desktop)
const drawerToggleBtn    = document.getElementById('drawerMusicToggle');
const drawerNextBtn      = document.getElementById('drawerMusicNext');
const drawerTitleEl      = document.getElementById('drawerMusicTitle');

// Bottom sheet (mobile)
const musicSheet         = document.getElementById('musicSheet');
const musicSheetOverlay  = document.getElementById('musicSheetOverlay');
const sheetToggleBtn     = document.getElementById('sheetMusicToggle');
const sheetPrevBtn       = document.getElementById('sheetMusicPrev');
const sheetNextBtn       = document.getElementById('sheetMusicNext');
const sheetTitleEl       = document.getElementById('sheetMusicTitle');
const sheetStatusEl      = document.getElementById('sheetMusicStatus');

// Volume sliders
const drawerVolumeSlider = document.getElementById('drawerVolumeSlider');
const sheetVolumeSlider  = document.getElementById('sheetVolumeSlider');

// Bottom nav trigger
const bottomNavMusic     = document.getElementById('navItemSong');

// ── SVG icons ──────────────────────────────────────────────
const playSmall  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const pauseSmall = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const playLarge  = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const pauseLarge = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

// ── Playlist state ─────────────────────────────────────────
let queue        = [];
let currentIndex = 0;

// ── Volume ─────────────────────────────────────────────────
function setVolume(val) {
  const v = Math.max(0, Math.min(100, val));
  audio.volume = v / 100;
  if (drawerVolumeSlider) drawerVolumeSlider.value = v;
  if (sheetVolumeSlider)  sheetVolumeSlider.value  = v;
  localStorage.setItem('musicVolume', v);
}

const savedVolume = parseInt(localStorage.getItem('musicVolume') ?? '40', 10);
setVolume(savedVolume);

if (drawerVolumeSlider) drawerVolumeSlider.addEventListener('input', () => setVolume(drawerVolumeSlider.value));
if (sheetVolumeSlider)  sheetVolumeSlider.addEventListener('input',  () => setVolume(sheetVolumeSlider.value));

// ── UI sync ────────────────────────────────────────────────
function updateUI() {
  const playing = !audio.paused;
  const title   = queue.length ? (queue[currentIndex].title || '') : '';

  // Drawer
  if (drawerTitleEl)   drawerTitleEl.textContent = title || 'Chưa phát nhạc';
  if (drawerToggleBtn) {
    drawerToggleBtn.innerHTML = playing ? pauseSmall : playSmall;
    drawerToggleBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
    drawerToggleBtn.classList.toggle('is-playing', playing);
  }

  // Sheet
  if (sheetTitleEl)  sheetTitleEl.textContent  = title || 'Chưa phát nhạc';
  if (sheetStatusEl) sheetStatusEl.textContent = playing ? 'Đang phát' : 'Tạm dừng';
  if (sheetToggleBtn) {
    sheetToggleBtn.innerHTML = playing ? pauseLarge : playLarge;
    sheetToggleBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
  }

  // Bottom nav indicator
  if (bottomNavMusic) bottomNavMusic.classList.toggle('is-playing', playing);
}

// ── Track loading ──────────────────────────────────────────
function loadTrack(index) {
  if (!queue.length) return;
  const track = queue[index];
  audio.src = `/api/music/${track.id}`;
  updateUI();
}

// ── Playback ───────────────────────────────────────────────
function tryPlay() {
  return audio.play()
    .then(() => { updateUI(); localStorage.setItem('musicEnabled', 'true'); })
    .catch(() => {});
}

function togglePlay() {
  if (audio.paused) {
    tryPlay();
  } else {
    audio.pause();
    localStorage.setItem('musicEnabled', 'false');
    updateUI();
  }
}

function playNext() {
  currentIndex = (currentIndex + 1) % queue.length;
  loadTrack(currentIndex);
  tryPlay();
}

function playPrev() {
  // Restart current track if past 3s, else go to previous
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
  } else {
    currentIndex = (currentIndex - 1 + queue.length) % queue.length;
    loadTrack(currentIndex);
    tryPlay();
  }
}

// ── Sheet open / close ─────────────────────────────────────
function openMusicSheet() {
  musicSheet.style.display        = 'block';
  musicSheetOverlay.style.display = 'block';
  requestAnimationFrame(() => {
    musicSheet.classList.add('is-open');
    musicSheetOverlay.classList.add('is-open');
  });
}

function closeMusicSheet() {
  musicSheet.classList.remove('is-open');
  musicSheetOverlay.classList.remove('is-open');
  musicSheet.addEventListener('transitionend', () => {
    musicSheet.style.display        = 'none';
    musicSheetOverlay.style.display = 'none';
  }, { once: true });
}

// Swipe down to close
let touchStartY = 0;
musicSheet.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });
musicSheet.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - touchStartY > 60) closeMusicSheet();
}, { passive: true });

// ── Event listeners ────────────────────────────────────────
audio.addEventListener('ended', playNext);
audio.addEventListener('play',  updateUI);
audio.addEventListener('pause', updateUI);

if (drawerToggleBtn) drawerToggleBtn.addEventListener('click', togglePlay);
if (drawerNextBtn)   drawerNextBtn.addEventListener('click', playNext);

sheetToggleBtn.addEventListener('click', togglePlay);
sheetPrevBtn.addEventListener('click', playPrev);
sheetNextBtn.addEventListener('click', playNext);

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="open-music"]')) { e.preventDefault(); openMusicSheet(); }
  if (e.target.closest('#musicSheetOverlay'))         closeMusicSheet();
});

// ── Init — fetch playlist from API ─────────────────────────
fetch('/api/music')
  .then((r) => r.json())
  .then(({ tracks }) => {
    if (!tracks || tracks.length === 0) {
      if (bottomNavMusic) bottomNavMusic.style.display = 'none';
      return;
    }

    queue = tracks; // already shuffled by server
    currentIndex = Math.floor(Math.random() * queue.length);
    loadTrack(currentIndex);
    updateUI();

    if (localStorage.getItem('musicEnabled') !== 'false') {
      audio.play().then(() => updateUI()).catch(() => {
        // Browser blocked autoplay — wait for first interaction
        const onFirstInteraction = (e) => {
          if (e.target.closest('#navItemSong') || e.target.closest('#musicSheet')) return;
          if (localStorage.getItem('musicEnabled') !== 'false') tryPlay();
          document.removeEventListener('click',      onFirstInteraction, true);
          document.removeEventListener('touchstart', onFirstInteraction, true);
        };
        document.addEventListener('click',      onFirstInteraction, true);
        document.addEventListener('touchstart', onFirstInteraction, true);
      });
    }
  })
  .catch(() => {
    // API unavailable — hide music button silently
    if (bottomNavMusic) bottomNavMusic.style.display = 'none';
  });
