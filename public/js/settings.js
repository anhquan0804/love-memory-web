/**
 * settings.js — UI theme switcher with 6 presets.
 * Applies data-ui-theme on <html>; CSS vars handle the rest.
 */

const THEMES = [
  {
    id:     'default',
    name:   'Mặc định',
    desc:   'Ấm áp, vintage',
    swatch: ['#f9f7f4', '#c0a98a', '#2c2521'],
  },
  {
    id:     'bento',
    name:   'Bento',
    desc:   'Hiện đại, clean',
    swatch: ['#f4f4f5', '#3b82f6', '#18181b'],
  },
  {
    id:     'editorial',
    name:   'Editorial',
    desc:   'Serif, tối giản',
    swatch: ['#ffffff', '#18181b', '#71717a'],
  },
  {
    id:        'dark-luxury',
    name:      'Dark Luxury',
    desc:      'Tối, gold accent',
    swatch:    ['#0d0c09', '#c9a96e', '#f5f0e8'],
    forceDark: true,
  },
  {
    id:     'glassmorphism',
    name:   'Glass',
    desc:   'Gradient, frosted',
    swatch: ['#c084fc', '#f472b6', '#dbeafe'],
  },
  {
    id:     'film',
    name:   'Film',
    desc:   'Analog, grain',
    swatch: ['#ede5d8', '#8b6f4e', '#2d2118'],
  },
];

// ── Apply UI theme (runs immediately to prevent flash) ─────
(function initUiTheme() {
  const saved = localStorage.getItem('uiTheme');
  if (saved) document.documentElement.setAttribute('data-ui-theme', saved);
})();

// ── DOM-dependent logic (runs after DOM is ready) ──────────
function initSettings() {
  const settingsSheet        = document.getElementById('settingsSheet');
  const settingsSheetOverlay = document.getElementById('settingsSheetOverlay');
  const settingsDarkToggle   = document.getElementById('settingsDarkToggle');
  const themeGrid            = document.getElementById('themeGrid');

  // Guard: bail out silently if any required element is missing
  if (!settingsSheet || !settingsSheetOverlay || !settingsDarkToggle || !themeGrid) {
    console.error('[Settings] Missing DOM elements — sheet will not function');
    return;
  }

  // ── Sheet open / close ───────────────────────────────────
  function openSettingsSheet() {
    window.closeNav?.();
    settingsSheet.style.display        = 'block';
    settingsSheetOverlay.style.display = 'block';
    requestAnimationFrame(() => {
      settingsSheet.classList.add('is-open');
      settingsSheetOverlay.classList.add('is-open');
    });
    updateDarkToggle();
  }

  function closeSettingsSheet() {
    settingsSheet.classList.remove('is-open');
    settingsSheetOverlay.classList.remove('is-open');
    settingsSheet.addEventListener('transitionend', () => {
      settingsSheet.style.display        = 'none';
      settingsSheetOverlay.style.display = 'none';
    }, { once: true });
  }

  // Expose so gallery.js click handler can call it
  window.openSettingsSheet = openSettingsSheet;

  settingsSheetOverlay.addEventListener('click', closeSettingsSheet);

  // Swipe down to close
  let touchStartY = 0;
  settingsSheet.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  settingsSheet.addEventListener('touchend', (e) => {
    if (e.changedTouches[0].clientY - touchStartY > 60) closeSettingsSheet();
  }, { passive: true });

  // ── Apply UI theme ───────────────────────────────────────
  function applyUiTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    document.documentElement.setAttribute('data-ui-theme', themeId);
    localStorage.setItem('uiTheme', themeId);
    if (theme.forceDark) window.applyTheme?.(true);
    updateThemeCards();
    updateDarkToggle();
  }

  // ── Theme cards ──────────────────────────────────────────
  function buildThemeGrid() {
    themeGrid.innerHTML = '';
    THEMES.forEach((theme) => {
      const card = document.createElement('button');
      card.className     = 'theme-card';
      card.dataset.theme = theme.id;
      card.setAttribute('aria-label', theme.name);
      card.innerHTML = `
        <div class="theme-card__preview">
          ${theme.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}
        </div>
        <span class="theme-card__name">${theme.name}</span>
        <span class="theme-card__desc">${theme.desc}</span>
      `;
      card.addEventListener('click', () => applyUiTheme(theme.id));
      themeGrid.appendChild(card);
    });
    updateThemeCards();
  }

  function updateThemeCards() {
    const current = document.documentElement.getAttribute('data-ui-theme') || 'default';
    document.querySelectorAll('.theme-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.theme === current);
    });
  }

  // ── Dark mode toggle ─────────────────────────────────────
  function updateDarkToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    settingsDarkToggle.classList.toggle('is-on', isDark);
  }

  settingsDarkToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    window.applyTheme?.(!isDark);
    updateDarkToggle();
  });

  // ── Init ─────────────────────────────────────────────────
  buildThemeGrid();
}

// Run after DOM is fully parsed (scripts are at end of body, so DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettings);
} else {
  initSettings();
}
