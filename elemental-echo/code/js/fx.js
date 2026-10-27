// 元素回响 — 特效（Canvas 粒子 / 屏幕震动）与音效（Web Audio 合成）

// ---------------- 粒子 ----------------
const P = { canvas: null, ctx: null, parts: [], running: false, max: 160 };

function loop() {
  if (!P.ctx) return;
  const ctx = P.ctx;
  ctx.clearRect(0, 0, P.canvas.width, P.canvas.height);
  for (let i = P.parts.length - 1; i >= 0; i--) {
    const p = P.parts[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += p.g; p.vx *= 0.99; p.vy *= 0.99;
    p.life -= 1;
    if (p.life <= 0) { P.parts.splice(i, 1); continue; }
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (P.parts.length > 0) requestAnimationFrame(loop);
  else { P.running = false; ctx.clearRect(0, 0, P.canvas.width, P.canvas.height); }
}

export const FX = {
  init(canvas) {
    P.canvas = canvas;
    P.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    if (!P.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.canvas.width = window.innerWidth * dpr;
    P.canvas.height = window.innerHeight * dpr;
    P.canvas.style.width = window.innerWidth + 'px';
    P.canvas.style.height = window.innerHeight + 'px';
    P.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  burst(x, y, color = '#FFC53D', count = 24, spread = 5) {
    if (!P.ctx) return;
    const n = Math.min(count, P.max - P.parts.length);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * spread + 0.6;
      P.parts.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        g: 0.08,
        size: Math.random() * 3.2 + 1.4,
        color,
        life: 26 + Math.random() * 22,
        maxLife: 48,
      });
    }
    if (!P.running) { P.running = true; requestAnimationFrame(loop); }
  },
  burstEl(el, color, count) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
  },
  shake(power = 4, ms = 240) {
    const app = document.getElementById('app');
    if (!app) return;
    app.style.setProperty('--shake', '0px');
    const start = performance.now();
    const step = (now) => {
      const t = (now - start) / ms;
      if (t >= 1) { app.style.setProperty('--shake', '0px'); return; }
      const amp = power * (1 - t);
      app.style.setProperty('--shake', `${(Math.random() * 2 - 1) * amp}px`);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
};

// ---------------- 音效 ----------------
let actx = null;
let enabled = true;

function ctx() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur, type = 'sine', gain = 0.12, slideTo = null) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}

function noise(dur = 0.12, gain = 0.08) {
  const a = ctx();
  if (!a) return;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(a.destination);
  src.start();
}

const SFX = {
  click:    () => tone(620, 0.05, 'triangle', 0.05),
  draw:     () => noise(0.06, 0.04),
  play:     () => { tone(380, 0.1, 'square', 0.06, 520); },
  reaction: () => { tone(520, 0.16, 'sawtooth', 0.08, 780); noise(0.1, 0.05); },
  burst:    () => { tone(160, 0.5, 'sine', 0.16, 60); noise(0.3, 0.1); },
  hurt:     () => { tone(140, 0.14, 'square', 0.09, 90); },
  kill:     () => { noise(0.18, 0.09); tone(300, 0.2, 'triangle', 0.07, 120); },
  coin:     () => { tone(880, 0.07, 'sine', 0.07); setTimeout(() => tone(1180, 0.08, 'sine', 0.06), 60); },
  win:      () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.09), i * 90)); },
  lose:     () => { [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.09), i * 140)); },
  error:    () => tone(180, 0.12, 'square', 0.07),
};

export const AUDIO = {
  unlock() { ctx(); },
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },
  sfx(name) {
    if (!enabled) return;
    const fn = SFX[name];
    if (fn) { try { fn(); } catch { /* 静默降级 */ } }
  },
};
