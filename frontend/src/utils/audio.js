/**
 * Audio Alert Utility for WorkLink
 * Plays a distinct, loud, pleasant attention chime when a new job offer arrives for a worker.
 * Built using the Web Audio API for zero dependencies and zero network lag.
 */

let globalAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!globalAudioCtx) {
    globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

// Pre-unlock audio on any user interaction so subsequent automatic alerts play unblocked
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export function playWorkOfferSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playTone = (freq, startTime, duration = 0.22, vol = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // rich, bell-like tone
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      // Volume envelope
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // First Chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> High C6 (1046Hz)
    playTone(523.25, 0.0, 0.2, 0.4);
    playTone(659.25, 0.16, 0.2, 0.4);
    playTone(783.99, 0.32, 0.22, 0.45);
    playTone(1046.50, 0.48, 0.45, 0.5);

    // Second Chime (Repeating echo after 0.8s so worker definitely notices)
    playTone(523.25, 0.85, 0.2, 0.4);
    playTone(659.25, 1.01, 0.2, 0.4);
    playTone(783.99, 1.17, 0.22, 0.45);
    playTone(1046.50, 1.33, 0.55, 0.55);

    // Mobile vibration pattern: [buzz, pause, buzz, pause, long buzz]
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([250, 100, 250, 100, 450]);
    }
  } catch (err) {
    console.warn('[WorkLink Notification Sound Error]:', err);
  }
}

export default playWorkOfferSound;
