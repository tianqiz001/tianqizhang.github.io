/*
 * Mercu's SuperCollider Ndefs for the four pets, ported to AudioWorklet processors.
 * UGens follow scsynth's own source; control-rate (.kr) UGens tick once per 64-sample block.
 *
 *  五百 Ubai   Ndef(\drum,  { VarSaw.ar([52, 63], 0.4, 0.75)
 *                  * LFPulse.kr(LFNoise1.kr(100).exprange(4, 8), 0.2,
 *                               0.17 * SinOsc.kr(0.157 * SinOsc.kr(0.25 * Saw.kr(20)))).exprange(-0.5, 0.80) * 0.8 });
 *  麒麟 Kylin  Ndef(\sound1, { RLPF.ar(Saw.ar([80, 81]) * 0.1,
 *                  LFNoise1.kr(LFNoise1.kr(8).exprange(0.1, 4)).exprange(300, 2000), 0.035) });
 *  小熊 Bear   Ndef(\sound1, { RLPF.ar(Saw.ar([80, 81]) * 0.1, LFNoise1.kr(0.5).exprange(300, 2000), 0.035) });
 *  Sunny       Ndef(\beep,  { FreeVerb.ar(SinOsc.ar(LFNoise0.kr(2).exprange(900, 9000) * [1, 1.002])
 *                  * LFNoise2.kr(1.3).range(0, 0.08), 0.7, 0.95, 0.8) });
 *
 * Every processor has a `gate` parameter. Like Ndef.play / Ndef.stop with a fadeTime, the gate
 * fades the layer in over 3 s and out over 18 s with SC's sine-shaped fade curve.
 */
const BLOCK = 64;
const FADE_IN = 3, FADE_OUT = 18;
const frand2 = () => Math.random() * 2 - 1;
const expr = (x, lo, hi) => lo * Math.pow(hi / lo, (x + 1) * 0.5);   // bipolar .exprange

/* ── control-rate UGens ── */
class LFNoise0 {
  constructor() { this.level = frand2(); this.counter = 0; }
  next(freq, ctl) {
    if (this.counter <= 0) { this.counter = Math.max(1, Math.round(ctl / Math.max(freq, 0.001))); this.level = frand2(); }
    this.counter--; return this.level;
  }
}
class LFNoise1 {
  constructor() { this.level = frand2(); this.slope = 0; this.counter = 0; }
  next(freq, ctl) {
    if (this.counter <= 0) {
      this.counter = Math.max(1, Math.round(ctl / Math.max(freq, 0.001)));
      this.slope = (frand2() - this.level) / this.counter;
    }
    this.counter--; this.level += this.slope; return this.level;
  }
}
class LFNoise2 {
  constructor() { this.level = 0; this.slope = 0; this.curve = 0; this.counter = 0; this.nextValue = frand2(); this.nextMidPt = this.nextValue * 0.5; }
  next(freq, ctl) {
    if (this.counter <= 0) {
      const value = this.nextValue;
      this.nextValue = frand2();
      this.level = this.nextMidPt;
      this.nextMidPt = (this.nextValue + value) * 0.5;
      this.counter = Math.max(2, Math.round(ctl / Math.max(freq, 0.001)));
      const seg = this.counter;
      this.curve = 2 * (this.nextMidPt - this.level - seg * this.slope) / (seg * seg + seg);
    }
    this.counter--; this.slope += this.curve; this.level += this.slope;
    return Math.max(-1, Math.min(1, this.level));
  }
}
class SinOscK { constructor() { this.phase = 0; } next(freq, ctl) { const z = Math.sin(this.phase); this.phase += 2 * Math.PI * freq / ctl; return z; } }
class SawK { constructor() { this.phase = 0; } next(freq, ctl) { const z = this.phase * 2 - 1; this.phase += freq / ctl; this.phase -= Math.floor(this.phase); return z; } }
class LFPulseK { // scsynth LFPulse_next_k, including its "high at the wrap" quirk
  constructor(iphase, duty) { this.phase = iphase; this.duty = duty; }
  next(freq, duty, ctl) {
    let z;
    if (this.phase >= 1) { this.phase -= 1; this.duty = duty; z = duty < 0.5 ? 1 : 0; }
    else z = this.phase < this.duty ? 1 : 0;
    this.phase += freq / ctl;
    return z;
  }
}

