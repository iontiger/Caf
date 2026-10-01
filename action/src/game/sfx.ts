/** 효과음은 파일 없이 WebAudio로 짧게 합성한다. 첫 입력 전에는 소리가 나지 않는다 */
let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio(), { once: true });

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.12, slide = 0): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur: number, vol = 0.15): void {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const gain = a.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(a.destination);
  src.start();
}

export const sfx = {
  swing: () => tone(320, 0.08, 'triangle', 0.06, -180),
  block: () => { tone(900, 0.06, 'square', 0.05, -200); },
  hit: () => { tone(160, 0.1, 'square', 0.08, -80); noise(0.05, 0.08); },
  parry: () => { tone(1320, 0.18, 'triangle', 0.14); tone(1980, 0.22, 'sine', 0.08); },
  hurt: () => tone(220, 0.25, 'sawtooth', 0.1, -150),
  jump: () => tone(420, 0.1, 'sine', 0.05, 240),
  dodge: () => noise(0.12, 0.06),
  coin: () => { tone(988, 0.06, 'square', 0.05); setTimeout(() => tone(1319, 0.1, 'square', 0.05), 60); },
  shutter: () => { noise(0.04, 0.3); setTimeout(() => noise(0.06, 0.2), 90); },
  finisher: () => { tone(220, 0.6, 'sawtooth', 0.1, 440); noise(0.4, 0.12); },
  taunt: () => tone(660, 0.05, 'square', 0.03),
  toggleMute: () => { muted = !muted; return muted; },
};
