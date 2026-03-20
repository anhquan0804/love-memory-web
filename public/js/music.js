/**
 * music.js — Playlist player with dual-audio gapless switching.
 *
 * Two Audio elements swap roles: one plays, one preloads the next track.
 * When advancing, we play directly from the preloaded element — no re-fetch.
 */

// ── Dual audio elements ────────────────────────────────────
const audioA = document.getElementById('bgMusic'); // in DOM
const audioB = new Audio();
audioB.preload = 'auto';

let active  = audioA; // currently playing
let standby = audioB; // preloading next track
let preloadedIdx = -1; // which queue index standby has buffered

// ── DOM refs ───────────────────────────────────────────────
const drawerToggleBtn    = document.getElementById('drawerMusicToggle');
const drawerNextBtn      = document.getElementById('drawerMusicNext');
const drawerTitleEl      = document.getElementById('drawerMusicTitle');

const musicSheet         = document.getElementById('musicSheet');
const musicSheetOverlay  = document.getElementById('musicSheetOverlay');
const sheetToggleBtn     = document.getElementById('sheetMusicToggle');
const sheetPrevBtn       = document.getElementById('sheetMusicPrev');
const sheetNextBtn       = document.getElementById('sheetMusicNext');
const sheetTitleEl       = document.getElementById('sheetMusicTitle');
const sheetStatusEl      = document.getElementById('sheetMusicStatus');

const drawerVolumeSlider = document.getElementById('drawerVolumeSlider');
const sheetVolumeSlider  = document.getElementById('sheetVolumeSlider');
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
  audioA.volume = v / 100;
  audioB.volume = v / 100;
  if (drawerVolumeSlider) drawerVolumeSlider.value = v;
  if (sheetVolumeSlider)  sheetVolumeSlider.value  = v;
  localStorage.setItem('musicVolume', v);
}

setVolume(parseInt(localStorage.getItem('musicVolume') ?? '40', 10));

if (drawerVolumeSlider) drawerVolumeSlider.addEventListener('input', () => setVolume(drawerVolumeSlider.value));
if (sheetVolumeSlider)  sheetVolumeSlider.addEventListener('input',  () => setVolume(sheetVolumeSlider.value));

// ── UI sync ────────────────────────────────────────────────
function updateUI() {
  const playing = !active.paused;
  const title   = queue.length ? (queue[currentIndex].title || '') : '';

  if (drawerTitleEl)   drawerTitleEl.textContent = title || 'Chưa phát nhạc';
  if (drawerToggleBtn) {
    drawerToggleBtn.innerHTML = playing ? pauseSmall : playSmall;
    drawerToggleBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
    drawerToggleBtn.classList.toggle('is-playing', playing);
  }
  if (sheetTitleEl)  sheetTitleEl.textContent  = title || 'Chưa phát nhạc';
  if (sheetStatusEl) sheetStatusEl.textContent = playing ? 'Đang phát' : 'Tạm dừng';
  if (sheetToggleBtn) {
    sheetToggleBtn.innerHTML = playing ? pauseLarge : playLarge;
    sheetToggleBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
  }
  if (bottomNavMusic) bottomNavMusic.classList.toggle('is-playing', playing);
}

// ── Preload ────────────────────────────────────────────────
function preloadNext(afterIndex) {
  if (queue.length <= 1) return;
  const nextIdx = (afterIndex + 1) % queue.length;
  if (preloadedIdx === nextIdx) return; // already buffering
  standby.src      = `/api/music/${queue[nextIdx].id}`;
  standby.volume   = active.volume;
  standby.preload  = 'auto';
  standby.load();
  preloadedIdx = nextIdx;
}

// ── Playback ───────────────────────────────────────────────
function tryPlay() {
  return active.play()
    .then(() => { updateUI(); localStorage.setItem('musicEnabled', 'true'); })
    .catch(() => {});
}

function togglePlay() {
  if (active.paused) {
    tryPlay();
  } else {
    active.pause();
    localStorage.setItem('musicEnabled', 'false');
    updateUI();
  }
}

