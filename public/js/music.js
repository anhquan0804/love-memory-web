/**
 * music.js — Playlist player
 *
 * PLAYLIST: add songs here. Each entry:
 *   { src: '/music/filename.mp3', title: 'Tên bài', startTime: 2.5 }
 *   startTime (optional): skip N seconds of silence at the beginning
 */
const PLAYLIST = [
  { src: '/music/bg.webm', title: 'Bài hát 1', startTime: 0 },
  // { src: '/music/song2.mp3', title: 'Tên bài 2', startTime: 2.5 },
];

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

// Bottom nav trigger
const bottomNavMusic     = document.getElementById('bottomNavMusic');

// ── SVG icons ──────────────────────────────────────────────
const playSmall  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const pauseSmall = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const playLarge  = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const pauseLarge = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

// ── Playlist state ─────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const queue = shuffle(PLAYLIST);
let currentIndex = 0;

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
  audio.src = track.src;
  audio.currentTime = track.startTime || 0;
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
    audio.currentTime = queue[currentIndex].startTime || 0;
  } else {
    currentIndex = (currentIndex - 1 + queue.length) % queue.length;
    loadTrack(currentIndex);
    tryPlay();
  }
}

// ── Sheet open / close ─────────────────────────────────────
function openMusicSheet() {
  // Set display first, then add class next frame so CSS transition fires
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
  // Hide with display:none after transition completes
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
  if (e.target.closest('[data-action="open-music"]')) openMusicSheet();
  if (e.target.closest('#musicSheetOverlay'))         closeMusicSheet();
});

// ── Init ───────────────────────────────────────────────────
if (!PLAYLIST.length) {
  bottomNavMusic.style.display = 'none';
} else {
  loadTrack(0);

  if (localStorage.getItem('musicEnabled') !== 'false') {
    audio.play().then(() => updateUI()).catch(() => {
      // Browser blocked autoplay — wait for first interaction
      const onFirstInteraction = (e) => {
        if (e.target.closest('#bottomNavMusic') || e.target.closest('#musicSheet')) return;
        if (localStorage.getItem('musicEnabled') !== 'false') tryPlay();
        document.removeEventListener('click',      onFirstInteraction, true);
        document.removeEventListener('touchstart', onFirstInteraction, true);
      };
      document.addEventListener('click',      onFirstInteraction, true);
      document.addEventListener('touchstart', onFirstInteraction, true);
    });
  }
}
