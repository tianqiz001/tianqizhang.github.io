/*
 * Port of Mercu's SuperCollider patch to an AudioWorklet:
 *
 *   Ndef(\sound2, { LatoocarfianC.ar(
 *       [8050 + {LFNoise2.kr(10).range(-5, 5)}, 9000 + {LFNoise2.kr(10).range(-5, 5)}],
 *       1, 3 + LFNoise1.kr(0.3).range(-1, 1),
 *       0.5 + LFTri.kr(100).range(-0.5, 0.5), 0.5, 0.5, 0.5) * 0.035 });
 *
 * The UGens follow SuperCollider's own source (ChaosUGens.cpp, LFUGens.cpp, NoiseUGens.cpp):
 * control-rate inputs are updated once per 64-sample block like scsynth, and LatoocarfianC
 * uses the same cubic interpolation between iterations of the map.
 *
 * Extra live controls (all neutral = the original patch):
 *   pan      -1..1   stereo balance (Balance2-style, unity at centre)
 *   freqMul  >0      multiplies both LatoocarfianC frequencies
 *   mod      0..1    pointer speed: speeds up the LFTri on c and widens the c and b wobble
 *   gate     0/1     fade in/out
 */
const BLOCK = 64; // scsynth's default control period

const frand2 = () => Math.random() * 2 - 1;

class LFNoise1 { // linear-interpolated random, control rate
  constructor(freq) { this.freq = freq; this.level = frand2(); this.slope = 0; this.counter = 0; }
  next(ctlRate) {
    if (this.counter <= 0) {
      this.counter = Math.max(1, Math.round(ctlRate / Math.max(this.freq, 0.001)));
      this.slope = (frand2() - this.level) / this.counter;
    }
    this.counter--;
    this.level += this.slope;
    return this.level;
  }
}

class LFNoise2 { // quadratic-interpolated random, control rate (same recurrence as SC)
  constructor(freq) {
    this.freq = freq; this.level = 0; this.slope = 0; this.curve = 0; this.counter = 0;
    this.nextValue = frand2(); this.nextMidPt = this.nextValue * 0.5;
  }
  next(ctlRate) {
    if (this.counter <= 0) {
      const value = this.nextValue;
      this.nextValue = frand2();
      this.level = this.nextMidPt;
      this.nextMidPt = (this.nextValue + value) * 0.5;
      this.counter = Math.max(2, Math.round(ctlRate / Math.max(this.freq, 0.001)));
      const seg = this.counter;
      this.curve = 2 * (this.nextMidPt - this.level - seg * this.slope) / (seg * seg + seg);
    }
    this.counter--;
    this.slope += this.curve;
    this.level += this.slope;
    return Math.max(-1, Math.min(1, this.level));
  }
}

class LFTri { // SC phase convention: starts at 0, rising
  constructor() { this.phase = 0; }
  next(freq, rate) {
    const p = this.phase;
    const z = p > 1 ? 2 - p : p;
    this.phase += 4 * freq / rate;
    while (this.phase >= 3) this.phase -= 4;
    return z;
  }
}

class LatoocarfianC {
  constructor(xi, yi) {
    this.xn = xi; this.yn = yi;
    this.xnm1 = xi; this.xnm2 = xi; this.xnm3 = xi;
    this.counter = 0; this.frac = 0;
    this.c0 = xi; this.c1 = 0; this.c2 = 0; this.c3 = 0;
  }
  // fills out[off .. off+n) with block-constant parameters, like ZIN0 in scsynth
  run(out, off, n, freq, a, b, c, d, sr) {
    let spc, slope;
    if (freq < sr) { spc = sr / Math.max(freq, 0.001); slope = 1 / spc; }
    else { spc = 1; slope = 1; }
    let { xn, yn, xnm1, xnm2, xnm3, counter, frac, c0, c1, c2, c3 } = this;
    for (let i = 0; i < n; i++) {
      if (counter >= spc) {
        counter -= spc;
        frac = 0;
        xnm3 = xnm2; xnm2 = xnm1; xnm1 = xn;
        const xPrev = xn;
        xn = Math.sin(b * yn) + c * Math.sin(b * xPrev);
        yn = Math.sin(a * xPrev) + d * Math.sin(a * yn);
        c0 = xnm2;
        c1 = 0.5 * (xnm1 - xnm3);
        c2 = xnm3 - 2.5 * xnm2 + xnm1 + xnm1 - 0.5 * xn;
        c3 = 0.5 * (xn - xnm3) + 1.5 * (xnm2 - xnm1);
      }
      counter++;
      out[off + i] = ((c3 * frac + c2) * frac + c1) * frac + c0;
      frac += slope;
    }
    Object.assign(this, { xn, yn, xnm1, xnm2, xnm3, counter, frac, c0, c1, c2, c3 });
  }
}

