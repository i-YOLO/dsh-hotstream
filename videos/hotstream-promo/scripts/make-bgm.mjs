// Procedural BGM for the Hotstream promo — pure code, no samples.
// 120 BPM, A minor (Am – F – C – G), 18 bars = 36 s. Every scene cut lands on a bar line.
//   bars 0–1   hook: ticker clicks + filtered pad + noise riser, a one-beat gap, then the drop
//   bars 2–13  groove: four-on-the-floor, side-chained bass + supersaw pad, pluck arp from bar 4
//   bars 14–15 groove → build (snare roll + riser) into the CTA
//   bars 16–17 CTA: drop hit, one bar of groove, final chord rings out
// Usage: node scripts/make-bgm.mjs assets/audio/bgm.wav
import { writeFileSync } from "node:fs";

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const DUR = 36;
const N = Math.round(SR * DUR);

// Seeded PRNG so the file is reproducible.
let seed = 0x9e3779b9;
const rand = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 4294967296) * 2 - 1;
};

const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus();
const music = bus(); // side-chained
const fx = bus();
const send = bus(); // reverb send

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function biquad(type, f, q = 0.707) {
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
  const c = Math.cos(w);
  const a = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === "lp") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
  else if (type === "hp") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  else [b0, b1, b2] = [a, 0, -a]; // band-pass
  const a0 = 1 + a;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function setBiquad(st, type, f, q) {
  const n = biquad(type, f, q);
  st.b0 = n.b0; st.b1 = n.b1; st.b2 = n.b2; st.a1 = n.a1; st.a2 = n.a2;
}
function runBiquad(st, x) {
  const y = st.b0 * x + st.b1 * st.x1 + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2;
  st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y;
  return y;
}

// PolyBLEP saw
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

function add(b, i, l, r = l) {
  if (i >= 0 && i < N) { b.L[i] += l; b.R[i] += r; }
}

// ---------- instruments ----------
function kick(t0, gain = 1) {
  const s = Math.round(t0 * SR);
  let ph = 0;
  for (let k = 0; k < SR * 0.5; k++) {
    const t = k / SR;
    const f = 44 + 120 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.32);
    let v = Math.sin(ph) * env;
    if (t < 0.004) v += rand() * 0.5 * (1 - t / 0.004);
    v = Math.tanh(v * 1.6) * 0.9 * gain;
    add(drums, s + k, v);
  }
}

function clap(t0, gain = 1) {
  const s = Math.round(t0 * SR);
  const bp = biquad("bp", 1400, 0.9);
  for (let k = 0; k < SR * 0.35; k++) {
    const t = k / SR;
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / (o === 0.022 ? 0.13 : 0.008)));
    const v = runBiquad(bp, rand()) * env * 1.6 * gain;
    add(drums, s + k, v * 0.9, v);
    add(send, s + k, v * 0.35);
  }
}

function hat(t0, open = false, gain = 1) {
  const s = Math.round(t0 * SR);
  const hp = biquad("hp", 7500, 0.8);
  const dec = open ? 0.12 : 0.025;
  for (let k = 0; k < SR * (open ? 0.4 : 0.1); k++) {
    const t = k / SR;
    const v = runBiquad(hp, rand()) * Math.exp(-t / dec) * gain;
    add(drums, s + k, v * (open ? 0.8 : 1), v * (open ? 1 : 0.8));
  }
}

function snare(t0, gain = 1) {
  const s = Math.round(t0 * SR);
  const bp = biquad("bp", 1900, 0.7);
  let ph = 0;
  for (let k = 0; k < SR * 0.2; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (185 + 60 * Math.exp(-t / 0.02))) / SR;
    const v = (runBiquad(bp, rand()) * 1.3 * Math.exp(-t / 0.06) + Math.sin(ph) * 0.4 * Math.exp(-t / 0.04)) * gain;
    add(drums, s + k, v);
    add(send, s + k, v * 0.2);
  }
}

function crash(t0, gain = 1, len = 2.2) {
  const s = Math.round(t0 * SR);
  const hp = biquad("hp", 4200, 0.6);
  for (let k = 0; k < SR * len; k++) {
    const t = k / SR;
    const v = runBiquad(hp, rand()) * Math.exp(-t / (len * 0.35)) * 0.55 * gain;
    add(fx, s + k, v * (0.8 + 0.2 * Math.sin(t * 9)), v * (0.8 + 0.2 * Math.cos(t * 9)));
    add(send, s + k, v * 0.3);
  }
}

