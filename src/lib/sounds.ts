let _ctx: AudioContext | null = null;
let _enabled = true;

const STORAGE_KEY = 'coachpro:sound-enabled';
try {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === '0') _enabled = false;
} catch {}

export const isSoundEnabled = () => _enabled;
export const setSoundEnabled = (on: boolean) => {
  _enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
};

const ctx = (): AudioContext | null => {
  if (!_enabled) return null;
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  try {
    const Ctor: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
  } catch {
    return null;
  }
  return _ctx;
};

const tone = (freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.04) => {
  const c = ctx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume().catch(() => {});
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000);
  } catch {}
};

/** Soft "tap" for primary button clicks. */
export const playClick = () => tone(880, 60, 'triangle', 0.03);
/** Confirmation chime when something completes successfully. */
export const playSuccess = () => {
  tone(660, 90, 'sine', 0.04);
  setTimeout(() => tone(880, 120, 'sine', 0.04), 80);
};
/** Two-step "ding" for new notifications/messages. */
export const playNotify = () => {
  tone(740, 110, 'sine', 0.05);
  setTimeout(() => tone(988, 140, 'sine', 0.05), 110);
};
/** Low warning tone for errors / blocked actions. */
export const playError = () => tone(220, 180, 'sawtooth', 0.04);