/* ── audio-rate UGens ── */
class VarSaw {
  constructor(iphase) { this.phase = iphase; this.duty = 0.5; }
  next(freq, width, sr) {
    if (this.phase >= 1) { this.phase -= 1; this.duty = Math.min(0.999, Math.max(0.001, width)); }
    const p = this.phase, d = this.duty;
    const z = p < d ? p * (2 / d) : (1 - p) * (2 / (1 - d));
    this.phase += freq / sr;
    return z - 1;
  }
}
class BLSaw { // band-limited saw (PolyBLEP), -1..1, like SC's Saw
  constructor() { this.phase = 0.5; }
  next(freq, sr) {
    const dt = freq / sr; let t = this.phase;
    let y = 2 * t - 1;
    if (t < dt) { t /= dt; y -= t + t - t * t - 1; }
    else if (t > 1 - dt) { t = (t - 1) / dt; y -= t * t + t + t + 1; }
    this.phase += dt; if (this.phase >= 1) this.phase -= 1;
    return y;
  }
}
class RLPF { // scsynth RLPF
  constructor() { this.y1 = 0; this.y2 = 0; }
  next(x, freq, rq, sr) {
    const pfreq = freq * 2 * Math.PI / sr;
    const D = Math.tan(pfreq * Math.max(0.001, rq) * 0.5);
    const C = (1 - D) / (1 + D);
    const b1 = (1 + C) * Math.cos(pfreq), b2 = -C, a0 = (1 + C - b1) * 0.25;
    const y0 = a0 * x + b1 * this.y1 + b2 * this.y2;
    const out = y0 + 2 * this.y1 + this.y2;
    this.y2 = this.y1; this.y1 = y0;
    return out;
  }
}
class FreeVerb { // Jezar's Freeverb as used by SC's FreeVerb (mono, one per channel)
  constructor(sr, mix, room, damp, spread = 0) {
    const s = sr / 44100;
    this.combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((n) => ({ buf: new Float32Array(Math.round((n + spread) * s)), i: 0, store: 0 }));
    this.aps = [225, 556, 441, 341].map((n) => ({ buf: new Float32Array(Math.round((n + spread) * s)), i: 0 }));
    this.wet = mix; this.dry = 1 - mix;
    this.fb = room * 0.28 + 0.7; this.damp1 = damp * 0.4; this.damp2 = 1 - this.damp1;
  }
  next(x) {
    const input = x * 0.015;
    let acc = 0;
    for (const c of this.combs) {
      const o = c.buf[c.i];
      c.store = o * this.damp2 + c.store * this.damp1;
      c.buf[c.i] = input + c.store * this.fb;
      if (++c.i >= c.buf.length) c.i = 0;
      acc += o;
    }
    for (const a of this.aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = acc + b * 0.5;
      acc = b - acc;
      if (++a.i >= a.buf.length) a.i = 0;
    }
    return x * this.dry + acc * this.wet;
  }
}

/* ── Ndef-style fade + block scheduler shared by all four layers ── */
class Layer extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'gate', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }]; }
  constructor() { super(); this.fade = 0; this.pos = BLOCK; this.L = new Float32Array(BLOCK); this.R = new Float32Array(BLOCK); }
  process(_, outputs, params) {
    const L = outputs[0][0], R = outputs[0][1] || L;
    const gate = params.gate[0] > 0.5;
    if (!gate && this.fade <= 0) { L.fill(0); if (R !== L) R.fill(0); return true; }
    const up = 1 / (FADE_IN * sampleRate), down = 1 / (FADE_OUT * sampleRate);
    for (let i = 0; i < L.length; i++) {
      if (this.pos >= BLOCK) { this.block(sampleRate, sampleRate / BLOCK); this.pos = 0; }
      this.fade = gate ? Math.min(1, this.fade + up) : Math.max(0, this.fade - down);
      const g = Math.sin(this.fade * Math.PI / 2);   // Ndef fades use a sine curve
      L[i] = this.L[this.pos] * g; R[i] = this.R[this.pos] * g;
      this.pos++;
    }
    if (R === L) for (let i = 0; i < L.length; i++) L[i] *= 0.5;
    return true;
  }
}