class MercuSound2 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'gate', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'freqMul', defaultValue: 1, minValue: 0.05, maxValue: 8, automationRate: 'k-rate' },
      { name: 'mod', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.osc = [new LatoocarfianC(0.5, 0.5), new LatoocarfianC(0.5, 0.5)];
    this.jit = [new LFNoise2(10), new LFNoise2(10)];
    this.bNoise = new LFNoise1(0.3);
    this.tri = new LFTri();
    this.buf = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
    this.pos = BLOCK; // samples already consumed from buf
    // smoothed controls
    this.s = { gate: 0, pan: 0, freqMul: 1, mod: 0 };
    this.freqs = [8050, 9000];
    this.lastJ = [0, 0];
  }
  controlBlock(p) {
    const s = this.s, sr = sampleRate, ctl = sr / BLOCK;
    const k = 1 - Math.exp(-1 / (ctl * 0.03)); // ~30 ms smoothing
    s.pan += (p.pan - s.pan) * k;
    s.freqMul += (p.freqMul - s.freqMul) * k;
    // mod: quick attack, slow release so a flick of the mouse rings out
    const km = p.mod > s.mod ? 1 - Math.exp(-1 / (ctl * 0.04)) : 1 - Math.exp(-1 / (ctl * 0.6));
    s.mod += (p.mod - s.mod) * km;
    const kg = p.gate > s.gate ? 1 - Math.exp(-1 / (ctl * 0.04)) : 1 - Math.exp(-1 / (ctl * 0.25));
    s.gate += (p.gate - s.gate) * kg;

    const m = s.mod;
    const triRate = 100 * Math.pow(2, m * 2.6);          // 100 Hz → ~600 Hz
    const cDepth = 0.5 + m * 0.45;                       // ±0.5 → ±0.95
    const bDepth = 1 + m * 1.5;                          // ±1 → ±2.5
    const b = 3 + this.bNoise.next(ctl) * bDepth;
    const c = 0.5 + this.tri.next(triRate, ctl) * cDepth;
    const base = [8050, 9000];
    for (let ch = 0; ch < 2; ch++) {
      const f = (base[ch] + this.jit[ch].next(ctl) * 5) * s.freqMul;
      this.freqs[ch] = f;
      this.osc[ch].run(this.buf[ch], 0, BLOCK, f, 1, b, c, 0.5, sr);
    }
    // Balance2-style equal-power, normalised to unity at centre
    const th = (s.pan + 1) * Math.PI / 4;
    this.gl = Math.cos(th) * Math.SQRT2 * 0.035 * s.gate;
    this.gr = Math.sin(th) * Math.SQRT2 * 0.035 * s.gate;
  }
  process(inputs, outputs, params) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const p = { gate: params.gate[0], pan: params.pan[0], freqMul: params.freqMul[0], mod: params.mod[0] };
    if (p.gate === 0 && this.s.gate < 1e-4) { L.fill(0); if (R !== L) R.fill(0); this.s.gate = 0; return true; }
    for (let i = 0; i < L.length; i++) {
      if (this.pos >= BLOCK) { this.controlBlock(p); this.pos = 0; }
      const l = this.buf[0][this.pos] * this.gl;
      const r = this.buf[1][this.pos] * this.gr;
      if (R === L) L[i] = (l + r) * 0.5; else { L[i] = l; R[i] = r; }
      this.pos++;
    }
    return true;
  }
}

registerProcessor('mercu-sound2', MercuSound2);
