// Pointer Events (touch, mouse and pen share one path) + keyboard -> actions.
// Actions are queued and drained once per simulation tick, so gameplay stays
// on the fixed timestep.
//   'press'   finger / button / Space down (ollie in play; arms menu confirm)
//   'release' finger / button / Space up (confirms menus)
//   'pause'   P or Esc
//   'debug'   backtick
// Swipes and flip keys arrive in M2.

export function createInput() {
  let queue = [];
  let spare = [];
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

  window.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      push('press');
      // Mouse presses grant user activation; touch only does on release.
      if (e.pointerType === 'mouse') gesture(e);
    },
    { passive: false },
  );

  window.addEventListener(
    'pointerup',
    (e) => {
      e.preventDefault();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType !== 'mouse') gesture(e);
      push('release');
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault();
        if (!e.repeat) {
          push('press');
          gesture(e);
        }
        break;
      case 'KeyP':
      case 'Escape':
        if (!e.repeat) push('pause');
        break;
      case 'Backquote':
        if (!e.repeat) push('debug');
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault(); // flips in M2; never scroll the page
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      push('release');
    }
  });

  // Browser lock-down that CSS alone doesn't cover everywhere.
  const notErrorBox = (e) => !(e.target && e.target.closest && e.target.closest('#errbox'));
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('selectstart', (e) => {
    if (notErrorBox(e)) e.preventDefault();
  });
  window.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (notErrorBox(e)) e.preventDefault();
    },
    { passive: false },
  );
  // iOS Safari pinch-zoom
  window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

  return api;
}
