// Fullscreen, landscape lock and orientation. Android Chrome supports both;
// iPhone Safari supports neither for web pages, so every call fails quietly.

const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;

export function isTouchDevice() {
  return !!(coarse && coarse.matches);
}

// Portrait only matters on phones; a tall desktop window just letterboxes.
export function isPortrait() {
  return isTouchDevice() && window.innerHeight > window.innerWidth;
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function lockLandscape() {
  const o = screen.orientation;
  if (o && typeof o.lock === 'function') {
    return o.lock('landscape').catch(() => {});
  }
  return undefined;
}

let pending = false;

// Must be called from inside a user-activation event (see input.js onGesture).
export function enterFullscreenLandscape() {
  if (pending) return;
  if (isFullscreen()) {
    lockLandscape();
    return;
  }
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  pending = true;
  let result;
  try {
    result = request.call(el, { navigationUI: 'hide' });
  } catch {
    pending = false;
    return;
  }
  Promise.resolve(result)
    .then(lockLandscape)
    .catch(() => {})
    .finally(() => {
      pending = false;
    });
}
