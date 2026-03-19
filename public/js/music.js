/**
 * music.js
 * Background music player with autoplay-on-interaction and localStorage persistence.
 *
 * To change the song: update MUSIC_URL below.
 * Supported: direct .mp3 / .ogg / .m4a links (no streaming platforms).
 */

const MUSIC_URL = '/music/bg.webm'; // <- Paste your direct MP3 link here

const audio = document.getElementById('bgMusic');
const btn   = document.getElementById('musicToggleBtn');

if (!MUSIC_URL) {
  // No URL configured — hide button silently
  if (btn) btn.style.display = 'none';
} else {
  audio.src = MUSIC_URL;
  init();
}

function setPlaying(playing) {
  btn.classList.toggle('is-playing', playing);
  btn.setAttribute('aria-label', playing ? 'Tắt nhạc' : 'Bật nhạc');
}

function tryPlay() {
  return audio.play().then(() => { setPlaying(true); }).catch(() => {});
}

function toggleMusic() {
  if (!audio.paused) {
    audio.pause();
    setPlaying(false);
    localStorage.setItem('musicEnabled', 'false');
  } else {
    tryPlay();
    localStorage.setItem('musicEnabled', 'true');
  }
}

btn.addEventListener('click', toggleMusic);

function init() {
  // If user previously turned off music, respect that
  if (localStorage.getItem('musicEnabled') === 'false') {
    setPlaying(false);
    return;
  }

  // Try immediate autoplay (succeeds if page was already interacted with)
  audio.play().then(() => {
    setPlaying(true);
  }).catch(() => {
    // Browser blocked autoplay — wait for first user interaction
    const onFirstInteraction = (e) => {
      // Skip if user is clicking the music button (toggleMusic handles it)
      if (e.target.closest('#musicToggleBtn')) return;
      if (localStorage.getItem('musicEnabled') !== 'false') {
        tryPlay();
      }
      document.removeEventListener('click',      onFirstInteraction, true);
      document.removeEventListener('touchstart', onFirstInteraction, true);
    };
    document.addEventListener('click',      onFirstInteraction, true);
    document.addEventListener('touchstart', onFirstInteraction, true);
  });
}
