// Pointer Events (touch, mouse and pen share one path) + keyboard -> actions.
// Actions are queued and drained once per simulation tick, so gameplay stays
// on the fixed timestep.
//   'press'   finger / button / Space down (ollie in play; arms menu confirm)
//   'release' finger / button / Space up (confirms menus)
//   'flipL' 'flipR' 'flipU' 'flipD'   swipe or arrow key
//   'pause'   P or Esc
//   'debug'   backtick
//   'tune'    T (tuning panel, debug mode only)
//
// Swipes: touching the screen pops; the direction you swipe picks the flip.
// A swipe counts the moment the finger has moved swipeDistance CSS px within
// swipeTime of touching down, without waiting for the lift. One flip per touch.

// Elements marked data-ui (error box, tuning panel) are not part of the game.
function isUiTarget(e) {
  const t = e.target;
  return !!(t && t.closest && t.closest('[data-ui]'));
}

function isFormField(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON'));
}

export function createInput(cfg) {
  let queue = [];
  let spare = [];
  const touches = new Map(); // pointerId -> { x, y, t, done }

  const api = {
    // Called synchronously inside events that grant user activation, for things
    // browsers only allow then (fullscreen, orientation lock, audio unlock).
    onGesture: null,
    drain() {
      const out = queue;
      queue = spare;
      spare = out;
      queue.length = 0;
      return out;
    },
  };

  const push = (a) => queue.push(a);
  const gesture = (e) => {
    if (api.onGesture) api.onGesture(e);
  };

  function checkSwipe(tr, e) {
    if ((e.timeStamp - tr.t) / 1000 > cfg.input.swipeTime) {
      tr.done = true;
      return;
    }
    const dx = e.clientX - tr.x;
    const dy = e.clientY - tr.y;
    const min = cfg.input.swipeDistance;
    if (dx * dx + dy * dy < min * min) return;
    tr.done = true;
    if (Math.abs(dx) >= Math.abs(dy)) push(dx < 0 ? 'flipL' : 'flipR');
    else push(dy < 0 ? 'flipU' : 'flipD');
  }

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (isUiTarget(e)) return;
      e.preventDefault();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, done: false });
      push('press');
      // Mouse presses grant user activation; touch only does on release.
      if (e.pointerType === 'mouse') gesture(e);
    },
    { passive: false },
  );

  window.addEventListener('pointermove', (e) => {
    const tr = touches.get(e.pointerId);
    if (tr && !tr.done) checkSwipe(tr, e);
  });

  window.addEventListener(
    'pointerup',
    (e) => {
      const tr = touches.get(e.pointerId);
      if (!tr) return; // started on a UI element, or not the main button
      touches.delete(e.pointerId);
      if (!tr.done) checkSwipe(tr, e);
      e.preventDefault();
      if (e.pointerType !== 'mouse') gesture(e);
      push('release');
    },
    { passive: false },
  );

  window.addEventListener('pointercancel', (e) => {
    touches.delete(e.pointerId);
  });

  window.addEventListener('keydown', (e) => {
    if (isFormField(e)) return;
    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault();
        if (!e.repeat) {
          push('press');
          gesture(e);
        }
        break;
      // On the ground an arrow is ollie + flip, same as a swipe.
      case 'ArrowLeft':
        e.preventDefault();
        if (!e.repeat) push('flipL');
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!e.repeat) push('flipR');
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!e.repeat) push('flipU');
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!e.repeat) push('flipD');
        break;
      case 'KeyP':
      case 'Escape':
        if (!e.repeat) push('pause');
        break;
      case 'Backquote':
        if (!e.repeat) push('debug');
        break;
      case 'KeyT':
        if (!e.repeat) push('tune');
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isFormField(e)) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      push('release');
    }
  });

  // Browser lock-down that CSS alone doesn't cover everywhere.
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('selectstart', (e) => {
    if (!isUiTarget(e)) e.preventDefault();
  });
  window.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (!isUiTarget(e)) e.preventDefault();
    },
    { passive: false },
  );
  // iOS Safari pinch-zoom
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

  return api;
}
