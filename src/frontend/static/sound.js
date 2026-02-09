// sound.js — reusable Web Audio beep

export function playBeep(frequency = 432, duration = 0.2, type = 'sine') {
  try {
    // Validate parameters to prevent audio errors
    if (!Number.isFinite(frequency) || frequency <= 0) {
      frequency = 432; // fallback to default
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = 0.2; // fallback to default
    }
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.1, ctx.currentTime); // subtle volume
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (error) {
    // Silently handle audio errors to prevent breaking upload flow
    console.warn('[SOUND] Audio beep failed:', error.message);
  }
}
