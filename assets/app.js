/* Mercu / Tianqi Zhang — portfolio
   Content lives in content/site.json and content/works.json (edited through Pages CMS).
   This file only renders it. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let overPet = false;   // pointer is on one of the pets under the name
  const TAU = Math.PI * 2;

  /* ───────── interface text (EN / 中文) ───────── */
  const UI = {
    en: {
      'nav.work': 'Work', 'nav.about': 'About', 'nav.activity': 'Activity', 'nav.contact': 'Contact',
      'sound.off': 'Sound off', 'sound.on': 'Sound on',
      'hero.hint': 'Turn sound on, then move across the name: left–right pans, up–down sets the frequency, moving faster adds modulation.',
      'hero.scroll': 'Scroll for work ↓',
      'work.label': 'Selected work', 'work.note': 'Click a window to listen or watch.',
      'work.all': 'All', 'work.empty': 'Nothing in this category yet.',
      'work.error': 'The work list could not be loaded. If you opened index.html by double-clicking it, start a local server instead (see README).',
      'about.label': 'About me', 'about.cv': 'Selected activity',
      'photo.empty': 'Your photo goes here. Upload it in the editor under Profile & About → Photo.',
      'contact.label': 'Contact', 'contact.lead': 'For film and media scoring, commissions and collaborations.',
      'contact.copy': 'Copy email', 'contact.copied': 'Copied',
      'foot.top': 'Back to top ↑', 'localTime': 'Local time',
      'type.audio': 'Listen', 'type.video': 'Watch', 'type.embed': 'Watch', 'type.none': 'Open',
      'player.play': 'Play', 'player.pause': 'Pause', 'player.close': 'Close player',
      'more': 'More ↗',
      'media.error': 'This file could not be played. It may be missing or still uploading.',
      'openOn': 'Open on'
    },
    zh: {
      'nav.work': '作品', 'nav.about': '关于', 'nav.activity': '经历', 'nav.contact': '联系',
      'sound.off': '声音 关', 'sound.on': '声音 开',
      'hero.hint': '打开声音，在名字上移动鼠标：左右控制声像，上下控制频率，移动得越快调制越强。',
      'hero.scroll': '向下查看作品 ↓',
      'work.label': '作品精选', 'work.note': '点击小窗即可试听或观看。',
      'work.all': '全部', 'work.empty': '这个类别暂时还没有作品。',
      'work.error': '作品列表加载失败。如果你是直接双击打开 index.html，请改用本地服务器预览（见 README）。',
      'about.label': '关于我', 'about.cv': '经历',
      'photo.empty': '这里放你的照片。在后台“简介与网站信息 → 照片”上传。',
      'contact.label': '联系', 'contact.lead': '影视与媒体配乐、委约创作及合作，欢迎来信。',
      'contact.copy': '复制邮箱', 'contact.copied': '已复制',
      'foot.top': '回到顶部 ↑', 'localTime': '当地时间',
      'type.audio': '试听', 'type.video': '观看', 'type.embed': '观看', 'type.none': '打开',
      'player.play': '播放', 'player.pause': '暂停', 'player.close': '关闭播放器',
      'more': '更多 ↗',
      'media.error': '这个文件无法播放，可能是文件缺失或还没有上传成功。',
      'openOn': '在新窗口打开：'
    }
  };

  /* Category keys must match the "category" options in .pages.yml */
  const CATS = {
    film:       { en: 'Film & TV',    zh: '影视配乐' },
    game:       { en: 'Games',        zh: '游戏音乐' },
    fixedmedia: { en: 'Fixed Media',  zh: '固定媒体' },
    electronic: { en: 'Electronic',   zh: '电子 / 计算机音乐' },
    popsongs:   { en: 'Pop Songs',    zh: '流行歌曲' },
    instrument: { en: 'Instruments',  zh: '乐器与交互' }
  };
  const COVER_PALETTES = {
    film:       { bg: '#052628', line: 'rgba(228,238,235,.78)', hi: '#41e2c8', text: 'rgba(159,196,191,.8)' },
    game:       { bg: '#062f31', line: 'rgba(159,196,191,.85)', hi: '#41e2c8', text: 'rgba(159,196,191,.8)' },
    fixedmedia: { bg: '#0b3a3c', line: 'rgba(242,247,245,.82)', hi: '#ffffff', text: 'rgba(228,238,235,.7)' },
    popsongs:   { bg: '#0e7470', line: 'rgba(242,247,245,.8)',  hi: '#41e2c8', text: 'rgba(228,238,235,.8)' },
    electronic: { bg: '#041e20', line: 'rgba(65,226,200,.85)',  hi: '#e4eeeb', text: 'rgba(65,226,200,.75)' },
    instrument: { bg: '#e4eeeb', line: 'rgba(10,37,38,.8)',     hi: '#0e7470', text: 'rgba(14,116,112,.85)' }
  };

  /* ───────── state ───────── */
  let site = {};
  let works = [];
  let lang = 'en';
  let filter = 'all';
  let playingId = null;
  let modalWork = null;

  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'zh') lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('zh')) lang = 'zh';
  } catch (e) { /* storage blocked: keep default */ }

  const t = (k) => (UI[lang] && UI[lang][k]) || UI.en[k] || k;
  const f = (obj, key) => (obj && (obj[`${key}_${lang}`] || obj[`${key}_en`] || obj[`${key}_zh`])) || '';
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mediaUrl = (p) => {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || p.startsWith('data:')) return p;
    return p.replace(/^\/+/, '');            // keep paths relative so the site works in a sub-folder
  };
  const slug = (s) => String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40) || 'untitled';
  const basename = (p) => (p || '').split('/').pop();
  const fmtTime = (s) => (!isFinite(s) || s < 0) ? '0:00' : `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return (h >>> 0);
  }
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  /* ───────── video embeds ───────── */
  function parseEmbed(url) {
    if (!url) return null;
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/))) {
      return { kind: 'youtube', id: m[1], src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, host: 'youtube.com' };
    }
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
      return { kind: 'vimeo', id: m[1], src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&title=0&byline=0`, host: 'vimeo.com' };
    }
    if ((m = url.match(/bilibili\.com\/video\/(BV[\w]+)/i))) {
      return { kind: 'bilibili', id: m[1], src: `https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=1&high_quality=1&danmaku=0`, host: 'bilibili.com' };
    }
    // music players
    if ((m = url.match(/music\.163\.com\/.*?song(?:\?id=|\/)(\d+)/))) {
      return { kind: 'netease', id: m[1], audio: true, height: 90, src: `https://music.163.com/outchain/player?type=2&id=${m[1]}&auto=1&height=66`, host: 'music.163.com' };
    }
    if ((m = url.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/(\w+)/))) {
      return { kind: 'spotify', id: m[2], audio: true, height: m[1] === 'track' ? 152 : 352, src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, host: 'spotify.com' };
    }
    if ((m = url.match(/music\.apple\.com\/(.+)/))) {
      return { kind: 'apple', id: '', audio: true, height: /[?&]i=/.test(url) ? 175 : 450, src: `https://embed.music.apple.com/${m[1]}`, host: 'music.apple.com' };
    }
    if (/soundcloud\.com\//.test(url)) {
      return { kind: 'soundcloud', id: '', audio: true, height: 166, src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`, host: 'soundcloud.com' };
    }
    return { kind: 'other', src: url, host: (() => { try { return new URL(url).hostname; } catch (e) { return 'embed'; } })() };
  }
  function kindOf(w) {
    if (w.media_type === 'audio' && w.audio) return 'audio';
    if (w.media_type === 'video' && w.video) return 'video';
    if (w.media_type === 'embed' && w.embed_url) return 'embed';
    // be forgiving if media_type was left unset
    if (w.audio) return 'audio';
    if (w.video) return 'video';
    if (w.embed_url) return 'embed';
    return 'none';
  }

  /* ───────── audio engine (shared by player, theremin, visuals) ───────── */
  const audio = $('#audio');
  let actx = null, analyser = null, master = null, mediaSrc = null, routed = false;
  let freqData = null, timeData = null;
  let theremin = null;
  let soundOn = false;

  function ensureCtx() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return actx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser);
    analyser.connect(actx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    return actx;
  }
  function routeAudioElement() {
    if (mediaSrc || !ensureCtx()) return;
    // Only same-origin media can be analysed; anything else would play silently through Web Audio.
    try {
      const u = new URL(audio.currentSrc || audio.src, location.href);
      if (u.origin !== location.origin) return;
      mediaSrc = actx.createMediaElementSource(audio);
      mediaSrc.connect(master);
      routed = true;
    } catch (e) { routed = false; }
  }

  // The name is playable with Mercu's SuperCollider patch (Ndef \sound2, LatoocarfianC),
  // ported to an AudioWorklet: x = pan, y = frequency, pointer speed = modulation.
  // Browsers without AudioWorklet fall back to the small pentatonic theremin below.
  let scBuilding = false;
  async function buildTheremin() {
    if (theremin || scBuilding || !ensureCtx()) return;
    if (actx.audioWorklet && window.AudioWorkletNode) {
      scBuilding = true;
      try {
        await actx.audioWorklet.addModule('assets/synths/latoocarfian.worklet.js?v=20261023a');
        const node = new AudioWorkletNode(actx, 'mercu-sound2', { numberOfInputs: 0, outputChannelCount: [2] });
        node.connect(master);
        const P = (n) => node.parameters.get(n);
        theremin = { sc: true, node, gate: P('gate'), pan: P('pan'), freqMul: P('freqMul'), mod: P('mod'), freq: 8050, panV: 0, modV: 0 };
        scBuilding = false;
        thereminUpdate(ptr.nx, ptr.ny, ptr.active);
        return;
      } catch (e) { scBuilding = false; }
    }
    buildFallbackTheremin();
  }
  const PENTA = [0, 3, 5, 7, 10];
  function buildFallbackTheremin() {
    if (theremin || !ensureCtx()) return;
    const o1 = actx.createOscillator(); o1.type = 'triangle';
    const o2 = actx.createOscillator(); o2.type = 'sine';
    const o2g = actx.createGain(); o2g.gain.value = 0.25;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.7;
    const vca = actx.createGain(); vca.gain.value = 0;
    const delay = actx.createDelay(1); delay.delayTime.value = 0.31;
    const fb = actx.createGain(); fb.gain.value = 0.32;
    const wet = actx.createGain(); wet.gain.value = 0.28;
    o1.connect(lp); o2.connect(o2g).connect(lp); lp.connect(vca);
    vca.connect(master); vca.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    o1.start(); o2.start();
    theremin = { o1, o2, vca, lp, freq: 220 };
  }
  let modTimer = 0;
  function thereminUpdate(nx, ny, active, speed = 0) {
    if (!theremin) return;
    const now = actx.currentTime;
    if (theremin.sc) {
      const pan = nx * 2 - 1;                              // left … right
      const mul = Math.pow(2, (0.5 - ny) * 3.2);           // centre = original 8050 / 9000 Hz, ±1.6 oct
      const mod = Math.min(1, speed / 2.5);                // speed in hero-widths per second
      theremin.pan.setValueAtTime(pan, now);
      theremin.freqMul.setValueAtTime(mul, now);
      theremin.mod.setValueAtTime(mod, now);
      theremin.gate.setValueAtTime(active && soundOn ? 1 : 0, now);
      theremin.freq = 8050 * mul; theremin.panV = pan;
      theremin.modV = Math.max(mod, theremin.modV * 0.85);
      clearTimeout(modTimer);
      if (mod > 0) modTimer = setTimeout(() => { if (theremin) { theremin.mod.setValueAtTime(0, actx.currentTime); } }, 70);
      return;
    }
    const steps = PENTA.length * 3;
    const idx = Math.min(steps, Math.max(0, Math.floor(nx * (steps + 1))));
    const semis = Math.floor(idx / PENTA.length) * 12 + PENTA[idx % PENTA.length];
    const freq = 110 * Math.pow(2, semis / 12);
    theremin.freq = freq;
    theremin.o1.frequency.setTargetAtTime(freq, now, 0.025);
    theremin.o2.frequency.setTargetAtTime(freq * 2, now, 0.025);
    theremin.lp.frequency.setTargetAtTime(700 + (1 - ny) * 2400, now, 0.05);
    const g = active && soundOn ? 0.05 + (1 - ny) * 0.11 : 0;
    theremin.vca.gain.setTargetAtTime(g, now, active ? 0.04 : 0.18);
  }

  /* ───────── giant name ───────── */
  const nameEl = $('#name');
  const hero = $('#top');
  let letters = [];
  const REST_W = 118, REST_G = 820;
  const PAPER = [228, 238, 235], GLOW = [65, 226, 200];

  function buildName() {
    const l1 = site.name_line1 || 'Tianqi Zhang/';
    const l2 = site.name_line2 || 'Mercu';
    nameEl.setAttribute('aria-label', `${l1} ${l2}`);
    const lines = $$('.name-line', nameEl);
    [l1, l2].forEach((txt, li) => {
      const line = lines[li];
      line.setAttribute('aria-hidden', 'true');
      line.innerHTML = '';
      for (const ch of txt) {
        const s = document.createElement('span');
        s.className = ch === ' ' ? 'ch sp' : 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        line.appendChild(s);
      }
    });
    fitName();
  }
  function fitName() {
    const avail = nameEl.clientWidth;
    if (!avail) return;
    letters = [];
    $$('.name-line', nameEl).forEach((line) => {
      $$('.ch', line).forEach((c) => { c.style.removeProperty('--w'); c.style.removeProperty('--g'); c.style.color = ''; });
      line.style.fontSize = '100px';
      line.style.width = 'max-content';
      const w = line.getBoundingClientRect().width;
      line.style.width = '';
      line.style.fontSize = `${Math.max(24, (100 * avail / w) * 0.992)}px`;
    });
    const foot = $('.footer-name');
    if (foot) {
      const word = (site.name_line2 || 'Mercu').replace(/\/\s*$/, '');
      foot.innerHTML = [...word].map((ch) => `<span class="fl">${esc(ch)}</span>`).join('');
      footLetters = $$('.fl', foot);
      footLetters.forEach((el) => { el.style.backgroundImage = FOOT_BAR_IMG; el.style.backgroundPosition = FOOT_BAR_POS; });
      foot.style.fontSize = '100px';
      const fw = foot.getBoundingClientRect().width;
      const fa = foot.parentElement.clientWidth;
      if (fw) foot.style.fontSize = `${(100 * fa / fw) * 0.99}px`;
    }
    const r = nameEl.getBoundingClientRect();
    const all = $$('.ch', nameEl);
    all.forEach((el, i) => {
      const cr = el.getBoundingClientRect();
      letters.push({ el, i, cx: cr.left - r.left + cr.width / 2, cy: cr.top - r.top + cr.height / 2, nx: i / Math.max(1, all.length - 1), v: 0, last: -1 });
    });
  }

  /* pointer over hero */
  const ptr = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false };
  let lastMove = { t: 0, x: 0, y: 0 };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    ptr.nx = Math.min(1, Math.max(0, ptr.x / r.width));
    ptr.ny = Math.min(1, Math.max(0, ptr.y / r.height));
    const now = performance.now(), dt = Math.max(8, now - lastMove.t);
    const speed = lastMove.t && dt < 200 ? Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / r.width / (dt / 1000) : 0;
    lastMove = { t: now, x: e.clientX, y: e.clientY };
    ptr.active = true;
    if (soundOn) thereminUpdate(ptr.nx, ptr.ny, true, speed);
  });
  hero.addEventListener('pointerleave', () => { ptr.active = false; if (soundOn) thereminUpdate(ptr.nx, ptr.ny, false); });
  hero.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { ptr.active = false; thereminUpdate(ptr.nx, ptr.ny, false); } });

  /* pet layers: hovering a pet starts its Ndef (3 s fade-in); the layers stack up and keep playing
     anywhere on the page until the sound toggle is switched off. */
  const PET_SYNTH = { ubai: 'mercu-drum', kylin: 'mercu-kylin', bear: 'mercu-bear', sunny: 'mercu-beep' };
  const PET_LEVEL = 0.45;   // overall level of the pet layers (≈ -7 dB)
  let petBus = null, petNodes = null, petBuilding = null;
  const petsOn = new Set();
  function buildPets() {
    if (petNodes || petBuilding || !ensureCtx() || !actx.audioWorklet) return petBuilding;
    petBuilding = actx.audioWorklet.addModule('assets/synths/pets.worklet.js?v=20261023c').then(() => {
      petBus = actx.createGain();
      petBus.gain.value = PET_LEVEL;
      const safety = actx.createDynamicsCompressor();   // the layers sum hot (the drum alone peaks ~0.64)
      safety.threshold.value = -3; safety.knee.value = 3; safety.ratio.value = 20; safety.attack.value = 0.002; safety.release.value = 0.2;
      petBus.connect(safety).connect(master);
      petNodes = {};
      for (const [pet, name] of Object.entries(PET_SYNTH)) {
        const n = new AudioWorkletNode(actx, name, { numberOfInputs: 0, outputChannelCount: [2] });
        n.connect(petBus);
        petNodes[pet] = n;
      }
      petsOn.forEach((p) => setPetGate(p, 1));
    }).catch(() => { petBuilding = null; });
    return petBuilding;
  }
  function setPetGate(pet, v) {
    const n = petNodes && petNodes[pet];
    if (n) n.parameters.get('gate').setValueAtTime(v, actx.currentTime);
  }
  function petEnter(pet) {
    if (!soundOn || !PET_SYNTH[pet]) return;
    petsOn.add(pet);
    buildPets();
    setPetGate(pet, 1);
  }
  $$('.pet').forEach((el) => {
    const pet = (el.className.match(/pet-(ubai|kylin|bear|sunny)/) || [])[1];
    el.addEventListener('pointerenter', () => petEnter(pet));
    el.addEventListener('pointerup', () => petEnter(pet));
    el.addEventListener('focus', () => petEnter(pet));
  });

  $('#soundToggle').addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) { ensureCtx(); buildTheremin(); buildPets(); if (petBus) petBus.gain.setTargetAtTime(PET_LEVEL, actx.currentTime, 0.05); }
    else {
      if (theremin) thereminUpdate(ptr.nx, ptr.ny, false);
      if (petBus) petBus.gain.setTargetAtTime(0, actx.currentTime, 0.08);
      petsOn.forEach((p) => setPetGate(p, 0)); petsOn.clear();
    }
    $('#soundToggle').setAttribute('aria-pressed', String(soundOn));
    $('#soundLabel').textContent = t(soundOn ? 'sound.on' : 'sound.off');
  });

  /* ───────── canvases ───────── */
  const heroCv = $('#heroScope');
  const heroCtx = heroCv.getContext('2d');
  const pCv = $('#pScope');
  const pCtx = pCv.getContext('2d');
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  function sizeCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const d = dpr();
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }

  let heroVisible = true;
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);

  const isPlaying = () => playingId && !audio.paused;
  const thereminLive = () => soundOn && theremin && ptr.active;

  function bandEnergy(nx, time, i) {
    if (routed || thereminLive()) {
      const n = freqData.length;
      const lo = 3, hi = n * 0.5;
      const bin = Math.floor(lo * Math.pow(hi / lo, nx));
      const v = (freqData[bin] + freqData[Math.min(n - 1, bin + 1)]) / 510;
      return Math.pow(v, 1.7);
    }
    // media we can't analyse: a believable stand-in
    return Math.pow(0.5 + 0.5 * Math.sin(time * 5.1 + i * 1.7) * Math.sin(time * 1.3 + i * 0.6), 2) * 0.8;
  }

  function drawWave(ctx, W, H, yMid, amp, time, live, color, width, ghost) {
    ctx.beginPath();
    const step = Math.max(2, Math.floor(W / 420));
    for (let x = 0; x <= W; x += step) {
      const nx = x / W;
      let y;
      if (live) {
        const idx = Math.floor(nx * (timeData.length - 1));
        y = (timeData[idx] - 128) / 128 * amp * (ghost ? 0.6 : 1);
      } else {
        const cyc = 2 + ptr.nx * 9;
        y = (Math.sin(nx * TAU * cyc + time * 2.4 + (ghost ? 1.1 : 0)) * 0.7 +
             Math.sin(nx * TAU * cyc * 2.01 - time * 1.7) * 0.2 +
             Math.sin(nx * TAU * 0.5 + time * 0.3) * 0.25) * amp * (ghost ? 0.55 : 1);
      }
      const taper = Math.sin(Math.PI * nx);
      if (x === 0) ctx.moveTo(x, yMid + y * taper); else ctx.lineTo(x, yMid + y * taper);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function drawHero(time) {
    sizeCanvas(heroCv);
    const W = heroCv.width, H = heroCv.height, d = dpr();
    heroCtx.clearRect(0, 0, W, H);
    const live = !!analyser && (thereminLive() || (isPlaying() && routed));
    const proximity = ptr.active ? 1 - Math.abs(ptr.ny - 0.5) : 0.25;
    const amp = live ? H * 0.22 : (8 + 46 * proximity * (ptr.active ? 1 : 0.4)) * d;
    const yMid = H * 0.5;
    heroCtx.save();
    heroCtx.shadowColor = 'rgba(65,226,200,.6)'; heroCtx.shadowBlur = 12 * d;
    drawWave(heroCtx, W, H, yMid, amp, time, live, 'rgba(65,226,200,.55)', 1.4 * d, false);
    heroCtx.restore();
    drawWave(heroCtx, W, H, yMid, amp, time, live, 'rgba(159,196,191,.16)', 1 * d, true);

    if (ptr.active) {
      const x = ptr.x * d, y = ptr.y * d;
      heroCtx.strokeStyle = 'rgba(65,226,200,.28)'; heroCtx.lineWidth = d;
      heroCtx.beginPath(); heroCtx.moveTo(x, 0); heroCtx.lineTo(x, H); heroCtx.moveTo(0, y); heroCtx.lineTo(W, y); heroCtx.stroke();
      if (overPet) { return; }   // the pet's own name tag is showing there
      heroCtx.font = `${10 * d}px "Martian Mono", monospace`;
      heroCtx.fillStyle = 'rgba(65,226,200,.9)';
      if (theremin && theremin.sc) theremin.modV *= 0.95;
      const panTxt = (v) => Math.abs(v) < 0.02 ? 'C' : `${v < 0 ? 'L' : 'R'}${Math.round(Math.abs(v) * 100)}`;
      const txt = soundOn && theremin
        ? (theremin.sc
          ? `PAN ${panTxt(theremin.panV)} · ${Math.round(theremin.freq)} HZ · MOD ${Math.round(theremin.modV * 100)}%`
          : `${theremin.freq.toFixed(1)} HZ · ${Math.round((1 - ptr.ny) * 100)}%`)
        : `X ${ptr.nx.toFixed(2)}  Y ${(1 - ptr.ny).toFixed(2)}`;
      const tx = Math.min(x + 10 * d, W - heroCtx.measureText(txt).width - 8 * d);
      heroCtx.fillText(txt, tx, Math.max(16 * d, y - 10 * d));
    }
  }

  function drawPlayer(time) {
    if ($('#player').hidden || pCv.offsetParent === null) return;
    sizeCanvas(pCv);
    const W = pCv.width, H = pCv.height, d = dpr();
    pCtx.clearRect(0, 0, W, H);
    const playing = isPlaying();
    if (playing && routed) {
      drawWave(pCtx, W, H, H / 2, H * 0.45, time, true, 'rgba(65,226,200,.9)', 1.2 * d, false);
    } else {
      // bars stand-in when paused or not analysable
      const bars = 28, bw = W / bars;
      pCtx.fillStyle = 'rgba(65,226,200,.75)';
      for (let i = 0; i < bars; i++) {
        const v = playing ? bandEnergy(i / bars, time, i) : 0.06;
        const h = Math.max(2 * d, v * H * 0.9);
        pCtx.fillRect(i * bw + bw * 0.25, (H - h) / 2, bw * 0.5, h);
      }
    }
  }

  function frame(ts) {
    const time = ts / 1000;
    const live = !!analyser && (thereminLive() || (isPlaying() && routed));
    if (analyser && (live || isPlaying())) { analyser.getByteFrequencyData(freqData); analyser.getByteTimeDomainData(timeData); }

    if (heroVisible && letters.length) {
      const rName = nameEl.getBoundingClientRect(), rHero = hero.getBoundingClientRect();
      const px = ptr.x - (rName.left - rHero.left), py = ptr.y - (rName.top - rHero.top);
      const sigma = Math.max(60, rName.width * 0.07);
      const playingNow = isPlaying() || thereminLive();
      for (const L of letters) {
        let target = 0;
        if (ptr.active) {
          const dx = (L.cx - px) / sigma, dy = (L.cy - py) / (sigma * 1.6);
          target = Math.exp(-(dx * dx + dy * dy) / 2);
        }
        if (playingNow) target = Math.max(target, bandEnergy(L.nx, time, L.i) * 1.15);
        else if (!ptr.active && !reduceMotion) target = Math.pow(Math.max(0, Math.sin(time * 0.9 - L.nx * 5)), 10) * 0.28;
        L.v += (Math.min(1, target) - L.v) * 0.14;
        const q = Math.round(L.v * 400) / 400;
        if (q !== L.last) {
          L.last = q;
          L.el.style.setProperty('--w', (REST_W - q * 56).toFixed(1));
          L.el.style.setProperty('--g', (REST_G - q * 640).toFixed(0));
          const c = PAPER.map((p, k) => Math.round(p + (GLOW[k] - p) * Math.min(1, q * 1.4)));
          L.el.style.color = q > 0.003 ? `rgb(${c})` : '';
        }
      }
      drawHero(time);
    }
    drawPlayer(time);
    drawFooter();
    requestAnimationFrame(frame);
  }

  /* ───────── generative covers ───────── */
  function drawCover(cv, w, figNo) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const pal = COVER_PALETTES[w.category] || COVER_PALETTES.film;
    const rnd = mulberry32(hash(String(w.title_en || w.title_zh || figNo)));
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);

    // blueprint grid
    ctx.strokeStyle = pal.bg === '#e4eeeb' ? 'rgba(10,37,38,.07)' : 'rgba(228,238,235,.05)';
    ctx.lineWidth = 1;
    const g = W / 16;
    for (let x = g; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = g; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // ridge plot: stacked waveforms, like a spectrogram seen from the side
    const n = 20 + Math.floor(rnd() * 10);
    const top = H * 0.24, bottom = H * 0.9, step = (bottom - top) / n;
    const center = 0.28 + rnd() * 0.44, spread = 0.1 + rnd() * 0.16;
    const f1 = 2 + rnd() * 3, f2 = 6 + rnd() * 8, f3 = 14 + rnd() * 20;
    const hiLine = Math.floor(rnd() * n);
    for (let i = 0; i < n; i++) {
      const p1 = rnd() * TAU, p2 = rnd() * TAU, p3 = rnd() * TAU;
      const peak = step * (1.5 + rnd() * 5.5) * (0.4 + 0.6 * Math.sin(Math.PI * (i + 1) / (n + 1)));
      const y0 = top + i * step;
      const pts = [];
      for (let x = 0; x <= W; x += 3) {
        const nx = x / W;
        const env = Math.exp(-((nx - center) ** 2) / (2 * spread * spread));
        const noise = Math.sin(nx * f1 * TAU + p1) * 0.5 + Math.sin(nx * f2 * TAU + p2) * 0.32 + Math.sin(nx * f3 * TAU + p3) * 0.18;
        pts.push([x, y0 - env * peak * (0.7 + 0.3 * noise) - noise * step * 0.12]);
      }
      ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = pal.bg; ctx.fill();
      ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = i === hiLine ? pal.hi : pal.line;
      ctx.lineWidth = i === hiLine ? 2.2 : 1.3;
      ctx.stroke();
    }
    const cat = (CATS[w.category] && CATS[w.category][lang]) || '';
    ctx.font = `${Math.round(W / 46)}px "Martian Mono", "Noto Sans SC", monospace`;
    ctx.fillStyle = pal.text;
    const cw = ctx.measureText(cat.toUpperCase()).width;
    ctx.fillText(cat.toUpperCase(), W * 0.96 - cw, H * 0.09);
  }

  /* ───────── works ───────── */
  const visibleWorks = () => works.filter((w) => !w.hidden);

  /* Rows of up to 2 large ("featured") windows followed by up to 3 small ones.
     When one kind runs out, the row is topped up with the other kind.
     Width units: large = 3, small = 2, a full row = 12. */
  function layoutRows(list) {
    const big = list.filter((w) => w.featured), small = list.filter((w) => !w.featured);
    const rows = [];
    while (big.length || small.length) {
      const row = [];
      for (let i = 0; i < 2 && big.length; i++) row.push(big.shift());
      for (let i = 0; i < 3 && small.length; i++) row.push(small.shift());
      while (row.length < 5 && (big.length || small.length)) {
        const units = row.reduce((n, w) => n + (w.featured ? 3 : 2), 0);
        if (big.length && units + 3 <= 13) row.splice(row.filter((w) => w.featured).length, 0, big.shift());
        else if (small.length && units + 2 <= 13) row.push(small.shift());
        else break;
      }
      rows.push(row);
    }
    return rows;
  }
  let figMap = new Map();
  function updateFigMap() {
    figMap = new Map();
    layoutRows(visibleWorks()).flat().forEach((w, i) => figMap.set(w._id, pad(i + 1)));
  }

  function renderFilters() {
    const list = visibleWorks();
    const present = Object.keys(CATS).filter((k) => list.some((w) => w.category === k));
    if (filter !== 'all' && !present.includes(filter)) filter = 'all';
    const btn = (key, label, count) =>
      `<button type="button" class="filter" data-filter="${key}" aria-pressed="${filter === key}">${esc(label)}<sup>${count}</sup></button>`;
    $('#filters').innerHTML = btn('all', t('work.all'), list.length) +
      present.map((k) => btn(k, CATS[k][lang], list.filter((w) => w.category === k).length)).join('');
  }

  function cardHTML(w, idx, units, rowUnits) {
    const fig = figMap.get(w._id) || pad(idx + 1);
    const kind = kindOf(w);
    const title = f(w, 'title') || 'Untitled';
    const role = f(w, 'role');
    const desc = f(w, 'description');
    const emb = kind === 'embed' ? parseEmbed(w.embed_url) : null;
    const typeKey = kind === 'embed' && emb.audio ? 'audio' : kind;
    const file = kind === 'audio' ? basename(w.audio)
      : kind === 'video' ? basename(w.video)
      : kind === 'embed' ? `${emb.host}/${emb.id || ''}`
      : `${slug(w.title_en || title)}.score`;
    const meta = [role, w.year].filter(Boolean).join(' · ');
    let cover;
    if (w.cover) cover = `<img class="win-cover" src="${esc(mediaUrl(w.cover))}" alt="" loading="lazy">`;
    else if (emb && emb.thumb) cover = `<img class="win-cover" src="${esc(emb.thumb)}" alt="" loading="lazy">`;
    else cover = `<canvas class="win-cover" data-gen="${w._id}" width="${w.featured ? 1200 : 800}" height="600"></canvas>`;
    const icon = typeKey === 'audio' || kind === 'none'
      ? '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 6h13v12H3zM17 10l4-2.5v9L17 14z"/></svg>';
    const hasAction = kind !== 'none' || w.link;
    const viewTag = hasAction ? 'button type="button"' : 'div';
    const viewClose = hasAction ? 'button' : 'div';
    return `
      <article class="win${w.featured ? ' featured' : ''}${playingId === w._id ? ' playing' : ''}${playingId === w._id && audio.paused ? ' paused' : ''}" data-id="${w._id}" style="--i:${idx};--u:${units};--U:${rowUnits}">
        <div class="win-bar">
          <span class="win-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="win-file">${esc(file)}</span>
        </div>
        <${viewTag} class="win-view" ${hasAction ? `aria-label="${esc(t('type.' + typeKey))}: ${esc(title)}"` : ''}>
          ${cover}
          ${hasAction ? `<span class="win-play">${icon}<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${esc(t('type.' + typeKey))}</span>` : ''}
        </${viewClose}>
        <div class="win-cap">
          <h3>${esc(title)}</h3>
          ${meta ? `<p class="win-role label">${esc(meta)}</p>` : ''}
          ${desc ? `<p class="win-desc">${esc(desc)}</p>` : ''}
          ${w.link ? `<a class="win-link" href="${esc(w.link)}" target="_blank" rel="noopener">${esc(t('more'))}</a>` : ''}
        </div>
      </article>`;
  }

  function renderWorks() {
    updateFigMap();
    const all = visibleWorks();
    const shown = all.filter((w) => filter === 'all' || w.category === filter);
    const box = $('#windows');
    if (!shown.length) { box.innerHTML = `<p class="empty">${esc(t('work.empty'))}</p>`; return; }
    let n = 0;
    box.innerHTML = layoutRows(shown).map((row) => {
      const units = row.reduce((s, w) => s + (w.featured ? 3 : 2), 0);
      const U = Math.max(12, units);
      return `<div class="win-row">${row.map((w) => cardHTML(w, n++, w.featured ? 3 : 2, U)).join('')}</div>`;
    }).join('');
    $$('img.win-cover', box).forEach((img) => {
      const mark = () => {
        if (img.naturalHeight > img.naturalWidth * 1.05) {
          const v = img.closest('.win-view');
          v.classList.add('is-portrait');
          v.style.setProperty('--cover', `url("${img.currentSrc || img.src}")`);
        }
      };
      if (img.complete && img.naturalWidth) mark(); else img.addEventListener('load', mark, { once: true });
    });
    $$('canvas[data-gen]', box).forEach((cv) => {
      const w = works.find((x) => x._id === cv.dataset.gen);
      if (w) drawCover(cv, w, figMap.get(w._id));
    });
  }

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter');
    if (!b) return;
    filter = b.dataset.filter;
    renderFilters(); renderWorks();
  });
  $('#windows').addEventListener('click', (e) => {
    const view = e.target.closest('button.win-view');
    if (!view) return;
    const id = view.closest('.win').dataset.id;
    const w = works.find((x) => x._id === id);
    if (w) openWork(w);
  });

  function figOf(w) { return (CATS[w.category] && CATS[w.category][lang]) || ''; }

  function openWork(w) {
    const kind = kindOf(w);
    if (kind === 'audio') return playAudio(w);
    if (kind === 'video' || kind === 'embed') return openModal(w, kind);
    if (w.link) window.open(w.link, '_blank', 'noopener');
  }

  /* ───────── audio player ───────── */
  const player = $('#player');
  const seek = $('#pSeek');

  function playAudio(w) {
    ensureCtx();
    if (playingId === w._id) { audio.paused ? audio.play() : audio.pause(); return; }
    playingId = w._id;
    audio.src = mediaUrl(w.audio);
    routeAudioElement();
    audio.play().catch(() => {});
    player.hidden = false;
    updatePlayerText();
    markCards();
  }
  function updatePlayerText() {
    const w = works.find((x) => x._id === playingId);
    if (!w) return;
    $('#pFig').textContent = figOf(w);
    $('#pTitle').textContent = f(w, 'title');
    $('#pClose').setAttribute('aria-label', t('player.close'));
    $('#pToggle').setAttribute('aria-label', t(audio.paused ? 'player.play' : 'player.pause'));
  }
  function markCards() {
    $$('.win').forEach((c) => {
      const on = c.dataset.id === playingId;
      c.classList.toggle('playing', on);
      c.classList.toggle('paused', on && audio.paused);
    });
    player.classList.toggle('paused', audio.paused);
    $('#pToggle').setAttribute('aria-label', t(audio.paused ? 'player.play' : 'player.pause'));
  }
  audio.addEventListener('play', markCards);
  audio.addEventListener('pause', markCards);
  audio.addEventListener('ended', markCards);
  audio.addEventListener('error', () => {
    const w = works.find((x) => x._id === playingId);
    if (!w || !audio.getAttribute('src')) return;
    if (w.embed_url) {                       // file broken but a link exists: play the link instead
      audio.pause(); audio.removeAttribute('src'); audio.load();
      playingId = null; player.hidden = true; markCards();
      openModal(w, 'embed');
    } else {
      $('#pTitle').textContent = t('media.error');
      markCards();
    }
  });
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 0;
    const p = d ? audio.currentTime / d : 0;
    if (!seek.matches(':active')) seek.value = Math.round(p * 1000);
    seek.style.setProperty('--pct', `${p * 100}%`);
    $('#pTime').textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(d)}`;
  });
  seek.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
  });
  $('#pToggle').addEventListener('click', () => { ensureCtx(); audio.paused ? audio.play() : audio.pause(); });
  $('#pClose').addEventListener('click', () => {
    audio.pause(); playingId = null; player.hidden = true; markCards();
  });

  /* ───────── footer MERCU = spectrum of everything the page is playing ─────────
     Each letter holds FOOT_BARS bars; together they cover ~40 Hz – 14 kHz on a log scale.
     The bars are background layers clipped to the glyphs (background-clip: text). Anything that
     goes through the Web Audio master is measured: the SuperCollider layers, the work player and
     self-hosted videos. Embedded players (YouTube, Bilibili, …) are cross-origin and can't be. */
  const FOOT_BARS = 7;
  const FOOT_BAR_LAYER = 'linear-gradient(to right, transparent 14%, var(--glow) 14%, var(--glow) 86%, transparent 86%)';
  const FOOT_BAR_IMG = Array(FOOT_BARS).fill(FOOT_BAR_LAYER).join(',');
  const FOOT_BAR_POS = Array.from({ length: FOOT_BARS }, (_, k) => `${(k / (FOOT_BARS - 1) * 100).toFixed(3)}% 100%`).join(',');
  let footLetters = [];
  let footLevels = [];
  let footVisible = false;
  let footIdle = true;
  new IntersectionObserver(([en]) => { footVisible = en.isIntersecting; }).observe($('.footer-name'));

  function routeVideo(v) {
    if (!v || !ensureCtx()) return;
    try {
      const u = new URL(v.currentSrc || v.src, location.href);
      if (u.origin !== location.origin) return;   // cross-origin media would go silent in Web Audio
      actx.createMediaElementSource(v).connect(master);
    } catch (e) { /* already routed or not allowed: the video just plays normally */ }
  }

  function drawFooter() {
    if (!footVisible || !footLetters.length) return;
    const total = footLetters.length * FOOT_BARS;
    if (footLevels.length !== total) footLevels = new Array(total).fill(0);
    let any = false;
    if (analyser) {
      analyser.getByteFrequencyData(freqData);
      const nyq = actx.sampleRate / 2, n = freqData.length;
      const F0 = 40, F1 = 14000;
      for (let b = 0; b < total; b++) {
        const fa = F0 * Math.pow(F1 / F0, b / total), fb = F0 * Math.pow(F1 / F0, (b + 1) / total);
        const ia = Math.max(1, Math.floor(fa / nyq * n)), ib = Math.max(ia + 1, Math.ceil(fb / nyq * n));
        let peak = 0;
        for (let i = ia; i < ib && i < n; i++) peak = Math.max(peak, freqData[i]);
        // gentle tilt so the highs (which carry less energy) still move
        const tilt = 0.85 + 0.35 * (b / total);
        const target = Math.min(1, Math.pow(peak / 255, 1.6) * tilt * 1.15);
        const cur = footLevels[b];
        footLevels[b] = target > cur ? cur + (target - cur) * 0.6 : cur + (target - cur) * 0.12;
        if (footLevels[b] > 0.004) any = true;
      }
    }
    if (!any && footIdle) return;   // nothing playing and the letters are already empty
    footIdle = !any;
    footLetters.forEach((el, li) => {
      const sizes = [];
      for (let k = 0; k < FOOT_BARS; k++) {
        const v = any ? footLevels[li * FOOT_BARS + k] : 0;
        sizes.push(`${(100 / FOOT_BARS).toFixed(3)}% ${(v * 100).toFixed(1)}%`);
      }
      el.style.backgroundSize = sizes.join(',');
    });
  }

  /* ───────── video modal ───────── */
  const modal = $('#modal');
  function openModal(w, kind) {
    if (!audio.paused) audio.pause();
    modalWork = w;
    const body = $('#modalBody');
    const link = $('#modalLink');
    body.classList.remove('is-audio');
    body.style.height = '';
    link.hidden = true;
    if (kind === 'video') {
      body.innerHTML = `<video controls autoplay playsinline src="${esc(mediaUrl(w.video))}"${w.cover ? ` poster="${esc(mediaUrl(w.cover))}"` : ''}></video>`;
      $('#modalFile').textContent = basename(w.video);
      routeVideo(body.querySelector('video'));
      body.querySelector('video').addEventListener('error', () => {
        if (modalWork !== w) return;
        if (w.embed_url) openModal(w, 'embed');      // uploaded file broken: fall back to the link
        else body.innerHTML = `<p class="modal-error">${esc(t('media.error'))}</p>`;
      });
    } else {
      const emb = parseEmbed(w.embed_url);
      if (emb.audio) { body.classList.add('is-audio'); body.style.height = `${emb.height}px`; }
      body.innerHTML = `<iframe src="${esc(emb.src)}" title="${esc(f(w, 'title'))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      $('#modalFile').textContent = emb.host;
      link.href = w.embed_url;
      link.textContent = `${t('openOn')} ${emb.host} ↗`;
      link.hidden = false;
    }
    fillModalText();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#modalClose').focus({ preventScroll: true });
  }
  function fillModalText() {
    if (!modalWork) return;
    const w = modalWork;
    $('#modalFig').textContent = figOf(w);
    $('#modalTitle').textContent = f(w, 'title');
    $('#modalRole').textContent = [f(w, 'role'), w.year].filter(Boolean).join(' · ');
    $('#modalDesc').textContent = f(w, 'description');
  }
  function closeModal() {
    modal.hidden = true;
    $('#modalBody').innerHTML = '';
    modalWork = null;
    document.body.style.overflow = '';
  }
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ───────── ACTIVITY: reveal, photo wall, hover (mouse) / wheel (touch) ───────── */
  const actWheelMQ = matchMedia('(hover: none), (pointer: coarse)');
  let cvSeen = false, cvIO = null, actBound = false, actCur = -1, actWheel = false;
  let actCenters = [], actRaf = 0, actOffT = 0;
  function scrambleYear(el) {
    if (!el) return;
    const final = el.dataset.yr || '';
    if (reduceMotion || !/\d/.test(final)) return;
    const t0 = performance.now(), dur = 650;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const fixed = Math.floor(p * final.length);
      el.textContent = [...final].map((ch, i) =>
        i < fixed || !/\d/.test(ch) ? ch : String(Math.floor(Math.random() * 10))).join('');
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
  }
  function cvReveal() {
    const list = $('#cvList');
    const items = $$('li', list);
    if (cvIO) cvIO.disconnect();
    if (cvSeen || reduceMotion || !('IntersectionObserver' in window)) {
      list.classList.add('in'); items.forEach((li) => li.classList.add('in'));
      cvSeen = true; return;
    }
    const play = (lis) => lis.forEach((li, k) => {
      li.style.setProperty('--d', `${k * 120}ms`);
      list.classList.add('in');
      requestAnimationFrame(() => li.classList.add('in'));
      setTimeout(() => scrambleYear($('[data-yr]', li)), k * 120 + 120);
    });
    if (actWheel) {
      // in the wheel the rows are transformed, so watch the stage and reveal all at once
      cvIO = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        cvIO.disconnect(); cvSeen = true; play(items);
      }, { threshold: 0.3 });
      cvIO.observe($('#actStage'));
      return;
    }
    cvIO = new IntersectionObserver((entries) => {
      const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => items.indexOf(a) - items.indexOf(b));
      hits.forEach((li) => cvIO.unobserve(li));
      play(hits);
      if (items.every((li) => li.classList.contains('in') || hits.includes(li))) { cvSeen = true; cvIO.disconnect(); }
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });
    items.forEach((li) => cvIO.observe(li));
  }

  function actBuild() {
    const items = $$('#cvList li');
    const srcs = [...new Set(items.filter((li) => li.dataset.img).map((li) => li.dataset.img))];
    // single-photo layers (crossfade between them)
    const photos = $('#actPhotos');
    $$('img', photos).forEach((im) => { if (!srcs.includes(im.dataset.src)) im.remove(); });
    srcs.forEach((src) => {
      if ($$('img', photos).some((im) => im.dataset.src === src)) return;
      const im = new Image(); im.alt = ''; im.decoding = 'async';
      im.dataset.src = src; im.src = src; photos.appendChild(im);
    });
    // photo wall: columns of all photos, each column twice for a seamless drift
    const wall = $('#actWall');
    const key = srcs.join('|') + '@' + (innerWidth < 700 ? 3 : innerWidth < 1100 ? 4 : 5);
    if (wall.dataset.key !== key) {
      wall.dataset.key = key;
      const cols = innerWidth < 700 ? 3 : innerWidth < 1100 ? 4 : 5;
      if (!srcs.length) { wall.innerHTML = ''; }
      else {
        const per = Math.max(4, Math.ceil(srcs.length / cols) + 2);
        const ars = ['4 / 5', '1 / 1', '3 / 4', '4 / 3', '5 / 6'];
        let k = 0, html = '';
        for (let c = 0; c < cols; c++) {
          const col = [];
          for (let r = 0; r < per; r++) {
            col.push(`<img src="${srcs[(k + c * 3) % srcs.length]}" alt="" loading="lazy" decoding="async" style="--ar:${ars[(k + c) % ars.length]}">`);
            k++;
          }
          html += `<div class="act-col" style="--dur:${70 + c * 9}s">${col.join('')}${col.join('')}</div>`;
        }
        wall.innerHTML = html;
      }
    }
  }

  function actSelect(i) {
    const items = $$('#cvList li');
    if (i === actCur) return;
    actCur = i;
    items.forEach((li, k) => li.classList.toggle('cur', k === i));
    const li = items[i];
    const src = li && li.dataset.img;
    $$('#actPhotos img').forEach((im) => im.classList.toggle('on', !!src && im.dataset.src === src));
    $('#activity').classList.toggle('act-on', !!src);
  }
  function actClear(delay = 140) {
    clearTimeout(actOffT);
    actOffT = setTimeout(() => {
      actCur = -1;
      $$('#cvList li.cur').forEach((li) => li.classList.remove('cur'));
      $$('#actPhotos img.on').forEach((im) => im.classList.remove('on'));
      $('#activity').classList.remove('act-on');
    }, delay);
  }

  // wheel geometry: centres of each row inside the (untransformed) list
  function actMeasure() {
    const list = $('#cvList');
    actCenters = $$('li', list).map((li) => li.offsetTop + li.offsetHeight / 2);
  }
  function actWheelFrame() {
    actRaf = 0;
    if (!actWheel) return;
    const sec = $('#activity'), list = $('#cvList');
    const items = $$('li', list), n = items.length;
    if (!n) return;
    const r = sec.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const p = Math.min(1, Math.max(0, -r.top / span));
    const fpos = p * (n - 1);
    const i0 = Math.floor(fpos), i1 = Math.min(n - 1, i0 + 1), fr = fpos - i0;
    const c = actCenters[i0] + (actCenters[i1] - actCenters[i0]) * fr;
    const trackH = $('.act-track').clientHeight;
    list.style.transform = `translate3d(0, ${trackH / 2 - c}px, 0)`;
    items.forEach((li, k) => {
      const d = k - fpos, ad = Math.abs(d);
      const rot = reduceMotion ? 0 : Math.max(-60, Math.min(60, -d * 22));
      li.style.transform = `rotateX(${rot}deg) scale(${1 - Math.min(ad, 3) * 0.07})`;
      li.style.opacity = String(Math.max(0, 1 - ad * 0.62));
    });
    // only light up once we're actually inside the section
    if (r.top <= innerHeight * 0.35 && r.bottom >= innerHeight * 0.65) actSelect(Math.round(fpos));
    else if (actCur !== -1) actClear(0);
  }
  const actKick = () => { if (actWheel && !actRaf) actRaf = requestAnimationFrame(actWheelFrame); };

  function actMode() {
    const sec = $('#activity'), list = $('#cvList');
    actWheel = actWheelMQ.matches;
    sec.classList.toggle('is-wheel', actWheel);
    sec.style.setProperty('--n', $$('li', list).length || 1);
    if (!actWheel) {
      list.style.transform = '';
      $$('li', list).forEach((li) => { li.style.transform = ''; li.style.opacity = ''; });
      actClear(0);
    } else {
      actMeasure(); actKick();
    }
  }

  function activity() {
    actCur = -1;
    actBuild();
    actMode();
    cvReveal();
    if (actBound) { if (actWheel) { actMeasure(); actKick(); } return; }
    actBound = true;
    const list = $('#cvList');
    // mouse: hover a line → its photo fills the background
    list.addEventListener('pointerover', (e) => {
      if (actWheel || e.pointerType === 'touch') return;
      const li = e.target.closest('li');
      if (!li) return;
      clearTimeout(actOffT);
      actSelect(+li.dataset.i);
    });
    list.addEventListener('pointerleave', () => { if (!actWheel) actClear(); });
    list.addEventListener('focusin', (e) => {
      const li = e.target.closest('li');
      if (li && !actWheel) { clearTimeout(actOffT); actSelect(+li.dataset.i); }
    });
    list.addEventListener('focusout', () => { if (!actWheel) actClear(); });
    // wheel: tap a line to roll it to the centre
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li || !actWheel) return;
      const sec = $('#activity'), n = $$('li', list).length;
      const span = sec.offsetHeight - innerHeight;
      const top = sec.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + span * (+li.dataset.i / Math.max(1, n - 1)), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    addEventListener('scroll', actKick, { passive: true });
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { actBuild(); actMode(); }, 150);
    });
    (actWheelMQ.addEventListener ? actWheelMQ.addEventListener('change', actMode) : actWheelMQ.addListener(actMode));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (actWheel) { actMeasure(); actKick(); } });
  }

  /* ───────── tagline: word-by-word lighting (scroll + hover) ─────────
     Scrolling the hero away lights the words in reading order (reverse when scrolling back).
     With a mouse, hovering a word lights that word and every word before it. */
  const tgEl = $('#tagline');
  let tgWords = [];
  let tgHover = -1;
  function tgSplit(text, l) {
    if (l === 'zh') {
      let parts;
      if (window.Intl && Intl.Segmenter) {
        parts = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)].map((x) => ({ t: x.segment, w: x.isWordLike }));
      } else {
        parts = [...text].map((ch) => ({ t: ch, w: /[\p{L}\p{N}]/u.test(ch) }));
      }
      const out = [];
      for (const p of parts) {
        if (!p.t.trim()) continue;
        if (!p.w && out.length) out[out.length - 1] += p.t;   // punctuation rides with the word before it
        else out.push(p.t);
      }
      return out;
    }
    return text.split(/\s+/).filter(Boolean);
  }
  function tagline() {
    if (!tgEl) return;
    const text = f(site, 'tagline').trim();
    const words = tgSplit(text, lang);
    tgEl.innerHTML = words.map((w, i) => `<span class="w" data-i="${i}">${esc(w)}</span>`).join(lang === 'zh' ? '' : ' ');
    tgEl.setAttribute('aria-label', text);
    tgWords = $$('.w', tgEl);
    tgWords.forEach((el) => { el.setAttribute('aria-hidden', 'true'); el._a = -1; });
    tgHover = -1;
    tgUpdate();
  }
  function tgUpdate() {
    if (!tgWords.length) return;
    // scroll progress: 0 at the top of the page, 1 when the tagline has risen to ~22% of the viewport
    const r = tgEl.getBoundingClientRect();
    const docBottom = r.bottom + scrollY;
    const end = Math.max(60, docBottom - innerHeight * 0.22);
    const p = Math.min(1, Math.max(0, scrollY / end));
    const x = p * (tgWords.length + 0.6);
    for (let i = 0; i < tgWords.length; i++) {
      const el = tgWords[i];
      let a = Math.min(1, Math.max(0, x - i));
      if (tgHover >= 0 && i <= tgHover) a = 1;
      a = Math.round(a * 40) / 40;
      if (a !== el._a) {
        el._a = a;
        // hover lights up in a quick ripple toward the hovered word; scroll follows the scroll directly
        el.style.transitionDelay = tgHover >= 0 && i <= tgHover ? `${Math.min(i, 40) * 14}ms` : '0ms';
        el.style.setProperty('--a', a);
        el.classList.toggle('on', a >= 0.5);
      }
    }
  }
  let tgRaf = 0;
  const tgKick = () => { if (!tgRaf) tgRaf = requestAnimationFrame(() => { tgRaf = 0; tgUpdate(); }); };
  addEventListener('scroll', tgKick, { passive: true });
  addEventListener('resize', tgKick);
  if (tgEl && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tgEl.addEventListener('pointerover', (e) => {
      const w = e.target.closest && e.target.closest('.w');
      if (!w) return;
      const i = +w.dataset.i;
      if (i !== tgHover) { tgHover = i; tgUpdate(); }
    });
    tgEl.addEventListener('pointerleave', () => { tgHover = -1; tgUpdate(); });
  }

  /* ───────── site text, about, contact ───────── */
  function renderSite() {
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-site]').forEach((el) => { el.textContent = f(site, el.dataset.site); });
    tagline();
    $('#soundLabel').textContent = t(soundOn ? 'sound.on' : 'sound.off');

    const roles = site[`roles_${lang}`] || site.roles_en || [];
    $('#roles').innerHTML = roles.map((r) => `<li>${esc(typeof r === 'string' ? r : r.text || '')}</li>`).join('');

    const about = f(site, 'about');
    $('#aboutText').innerHTML = about.split(/\n\s*\n/).filter((p) => p.trim()).map((p) => `<p>${esc(p.trim())}</p>`).join('');
    $('#cvList').innerHTML = (site.cv || []).map((c, i) => {
      const img = c.image ? esc(mediaUrl(c.image)) : '';
      return `<li data-i="${i}"${img ? ` class="has-img" data-img="${img}"` : ''} tabindex="0"><span class="yr m"><span data-yr="${esc(c.year)}">${esc(c.year)}</span></span><span class="txt m"><span>${esc(f(c, 'text'))}${img ? '<i class="cv-cam" aria-hidden="true"></i>' : ''}</span></span></li>`;
    }).join('');
    activity();

    const email = site.email || '';
    const a = $('#email');
    a.textContent = email; a.href = email ? `mailto:${email}` : '#';
    $('#copyEmail').hidden = !email;
    $('#footLinks').innerHTML = (site.links || []).filter((l) => l && l.url).map((l) => {
      const label = (lang === 'zh' && l.label_zh) || l.label || l.label_zh || l.url;
      return `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(label)} ↗</a></li>`;
    }).join('');

    const cn = site.name_zh || '';
    // the hero shows the hand-written signature (inline SVG); keep its accessible name in sync
    const sigEl = $('#cnName svg');
    if (sigEl && cn) sigEl.setAttribute('aria-label', cn);
    const plain = (x) => String(x || '').replace(/\/\s*$/, '').trim();
    const fullName = [plain(site.name_line1), plain(site.name_line2)].filter(Boolean).join(' / ');
    $('#footName').textContent = cn ? `${fullName} · ${cn}` : fullName;
    nameEl.setAttribute('aria-label', cn ? `${fullName} ${cn}` : fullName);

    const frame = $('#portraitFrame');
    if (site.photo) {
      frame.classList.add('has-photo');
      frame.innerHTML = `<img src="${esc(mediaUrl(site.photo))}" alt="${esc(lang === 'zh' && cn ? cn : fullName)}" loading="lazy">`;
      $('#portraitFile').textContent = basename(site.photo);
    } else {
      frame.classList.remove('has-photo');
      frame.innerHTML = `<div class="portrait-empty"><div><p>${esc(t('photo.empty'))}</p></div></div>`;
      $('#portraitFile').textContent = 'portrait.jpg';
    }
    $('#portraitCap').textContent = cn ? `${fullName} · ${cn}` : fullName;
    $('#clockPlace').textContent = f(site, 'location') || t('localTime');
    tick();
  }

  $('#copyEmail').addEventListener('click', async () => {
    const btn = $('#copyEmail');
    try { await navigator.clipboard.writeText(site.email); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#email')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    btn.textContent = t('contact.copied');
    setTimeout(() => { btn.textContent = t('contact.copy'); }, 1600);
  });

  let clockFmt = null;
  function tick() {
    if (!clockFmt) {
      try { clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: site.timezone || undefined }); }
      catch (e) { clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    }
    $('#clock').textContent = clockFmt.format(new Date());
  }
  setInterval(tick, 15000);
  $('#year').textContent = new Date().getFullYear();

  /* ───────── pets walking under the name ───────── */
  function petNames() {
    $$('.pet').forEach((el) => {
      const tag = el.querySelector('.pet-tag');
      if (tag) tag.textContent = (lang === 'zh' ? el.dataset.zh : el.dataset.en) || '';
    });
  }
  (function pets() {
    const lane = $('#pets');
    if (!lane) return;
    const row = lane.querySelector('.pets-row');
    const ref = lane.querySelector('.pet-ubai .pet-body');   // 1 "lane" = Ubai's height
    // the pets walk on the spot; the meadow, forest and hills scroll past at different depths.
    // 0.55 lanes/s must match K in tools/pets_build.py, so paws on the ground move exactly with the grass.
    const SPEED = 0.55;
    const layers = [['.far', 600 / 100, 0.12], ['.mid', 420 / 100, 0.32], ['.near', 260 / 100, 1]]
      .map(([sel, ratio, depth]) => ({ el: lane.querySelector(sel), ratio, depth, x: 0 }))
      .filter((l) => l.el);

    // mouse: hovering a pet turns it to face you, leaving turns it straight back.
    // touch: a tap turns it (back after a few seconds, on a second tap, or on a tap elsewhere). keyboard: focus.
    const timers = new Map();
    row.addEventListener('pointerover', (e) => { overPet = !!e.target.closest('.pet'); });
    row.addEventListener('pointerleave', () => { overPet = false; });
    const sync = () => lane.classList.toggle('paused', reduceMotion);   // only the pet you point at turns; the rest keep walking
    const face = (pet, on, hold) => {
      clearTimeout(timers.get(pet));
      pet.classList.toggle('facing', on);
      pet.setAttribute('aria-pressed', String(on));
      if (on && hold) timers.set(pet, setTimeout(() => face(pet, false), hold));
      sync();
    };
    const pets = $$('.pet', row);
    pets.forEach((pet) => {
      pet.setAttribute('aria-pressed', 'false');
      pet.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') face(pet, true); });
      pet.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') face(pet, false); });
      pet.addEventListener('pointerup', (e) => {
        if (e.pointerType !== 'touch') return;
        const on = !pet.classList.contains('facing');
        pets.forEach((p) => { if (p !== pet && p.classList.contains('facing')) face(p, false); });
        face(pet, on, 3200);
      });
      pet.addEventListener('focus', () => { if (pet.matches(':focus-visible')) face(pet, true); });
      pet.addEventListener('blur', () => face(pet, false));
      pet.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); face(pet, !pet.classList.contains('facing')); }
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !e.target.closest('.pet')) pets.forEach((p) => { if (p.classList.contains('facing')) face(p, false); });
    });
    sync();
    if (reduceMotion) return;

    let last = 0;
    const tick = (t) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (!lane.classList.contains('paused')) {
        const speed = (ref ? ref.clientHeight : lane.clientHeight / 1.7) * SPEED;
        layers.forEach((l) => {
          const tile = l.el.clientHeight * l.ratio;
          if (!tile) return;
          l.x = (l.x + speed * l.depth * dt) % tile;
          l.el.style.backgroundPositionX = `${(-l.x).toFixed(1)}px`;
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();

  /* ───────── language ───────── */
  function setLang(l) {
    lang = l;
    try { localStorage.setItem('lang', l); } catch (e) { /* ignore */ }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    renderSite(); renderFilters(); renderWorks();
    if (playingId) updatePlayerText();
    fillModalText();
    petNames();
  }
  $$('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ───────── boot ───────── */
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(fitName);
  });

  async function getJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }

  async function boot() {
    try {
      const [s, w] = await Promise.all([getJSON('content/site.json'), getJSON('content/works.json')]);
      site = s || {};
      const list = Array.isArray(w) ? w : (w && w.works) || [];
      works = list.map((x, i) => ({ ...x, _id: `w${i}` }));
    } catch (err) {
      console.error(err);
      $('#windows').innerHTML = `<p class="empty">${esc(t('work.error'))}</p>`;
    }
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
    buildName();
    setLang(lang);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { fitName(); renderWorks(); });
    requestAnimationFrame(frame);
  }
  boot();
})();