function playTrackAt(index) {
  if (!queue.length) return;

  if (preloadedIdx === index) {
    // Standby already buffered this track — swap elements, play instantly
    active.pause();
    active.src   = '';
    [active, standby] = [standby, active];
    preloadedIdx = -1;
  } else {
    // Standby didn't buffer this one — load fresh
    active.pause();
    active.src          = `/api/music/${queue[index].id}`;
    active.currentTime  = 0;
  }

  currentIndex = index;
  active.play()
    .then(() => { updateUI(); preloadNext(currentIndex); localStorage.setItem('musicEnabled', 'true'); })
    .catch(() => { updateUI(); });
}

function playNext() {
  playTrackAt((currentIndex + 1) % queue.length);
}

function playPrev() {
  if (active.currentTime > 3) {
    active.currentTime = 0;
  } else {
    playTrackAt((currentIndex - 1 + queue.length) % queue.length);
  }
}

// ── Event listeners on BOTH elements ─────────────────────
// Only react when fired by the active element
function onEnded()  { if (this === active) playNext(); }
function onPlay()   { if (this === active) updateUI(); }
function onPause()  { if (this === active) updateUI(); }

audioA.addEventListener('ended', onEnded);
audioA.addEventListener('play',  onPlay);
audioA.addEventListener('pause', onPause);
audioB.addEventListener('ended', onEnded);
audioB.addEventListener('play',  onPlay);
audioB.addEventListener('pause', onPause);

if (drawerToggleBtn) drawerToggleBtn.addEventListener('click', togglePlay);
if (drawerNextBtn)   drawerNextBtn.addEventListener('click', playNext);

sheetToggleBtn.addEventListener('click', togglePlay);
sheetPrevBtn.addEventListener('click', playPrev);
sheetNextBtn.addEventListener('click', playNext);

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

let touchStartY = 0;
musicSheet.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });
musicSheet.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - touchStartY > 60) closeMusicSheet();
}, { passive: true });

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="open-music"]')) { e.preventDefault(); openMusicSheet(); }
  if (e.target.closest('#musicSheetOverlay'))         closeMusicSheet();
});

// ── Init ───────────────────────────────────────────────────
fetch('/api/music')
  .then((r) => r.json())
  .then(({ tracks }) => {
    if (!tracks || tracks.length === 0) {
      if (bottomNavMusic) bottomNavMusic.style.display = 'none';
      return;
    }

    queue        = tracks;
    currentIndex = Math.floor(Math.random() * queue.length);

    // Load first track — do NOT preload standby yet (avoid consuming audio quota before user gesture)
    active.src = `/api/music/${queue[currentIndex].id}`;
    updateUI();

    if (localStorage.getItem('musicEnabled') !== 'false') {
      active.play()
        .then(() => {
          updateUI();
          localStorage.setItem('musicEnabled', 'true');
          preloadNext(currentIndex);
        })
        .catch(() => {
          const onFirstInteraction = (e) => {
            if (e.target.closest('#navItemSong') || e.target.closest('#musicSheet')) return;
            if (localStorage.getItem('musicEnabled') !== 'false') {
              tryPlay().then(() => preloadNext(currentIndex));
            }
            document.removeEventListener('click',      onFirstInteraction, true);
            document.removeEventListener('touchstart', onFirstInteraction, true);
          };
          document.addEventListener('click',      onFirstInteraction, true);
          document.addEventListener('touchstart', onFirstInteraction, true);
        });
    }
  })
  .catch(() => {
    if (bottomNavMusic) bottomNavMusic.style.display = 'none';
  });

// ── Poll for playlist changes (every 60s) ─────────────────
setInterval(() => {
  fetch('/api/music')
    .then((r) => r.json())
    .then(({ tracks }) => {
      if (!tracks || tracks.length === 0) return;
      const currentIds = queue.map((t) => t.id).sort().join(',');
      const newIds     = tracks.map((t) => t.id).sort().join(',');
      if (currentIds === newIds) return;

      const playingId  = queue[currentIndex]?.id;
      queue = tracks;
      const stillExists = queue.findIndex((t) => t.id === playingId);
      currentIndex  = stillExists !== -1 ? stillExists : 0;
      preloadedIdx  = -1;
      preloadNext(currentIndex);
      if (bottomNavMusic) bottomNavMusic.style.display = queue.length ? '' : 'none';
    })
    .catch(() => {});
}, 60 * 1000);