function boom(t0, gain = 1) {
  const s = Math.round(t0 * SR);
  let ph = 0;
  const lp = biquad("lp", 400, 0.7);
  for (let k = 0; k < SR * 1.8; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (28 + 52 * Math.exp(-t / 0.25))) / SR;
    const v = (Math.sin(ph) * Math.exp(-t / 0.7) + runBiquad(lp, rand()) * 0.6 * Math.exp(-t / 0.18)) * gain;
    add(fx, s + k, Math.tanh(v * 1.4) * 0.9);
  }
}

function tick(t0, gain = 1) {
  const s = Math.round(t0 * SR);
  for (let k = 0; k < SR * 0.02; k++) {
    const t = k / SR;
    const v = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t / 0.004) * gain;
    add(fx, s + k, v * 0.7, v);
  }
}

function riser(t0, t1, gain = 1) {
  const s = Math.round(t0 * SR);
  const len = Math.round((t1 - t0) * SR);
  const bp = biquad("bp", 300, 2);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const p = k / len;
    if (k % 64 === 0) setBiquad(bp, "bp", 300 * Math.pow(25, p), 2.2);
    ph += (2 * Math.PI * (180 * Math.pow(6, p * p))) / SR;
    const env = Math.pow(p, 1.6) * gain;
    const v = runBiquad(bp, rand()) * 2.2 * env + Math.sin(ph) * 0.12 * env;
    add(fx, s + k, v * (1 - 0.3 * p), v);
    add(send, s + k, v * 0.25);
  }
}

// supersaw note into a given bus with a static or swept low-pass
function supersaw(b, t0, dur, midis, gain, cutoff, cutoff2 = cutoff, attack = 0.03, release = 0.35) {
  const s = Math.round(t0 * SR);
  const len = Math.round((dur + release) * SR);
  const detune = [-0.11, -0.06, -0.02, 0, 0.02, 0.06, 0.11];
  for (const m of midis) {
    const voices = detune.map((d, i) => ({ f: mtof(m + d), ph: (i * 0.137) % 1, pan: (i / (detune.length - 1)) * 2 - 1 }));
    const lpL = biquad("lp", cutoff, 0.8);
    const lpR = biquad("lp", cutoff, 0.8);
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      if (k % 128 === 0 && cutoff2 !== cutoff) {
        const c = cutoff * Math.pow(cutoff2 / cutoff, Math.min(1, t / dur));
        setBiquad(lpL, "lp", c, 0.8);
        setBiquad(lpR, "lp", c, 0.8);
      }
      let l = 0, r = 0;
      for (const v of voices) {
        const dt = v.f / SR;
        v.ph += dt;
        if (v.ph >= 1) v.ph -= 1;
        const x = 2 * v.ph - 1 - blep(v.ph, dt);
        l += x * (1 - v.pan) * 0.5;
        r += x * (1 + v.pan) * 0.5;
      }
      const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / (release / 3)) : 1);
      const g = (gain / voices.length) * env;
      const yl = runBiquad(lpL, l) * g;
      const yr = runBiquad(lpR, r) * g;
      add(b, s + k, yl, yr);
      add(send, s + k, (yl + yr) * 0.15);
    }
  }
}

function bassNote(t0, dur, midi, gain = 1) {
  const s = Math.round(t0 * SR);
  const len = Math.round((dur + 0.05) * SR);
  const f = mtof(midi);
  const lp = biquad("lp", 900, 1.1);
  let ph = 0, ph2 = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    if (k % 64 === 0) setBiquad(lp, "lp", 280 + 1100 * Math.exp(-t / 0.06), 1.1);
    const dt = f / SR;
    ph += dt; if (ph >= 1) ph -= 1;
    ph2 += (f * 0.5) / SR; if (ph2 >= 1) ph2 -= 1;
    const saw = 2 * ph - 1 - blep(ph, dt);
    const env = Math.min(1, t / 0.004) * (t > dur ? Math.exp(-(t - dur) / 0.015) : 1);
    const v = (runBiquad(lp, saw) * 0.7 + Math.sin(2 * Math.PI * ph2) * 0.6) * env * gain;
    add(music, s + k, v);
  }
}

