/* =====================================================================
   NOVA FEATURES 2 — nova-features-2.js
   ---------------------------------------------------------------------
   Adds four things on top of NOVA, none of which touch index.html or
   nova-extensions.js:

     1. standalone-library-playback  — playing a track from the Library
        tab plays ONLY that track (doesn't queue/auto-advance through
        the rest of the library). Albums, Playlists, Favorites, Queue
        and History still play through their own track list as before.
     2. fullscreen-toggle            — a fullscreen button on the full
        player (uses the real browser Fullscreen API).
     3. landscape-player-layout      — when the full player is open and
        the phone is rotated to landscape, the cover art moves to the
        left and all the controls stack on the right.
     4. single-repeat                — pressing the repeat button into
        its "repeat one" state now repeats the current song exactly
        ONE more time, then automatically switches repeat back off,
        instead of looping the song forever.

   LOAD ORDER (add before </body>, after the main NOVA script):

     <link rel="stylesheet" href="nova-extensions.css">
     <script src="nova-extensions.js"></script>
     <link rel="stylesheet" href="nova-features-2.css">
     <script src="nova-features-2.js"></script>
     </body>

   This file requires nova-extensions.js to already be loaded (it uses
   the NovaExt plugin API from that file: action(), fullPlayerButton(),
   register(), toast()).
   ===================================================================== */
(function () {
  'use strict';

  if (typeof window.NovaExt === 'undefined') {
    console.error('[NovaFeatures2] nova-extensions.js must be loaded before nova-features-2.js. Aborting.');
    return;
  }
  if (typeof state === 'undefined' || typeof ACTIONS === 'undefined') {
    console.error('[NovaFeatures2] Must be loaded after the main NOVA <script> block. Aborting.');
    return;
  }

  const NovaExt = window.NovaExt;

  /* ==================================================================
     1. STANDALONE LIBRARY PLAYBACK
     ------------------------------------------------------------------
     NOVA's built-in playFromContext() queues the *entire* filtered
     library when you tap a track from the Library tab, so playback
     auto-advances into whatever song is next in the list. This wraps
     that function: for the 'library' context specifically, it starts
     a one-track queue instead. Every other context (album:, playlist:,
     favorites, queue, history) is passed straight through to NOVA's
     original logic, unchanged.
  ================================================================== */
  NovaExt.register('standalone-library-playback', function (ext) {
    if (typeof playFromContext !== 'function' || typeof playContext !== 'function') {
      console.warn('[NovaFeatures2] standalone-library-playback: required NOVA functions not found.');
      return;
    }
    const originalPlayFromContext = playFromContext;

    window.playFromContext = function (context, trackId) {
      if (context === 'library') {
        playContext([trackId], 0, 'library');
        return;
      }
      return originalPlayFromContext(context, trackId);
    };
  });

  /* ==================================================================
     2. FULLSCREEN TOGGLE
  ================================================================== */
  NovaExt.register('fullscreen-toggle', function (ext) {
    const EXPAND_ICON =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
      '<path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
    const COMPRESS_ICON =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>' +
      '<path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

    function fsElement() {
      return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
    }
    function requestFs(el) {
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (fn) return fn.call(el);
      return null;
    }
    function exitFs() {
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (fn) return fn.call(document);
      return null;
    }
    function updateIcon() {
      const btn = document.getElementById('ext-fullscreen-btn');
      if (btn) btn.innerHTML = fsElement() ? COMPRESS_ICON : EXPAND_ICON;
    }

    ext.action('ext-toggle-fullscreen', function () {
      if (fsElement()) {
        exitFs();
        return;
      }
      const target = document.getElementById('full-player') || document.documentElement;
      const p = requestFs(target);
      if (p && p.catch) p.catch(() => ext.toast('Fullscreen is not available in this browser'));
      if (!p) ext.toast('Fullscreen is not available in this browser');
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, updateIcon);
    });

    const btn = ext.fullPlayerButton({ action: 'ext-toggle-fullscreen', title: 'Fullscreen', svg: EXPAND_ICON });
    if (btn) btn.id = 'ext-fullscreen-btn';
  });

  /* ==================================================================
     3. LANDSCAPE FULL-PLAYER LAYOUT
     ------------------------------------------------------------------
     Toggles an `is-landscape` class on #full-player when the viewport
     is a phone-shaped landscape (short + wide). The actual repositioning
     lives in nova-features-2.css as a CSS Grid reflow — this script's
     job is just deciding *when* that class should be on, and asking
     NOVA to resize its visualizer canvas after the layout settles.
  ================================================================== */
  NovaExt.register('landscape-player-layout', function () {
    const mq = window.matchMedia('(orientation: landscape)');

    function apply() {
      const fp = document.getElementById('full-player');
      if (!fp) return;
      // innerHeight cap keeps this targeted at phones in landscape,
      // not landscape tablets/desktop windows where the stock layout
      // already has plenty of room.
      const isPhoneLandscape = mq.matches && window.innerHeight <= 560;
      fp.classList.toggle('is-landscape', isPhoneLandscape);
      if (typeof resizeVisualizerCanvas === 'function') {
        setTimeout(resizeVisualizerCanvas, 260); // after the layout/paint settles
      }
    }

    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply); // Safari <14 fallback

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    apply();
  });

  /* ==================================================================
     4. SINGLE REPEAT ("repeat once" instead of infinite loop)
     ------------------------------------------------------------------
     NOVA's repeat button cycles off -> all -> one, and its built-in
     'one' mode restarts the same song forever. This keeps that same
     button and 3-state cycle, but changes what 'one' means: as soon
     as the song finishes and restarts because of it, repeat is
     switched back to 'off' automatically — so one press really does
     mean "play this song one more time."

     Implementation note: NOVA already attaches an 'ended' listener to
     the audio element during its own init(). This adds a second
     'ended' listener (registered after, so it always runs after
     NOVA's own handler has already restarted the track) that just
     disarms repeat once that one extra play has been kicked off.
  ================================================================== */
  NovaExt.register('single-repeat', function (ext) {
    if (typeof audioEl === 'undefined' || !audioEl) {
      console.warn('[NovaFeatures2] single-repeat: audioEl not found.');
      return;
    }

    audioEl.addEventListener('ended', function () {
      if (state.repeatMode === 'one') {
        state.repeatMode = 'off';
        if (typeof updateControlsUI === 'function') updateControlsUI();
        if (typeof saveMeta === 'function') saveMeta();
        ext.toast('Repeated once — repeat is now off');
      }
    });
  });
})();
