/* =====================================================================
   NOVA EXTENSIONS — nova-extensions.js
   ---------------------------------------------------------------------
   A plugin layer for the NOVA audio player that does NOT modify
   index.html. Include it with a plain <script> tag AFTER the player's
   own inline <script> block (right before </body> works well):

     <link rel="stylesheet" href="nova-extensions.css">
     <script src="nova-extensions.js"></script>
     </body>

   WHY THIS WORKS
   NOVA's player script is a classic (non-module) inline <script>, so
   every top-level `const`/`function` it declares — state, ACTIONS,
   ICONS, audioEl, showToast(), seekBy(), renderCurrentView(), etc. —
   becomes a plain global. As long as this file loads *after* that
   script, it can read and extend all of it safely.

   HOW TO ADD YOUR OWN FEATURE
   Scroll to "YOUR FEATURES GO HERE" at the bottom and copy the
   template. Wrap each feature in NovaExt.register(name, fn) so:
     - features are isolated (one throwing an error won't break others)
     - you get a console warning instead of a silent conflict if two
       features register the same name
   ===================================================================== */
(function () {
  'use strict';

  if (typeof state === 'undefined' || typeof ACTIONS === 'undefined' || typeof ICONS === 'undefined') {
    console.error('[NovaExt] nova-extensions.js must be loaded AFTER the main NOVA <script> block. Aborting.');
    return;
  }

  /* ------------------------------------------------------------------
     Core plugin API — small helpers so features don't have to touch
     NOVA's internals directly.
  ------------------------------------------------------------------ */
  const NovaExt = window.NovaExt = window.NovaExt || {
    features: {},

    /** Register a new data-action handler (same map the UI's data-action="..." buttons dispatch through). */
    action(name, fn) {
      ACTIONS[name] = fn;
    },

    /** Register/override an icon so it can be used like any built-in ICONS.xyz. */
    icon(name, svg) {
      ICONS[name] = svg;
    },

    /** Show a toast using NOVA's existing toast system. */
    toast(msg) {
      if (typeof showToast === 'function') showToast(msg);
    },

    /** Insert a button into the top-right header icon group (theme/upload/settings). */
    headerButton({ action, title = '', svg = '', prepend = false } = {}) {
      const group = document.querySelector('.app-header > div:last-child');
      if (!group) return null;
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.dataset.action = action;
      btn.title = title;
      btn.innerHTML = svg;
      if (prepend && group.firstChild) group.insertBefore(btn, group.firstChild);
      else group.appendChild(btn);
      return btn;
    },

    /** Insert a button into the full-player top row (sound/pip/cast icons live here). */
    fullPlayerButton({ action, title = '', svg = '', prepend = false } = {}) {
      const group = document.querySelector('.full-top-row > div:last-child');
      if (!group) return null;
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.dataset.action = action;
      btn.title = title;
      btn.innerHTML = svg;
      if (prepend && group.firstChild) group.insertBefore(btn, group.firstChild);
      else group.appendChild(btn);
      return btn;
    },

    /** Render arbitrary HTML into NOVA's shared modal root (auto-wired backdrop-click-to-close if you give the outer element id="ext-modal-backdrop"). */
    openModal(html) {
      const root = document.getElementById('modal-root');
      if (!root) return;
      root.innerHTML = html;
      const backdrop = document.getElementById('ext-modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target.id === 'ext-modal-backdrop') NovaExt.closeModal();
        });
      }
    },

    closeModal() {
      const root = document.getElementById('modal-root');
      if (root) root.innerHTML = '';
    },

    /** Run fn once the DOM/app shell is ready (safe even if this script loads before or after init() finishes). */
    onReady(fn) {
      if (document.getElementById('app')) fn();
      else document.addEventListener('DOMContentLoaded', fn, { once: true });
    },

    /** Wrap register in a try/catch so one broken feature can't take down the rest. */
    register(name, initFn) {
      if (this.features[name]) {
        console.warn('[NovaExt] Feature "' + name + '" is already registered — skipping duplicate.');
        return;
      }
      this.features[name] = true;
      try {
        NovaExt.onReady(() => initFn(NovaExt));
      } catch (err) {
        console.error('[NovaExt] Feature "' + name + '" failed to initialize:', err);
      }
    },
  };

  /* ==================================================================
     EXAMPLE FEATURE 1 — Keyboard Shortcuts
     Space = play/pause · Left/Right = seek 10s · Up/Down = volume
     M = mute · F = favorite current track · S = shuffle · R = repeat
     ? = show shortcuts help
  ================================================================== */
  NovaExt.register('keyboard-shortcuts', function (ext) {
    function isTypingTarget(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function shortcutsHelpHtml() {
      const rows = [
        ['Space', 'Play / Pause'],
        ['\u2190 / \u2192', 'Seek back / forward 10s'],
        ['\u2191 / \u2193', 'Volume up / down'],
        ['M', 'Mute / unmute'],
        ['F', 'Favorite current track'],
        ['S', 'Toggle shuffle'],
        ['R', 'Cycle repeat mode'],
        ['?', 'Show this help'],
      ];
      return (
        '<div class="modal-backdrop" id="ext-modal-backdrop">' +
        '<div class="modal-card glass ext-shortcuts-card">' +
        '<div class="ext-shortcuts-title">Keyboard Shortcuts</div>' +
        '<div class="ext-shortcuts-list">' +
        rows.map(([k, d]) => '<div class="ext-shortcut-row"><kbd>' + k + '</kbd><span>' + d + '</span></div>').join('') +
        '</div>' +
        '<div class="modal-actions"><button class="btn-ghost" data-action="ext-close-modal">Close</button></div>' +
        '</div></div>'
      );
    }

    ext.action('ext-close-modal', () => ext.closeModal());
    ext.action('ext-show-shortcuts', () => ext.openModal(shortcutsHelpHtml()));

    document.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (document.getElementById('modal-root').innerHTML.trim() && e.key !== 'Escape') return; // don't fire while a modal is open

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (typeof playPause === 'function') playPause();
          break;
        case 'ArrowRight':
          if (typeof seekBy === 'function') seekBy(10);
          break;
        case 'ArrowLeft':
          if (typeof seekBy === 'function') seekBy(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          window.NovaExt.setVolume && window.NovaExt.setVolume(getVolume() + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          window.NovaExt.setVolume && window.NovaExt.setVolume(getVolume() - 0.1);
          break;
        case 'm':
        case 'M':
          window.NovaExt.toggleMute && window.NovaExt.toggleMute();
          break;
        case 'f':
        case 'F':
          if (typeof currentTrack !== 'undefined' && currentTrack && typeof toggleFavorite === 'function') toggleFavorite(currentTrack.id);
          break;
        case 's':
        case 'S':
          if (typeof toggleShuffle === 'function') toggleShuffle();
          break;
        case 'r':
        case 'R':
          if (typeof cycleRepeat === 'function') cycleRepeat();
          break;
        case '?':
          ext.openModal(shortcutsHelpHtml());
          break;
      }
    });

    function getVolume() {
      return typeof audioEl !== 'undefined' && audioEl ? audioEl.volume : 1;
    }

    // Small "?" help button in the header so the shortcuts are discoverable.
    ext.headerButton({
      action: 'ext-show-shortcuts',
      title: 'Keyboard shortcuts',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    });
  });

  /* ==================================================================
     EXAMPLE FEATURE 2 — Volume Control
     NOVA ships without an on-screen volume slider (it relies on the
     OS/hardware). This adds a button + popover slider to the full
     player, keeps both audio elements (used for crossfade) in sync,
     and remembers the level across sessions via localStorage.
  ================================================================== */
  NovaExt.register('volume-control', function (ext) {
    const STORAGE_KEY = 'nova-ext-volume';
    let lastVolume = 1;

    function loadStoredVolume() {
      const raw = localStorage.getItem(STORAGE_KEY);
      const v = raw !== null ? parseFloat(raw) : 1;
      return isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    }

    function applyVolume(v) {
      v = Math.min(1, Math.max(0, v));
      if (typeof audioEl !== 'undefined' && audioEl) audioEl.volume = v;
      if (typeof audioElAlt !== 'undefined' && audioElAlt) audioElAlt.volume = v;
      localStorage.setItem(STORAGE_KEY, String(v));
      if (v > 0) lastVolume = v;
      updateUI(v);
      return v;
    }

    function updateUI(v) {
      const slider = document.getElementById('ext-volume-slider');
      if (slider) slider.value = String(Math.round(v * 100));
      const btn = document.getElementById('ext-volume-btn');
      if (btn) btn.innerHTML = volumeIcon(v);
    }

    function volumeIcon(v) {
      if (v <= 0) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
      }
      if (v < 0.5) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    }

    function togglePopover() {
      const pop = document.getElementById('ext-volume-popover');
      if (pop) pop.classList.toggle('hidden');
    }

    ext.action('ext-toggle-volume', togglePopover);

    // Expose small API used by the keyboard-shortcuts feature too.
    window.NovaExt.setVolume = applyVolume;
    window.NovaExt.toggleMute = function () {
      const current = typeof audioEl !== 'undefined' && audioEl ? audioEl.volume : 1;
      applyVolume(current > 0 ? 0 : lastVolume || 1);
    };

    // Build the button + popover once the full player top row exists.
    const btn = ext.fullPlayerButton({
      action: 'ext-toggle-volume',
      title: 'Volume',
      svg: volumeIcon(1),
      prepend: true,
    });
    if (btn) {
      btn.id = 'ext-volume-btn';
      const popover = document.createElement('div');
      popover.id = 'ext-volume-popover';
      popover.className = 'ext-volume-popover glass hidden';
      popover.innerHTML =
        '<input type="range" id="ext-volume-slider" min="0" max="100" value="100" orient="vertical">';
      btn.parentElement.style.position = btn.parentElement.style.position || 'relative';
      btn.parentElement.appendChild(popover);

      popover.querySelector('#ext-volume-slider').addEventListener('input', (e) => {
        applyVolume(parseInt(e.target.value, 10) / 100);
      });

      document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          popover.classList.add('hidden');
        }
      });
    }

    applyVolume(loadStoredVolume());
  });

  /* ==================================================================
     YOUR FEATURES GO HERE
     ------------------------------------------------------------------
     Copy this template and fill it in. `ext` is the NovaExt object,
     so inside your callback you get ext.action(), ext.icon(),
     ext.toast(), ext.headerButton(), ext.fullPlayerButton(),
     ext.openModal()/closeModal(), all NOVA globals (state, ACTIONS,
     ICONS, audioEl, currentTrack, showToast, renderCurrentView, ...).

     NovaExt.register('my-feature-name', function (ext) {
       // 1. Add a new data-action the UI (or you) can trigger:
       // ext.action('my-action', () => { ... });
       //
       // 2. Add a header or full-player button that triggers it:
       // ext.headerButton({ action: 'my-action', title: 'My feature', svg: '<svg>...</svg>' });
       //
       // 3. Read/write shared state if useful (persisted separately —
       //    see NOVA's saveMeta()/loadFromDB() if you want your data
       //    to survive reloads through IndexedDB instead of localStorage):
       // state.myFeatureData = state.myFeatureData || {};
     });
  ================================================================== */
})();