const pluckDelay = []; // collected for a ping-pong delay pass
function pluck(t0, midi, gain = 1) {
  const s = Math.round(t0 * SR);
  const f = mtof(midi);
  const lp = biquad("lp", 5000, 1.2);
  let ph = 0, ph2 = 0.3;
  for (let k = 0; k < SR * 0.4; k++) {
    const t = k / SR;
    if (k % 32 === 0) setBiquad(lp, "lp", 500 + 5200 * Math.exp(-t / 0.05), 1.2);
    const dt = f / SR;
    ph += dt; if (ph >= 1) ph -= 1;
    ph2 += (f * 1.005) / SR; if (ph2 >= 1) ph2 -= 1;
    const x = (2 * ph - 1 - blep(ph, dt)) * 0.5 + (ph2 < 0.5 ? 0.35 : -0.35);
    const v = runBiquad(lp, x) * Math.exp(-t / 0.13) * Math.min(1, t / 0.002) * gain;
    add(music, s + k, v);
    pluckDelay.push([s + k, v]);
  }
}

// ---------- arrangement ----------
const CH = [
  { pad: [57, 60, 64, 69], root: 33, arp: [69, 72, 76, 81] }, // Am
  { pad: [53, 57, 60, 65], root: 29, arp: [65, 69, 72, 77] }, // F
  { pad: [55, 60, 64, 67], root: 36, arp: [67, 72, 76, 79] }, // C
  { pad: [55, 59, 62, 67], root: 31, arp: [67, 71, 74, 79] }, // G
];
const chordAt = (bar) => CH[bar % 4];
const kicks = [];

// Hook (0–4 s): ticker clicks accelerate, pad opens, riser, one-beat gap.
for (let i = 0; i < 30; i++) {
  const t = i * (BEAT / 4);
  if (t >= 3.75) break;
  tick(t, 0.18 + 0.25 * (t / 3.75));
}
supersaw(music, 0, BAR - 0.05, CH[0].pad, 0.32, 260, 1400, 0.4, 0.2);
supersaw(music, BAR, BAR - 0.25, CH[1].pad, 0.4, 1400, 3600, 0.02, 0.1);
bassNote(0, 3.7, 33, 0.16); // A1 drone, quiet so the drop has room
riser(1.25, 3.75, 0.8);
kick(2.0, 0.55);
kick(3.0, 0.6);
kick(3.25, 0.5);
kick(3.5, 0.65);

// Drop at 4 s.
boom(4.0, 1);
crash(4.0, 1);

const GROOVE_END = 30; // bars 2..14.x full groove; 30–32 build
for (let bar = 2; bar < 18; bar++) {
  const t0 = bar * BAR;
  const ch = chordAt(bar);
  const isBuild = bar === 15;
  const isOutro = bar === 17;

  // Kicks (four on the floor), dropped during the build and the outro tail.
  if (!isBuild && !isOutro) {
    for (let b = 0; b < 4; b++) { kick(t0 + b * BEAT); kicks.push(t0 + b * BEAT); }
  }
  if (isOutro) { kick(t0, 1); kicks.push(t0); }

  // Clap on 2 & 4
  if (!isBuild && !isOutro) { clap(t0 + BEAT, 0.8); clap(t0 + 3 * BEAT, 0.8); }

  // Hats
  if (!isOutro) {
    for (let s16 = 0; s16 < 16; s16++) {
      const t = t0 + s16 * (BEAT / 4);
      if (s16 % 4 === 2) hat(t, true, 0.28);
      else hat(t, false, s16 % 2 ? 0.16 : 0.1);
    }
  }

  // Bass: 8ths, root / octave bounce
  if (!isOutro) {
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * (BEAT / 2);
      const m = ch.root + (e % 4 === 3 ? 12 : 0) + 12;
      bassNote(t, BEAT / 2 - 0.04, m, 0.42);
    }
  } else {
    bassNote(t0, 1.6, CH[0].root + 12, 0.5);
  }

  // Pad
  if (isOutro) supersaw(music, t0, 1.2, CH[0].pad.concat([76]), 0.75, 3200, 900, 0.01, 1.6);
  else supersaw(music, t0, BAR - 0.02, ch.pad, isBuild ? 0.55 : 0.62, isBuild ? 900 : 2600, isBuild ? 4200 : 2600, 0.01, 0.08);

  // Pluck arp from bar 4 (8 s); octave up for 20–28 s.
  if (bar >= 4 && !isOutro) {
    const oct = bar >= 10 && bar < 14 ? 12 : 0;
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2];
    for (let s16 = 0; s16 < 16; s16++) {
      if (isBuild && s16 % 2) continue;
      pluck(t0 + s16 * (BEAT / 4), ch.arp[pattern[s16]] + oct, bar >= 10 ? 0.24 : 0.2);
    }
  }

  // Fills on the last beat before scene cuts (every 2 bars).
  if (bar % 2 === 1 && !isBuild && !isOutro && bar < 15) {
    for (let i = 0; i < 4; i++) snare(t0 + 3 * BEAT + i * (BEAT / 4), 0.35 + i * 0.12);
  }
  // Crash on every scene downbeat.
  if (bar % 2 === 0 && bar !== 2) crash(t0, bar === 16 ? 1 : 0.55, bar === 16 ? 3 : 1.6);
}

