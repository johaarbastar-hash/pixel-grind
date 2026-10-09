// Web Audio. M1 only unlocks the AudioContext on the first tap (browsers keep
// audio suspended until a user gesture). SFX and music arrive in M5.

let ctx = null;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // A silent one-sample buffer finishes the unlock on older iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
    unlocked = ctx.state === 'running';
  } catch {
    // No audio: the game works without it.
  }
}

export function audioContext() {
  return ctx;
}
