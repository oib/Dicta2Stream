// sound.js — reusable Web Audio beep

export function playBeep(frequency = 432, duration = 0.2, type = 'sine') {
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
}