// Build 30–32: accelerating snare roll + riser.
for (let i = 0; i < 16; i++) snare(30 + i * (BEAT / 4), 0.25 + 0.04 * i);
for (let i = 0; i < 8; i++) snare(31 + i * (BEAT / 8), 0.6 + 0.04 * i);
riser(29.6, 32, 0.9);
boom(32, 1.05);
// Final stab
supersaw(music, 34, 0.2, [69, 72, 76, 81], 0.6, 4000, 1200, 0.005, 1.4);
boom(34, 0.55);
crash(34, 0.6, 2);

// ---------- mix ----------
// Side-chain the music bus to the kicks.
const sc = new Float32Array(N).fill(1);
for (const tk of kicks) {
  const s = Math.round(tk * SR);
  for (let k = 0; k < SR * 0.4; k++) {
    const t = k / SR;
    const g = 1 - 0.75 * Math.exp(-t / 0.1) * Math.min(1, t / 0.004 + 0.6);
    if (s + k < N) sc[s + k] = Math.min(sc[s + k], g);
  }
}

// Ping-pong delay for plucks (dotted 8th).
const dly = Math.round(BEAT * 0.75 * SR);
const dl = new Float32Array(N);
for (const [i, v] of pluckDelay) if (i < N) dl[i] += v;
const tapL = new Float32Array(N), tapR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = i - dly >= 0 ? dl[i - dly] + tapR[i - dly] * 0.42 : 0;
  const b = i - dly >= 0 ? tapL[i - dly] * 0.42 : 0;
  tapL[i] = a; tapR[i] = b;
}

// Schroeder reverb on the send bus.
function reverb(x) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) {
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.7 + c.lp * 0.3;
      c.buf[c.i] = x[n] + c.lp * 0.82;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    for (const a of aps) {
      const o = a.buf[a.i];
      const v = -0.5 * y + o;
      a.buf[a.i] = y + 0.5 * o;
      a.i = (a.i + 1) % a.d;
      y = v;
    }
    out[n] = y * 0.25;
  }
  return out;
}
const revL = reverb(send.L);
const revR = reverb(send.R.map((v, i) => (i > 300 ? send.R[i - 300] : 0)));

const [DRUM, MUSIC, FX, REV] = [0.55, 0.32, 0.45, 0.5];
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const g = sc[i];
  L[i] = drums.L[i] * DRUM + (music.L[i] + tapL[i] * 0.45) * g * MUSIC + fx.L[i] * FX + revL[i] * REV;
  R[i] = drums.R[i] * DRUM + (music.R[i] + tapR[i] * 0.45) * g * MUSIC + fx.R[i] * FX + revR[i] * REV;
}
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
console.log("bus rms", { drums: rms(drums.L).toFixed(3), music: rms(music.L).toFixed(3), fx: rms(fx.L).toFixed(3), rev: rms(revL).toFixed(3), pre: rms(L).toFixed(3) }, "pre-peak", L.reduce((m, v) => Math.max(m, Math.abs(v)), 0).toFixed(2));

// Master: gentle high-pass on the very low end, soft clip, fade out the last 0.6 s, normalize.
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t > DUR - 0.6 ? Math.max(0, (DUR - t) / 0.6) : 1;
  L[i] = Math.tanh(L[i]) * fade;
  R[i] = Math.tanh(R[i]) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * norm * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * norm * 32767))), 46 + i * 4);
}
const out = process.argv[2] ?? "assets/audio/bgm.wav";
writeFileSync(out, buf);
console.log(`wrote ${out} — ${DUR}s @ ${BPM} BPM, peak normalised from ${peak.toFixed(3)}`);