class Drum extends Layer {
  // The SC patch, then (web only) softened and put in a room: the -0.5 ↔ 0.8 gate flips polarity
  // instantly, which clicks hard, so the gate gets a ~2 ms slew, a gentle low-pass takes the fizz
  // off the VarSaw edges, the level is trimmed, and a stereo FreeVerb makes it wet.
  constructor() {
    super();
    this.saws = [new VarSaw(0.4), new VarSaw(0.4)];
    this.rateNoise = new LFNoise1(); this.saw = new SawK(); this.sin1 = new SinOscK(); this.sin2 = new SinOscK();
    this.pulse = new LFPulseK(0.2, 0);
    this.amp = 0; this.target = 0;
    this.lp = [new RLPF(), new RLPF()];
    this.verbs = [new FreeVerb(sampleRate, 0.5, 0.88, 0.45), new FreeVerb(sampleRate, 0.5, 0.88, 0.45, 23)];
    this.slew = 1 - Math.exp(-1 / (sampleRate * 0.002));
  }
  block(sr, ctl) {
    const rate = expr(this.rateNoise.next(100, ctl), 4, 8);
    const width = 0.17 * this.sin2.next(0.157 * this.sin1.next(0.25 * this.saw.next(20, ctl), ctl), ctl);
    const p = this.pulse.next(rate, width, ctl);
    this.target = (p ? 0.8 : -0.5) * 0.8;   // LFPulse (0/1).exprange(-0.5, 0.8) * 0.8
    const TRIM = 0.4;
    for (let i = 0; i < BLOCK; i++) {
      this.amp += (this.target - this.amp) * this.slew;
      const a = this.amp * TRIM;
      const l = this.lp[0].next(this.saws[0].next(52, 0.75, sr) * a, 2400, 0.9, sr);
      const r = this.lp[1].next(this.saws[1].next(63, 0.75, sr) * a, 2400, 0.9, sr);
      this.L[i] = this.verbs[0].next(l) * 2.2;   // FreeVerb's 0.5 dry halves the level; bring the body back
      this.R[i] = this.verbs[1].next(r) * 2.2;
    }
  }
}

class Sound1 extends Layer { // shared by Kylin (wandering noise rate) and Bear (0.5 Hz)
  constructor(opts) {
    super();
    this.wander = !!(opts && opts.processorOptions && opts.processorOptions.wander);
    this.saws = [new BLSaw(), new BLSaw()]; this.f = [new RLPF(), new RLPF()];
    this.cut = new LFNoise1(); this.rate = new LFNoise1();
    this.cutoff = 800; this.prev = 800;
  }
  block(sr, ctl) {
    const r = this.wander ? expr(this.rate.next(8, ctl), 0.1, 4) : 0.5;
    this.prev = this.cutoff;
    this.cutoff = expr(this.cut.next(r, ctl), 300, 2000);
    for (let i = 0; i < BLOCK; i++) {
      const fc = this.prev + (this.cutoff - this.prev) * (i / BLOCK);   // RLPF slides kr freq across the block
      this.L[i] = this.f[0].next(this.saws[0].next(80, sr) * 0.1, fc, 0.035, sr);
      this.R[i] = this.f[1].next(this.saws[1].next(81, sr) * 0.1, fc, 0.035, sr);
    }
  }
}
class Kylin extends Sound1 { constructor() { super({ processorOptions: { wander: true } }); } }
class Bear extends Sound1 { constructor() { super({ processorOptions: { wander: false } }); } }

class Beep extends Layer {
  constructor() {
    super();
    this.step = new LFNoise0(); this.amp = new LFNoise2();
    this.ph = [0, 0]; this.freq = 3000; this.a = 0; this.aPrev = 0;
    this.verbs = [new FreeVerb(sampleRate, 0.7, 0.95, 0.8), new FreeVerb(sampleRate, 0.7, 0.95, 0.8)];
  }
  block(sr, ctl) {
    this.freq = expr(this.step.next(2, ctl), 900, 9000);
    this.aPrev = this.a;
    this.a = (this.amp.next(1.3, ctl) + 1) * 0.5 * 0.08;
    const mul = [1, 1.002];
    for (let i = 0; i < BLOCK; i++) {
      const a = this.aPrev + (this.a - this.aPrev) * (i / BLOCK);
      for (let c = 0; c < 2; c++) {
        const s = Math.sin(this.ph[c]) * a;
        this.ph[c] += 2 * Math.PI * this.freq * mul[c] / sr;
        if (this.ph[c] > 2 * Math.PI) this.ph[c] -= 2 * Math.PI;
        (c ? this.R : this.L)[i] = this.verbs[c].next(s);
      }
    }
  }
}

registerProcessor('mercu-drum', Drum);
registerProcessor('mercu-kylin', Kylin);
registerProcessor('mercu-bear', Bear);
registerProcessor('mercu-beep', Beep);
