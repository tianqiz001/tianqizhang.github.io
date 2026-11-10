/* Mercu / Tianqi Zhang — single work page (work.html?w=<slug>)
   Reads content/works.json (edited through Pages CMS) and renders one work:
   title, media, metadata, program note, performances, credits, previous / next. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const UI = {
    en: {
      'nav.work': 'Work', 'nav.about': 'About', 'nav.activity': 'Activity', 'nav.contact': 'Contact',
      'wp.back': '← All work', 'wp.year': 'Year', 'wp.role': 'Role', 'wp.cat': 'Category',
      'wp.media': 'Media', 'wp.note': 'Program note', 'wp.perf': 'Performances & screenings',
      'wp.credits': 'Credits', 'wp.link': 'More', 'wp.prev': 'Previous', 'wp.next': 'Next',
      'wp.missing': 'This work could not be found.', 'wp.error': 'The work list could not be loaded.',
      'openOn': 'Open on', 'media.error': 'This file could not be played. It may be missing or still uploading.',
      'm.audio': 'Audio', 'm.video': 'Video'
    },
    zh: {
      'nav.work': '作品', 'nav.about': '关于', 'nav.activity': '经历', 'nav.contact': '联系',
      'wp.back': '← 全部作品', 'wp.year': '年份', 'wp.role': '角色', 'wp.cat': '类别',
      'wp.media': '媒介', 'wp.note': '作品说明', 'wp.perf': '演出与放映',
      'wp.credits': '创作人员', 'wp.link': '更多', 'wp.prev': '上一个', 'wp.next': '下一个',
      'wp.missing': '没有找到这个作品。', 'wp.error': '作品列表加载失败。',
      'openOn': '在新窗口打开：', 'media.error': '这个文件无法播放，可能是文件缺失或还没有上传成功。',
      'm.audio': '音频', 'm.video': '视频'
    }
  };
  /* keep in step with CATS in app.js and the options in .pages.yml */
  const CATS = {
    film:       { en: 'Film & TV',    zh: '影视配乐' },
    game:       { en: 'Games',        zh: '游戏音乐' },
    fixedmedia: { en: 'Fixed Media',  zh: '固定媒体' },
    electronic: { en: 'Electronic',   zh: '电子 / 计算机音乐' },
    popsongs:   { en: 'Pop Songs',    zh: '流行歌曲' },
    instrument: { en: 'Instruments',  zh: '乐器与交互' }
  };

  let lang = 'en';
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'zh') lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('zh')) lang = 'zh';
  } catch (e) { /* storage blocked */ }

  const t = (k) => (UI[lang] && UI[lang][k]) || UI.en[k] || k;
  const f = (o, k) => (o && (o[`${k}_${lang}`] || o[`${k}_en`] || o[`${k}_zh`])) || '';
  const other = (o, k) => (o && o[`${k}_${lang === 'en' ? 'zh' : 'en'}`]) || '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mediaUrl = (p) => !p ? '' : (/^(https?:)?\/\//.test(p) || p.startsWith('data:')) ? p : p.replace(/^\/+/, '');
  const basename = (p) => (p || '').split('/').pop();
  /* same rule as app.js: the page address of a work */
  const slugify = (s) => String(s || 'untitled').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'untitled';
  function assignSlugs(list) {
    const seen = new Map();
    list.forEach((w) => {
      let s = slugify(w.slug || w.title_en || w.title_zh);
      const n = (seen.get(s) || 0) + 1; seen.set(s, n);
      if (n > 1) s = `${s}-${n}`;
      w._slug = s;
    });
  }
  /* every line break starts a new paragraph */
  const paras = (s) => String(s || '').trim().split(/\s*\n\s*/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');

  function parseEmbed(url) {
    if (!url) return null;
    let m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)))
      return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, host: 'youtube.com' };
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
      return { kind: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}?title=0&byline=0`, host: 'vimeo.com' };
    if ((m = url.match(/bilibili\.com\/video\/(BV[\w]+)/i))) {
      const bp = (url.match(/[?&]p=(\d+)/) || [])[1];
      return { kind: 'bilibili', src: `https://player.bilibili.com/player.html?bvid=${m[1]}${bp ? `&p=${bp}` : ''}&autoplay=0&high_quality=1&danmaku=0`, host: 'bilibili.com' };
    }
    if ((m = url.match(/music\.163\.com\/.*?song(?:\?id=|\/)(\d+)/)))
      return { kind: 'netease', audio: true, height: 90, src: `https://music.163.com/outchain/player?type=2&id=${m[1]}&auto=0&height=66`, host: 'music.163.com' };
    if ((m = url.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/(\w+)/)))
      return { kind: 'spotify', audio: true, height: m[1] === 'track' ? 152 : 352, src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, host: 'spotify.com' };
    if ((m = url.match(/music\.apple\.com\/(.+)/)))
      return { kind: 'apple', audio: true, height: /[?&]i=/.test(url) ? 175 : 450, src: `https://embed.music.apple.com/${m[1]}`, host: 'music.apple.com' };
    if (/soundcloud\.com\//.test(url))
      return { kind: 'soundcloud', audio: true, height: 166, src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`, host: 'soundcloud.com' };
    return { kind: 'other', src: url, host: (() => { try { return new URL(url).hostname; } catch (e) { return 'embed'; } })() };
  }
  function kindOf(w) {
    if (w.media_type === 'none') return 'none';
    if (w.media_type === 'audio' && w.audio) return 'audio';
    if (w.media_type === 'video' && w.video) return 'video';
    if (w.media_type === 'embed' && w.embed_url) return 'embed';
    if (w.audio) return 'audio';
    if (w.video) return 'video';
    if (w.embed_url) return 'embed';
    return 'none';
  }

  let works = [], work = null, idx = -1, failed = false;

  /* ── media: built once per work, so switching language never restarts playback ── */
  function buildMedia(kind) {
    const box = $('#wpMedia'), stage = $('#wpStage'), open = $('#wpOpen');
    const w = work;
    if (kind === 'none') { box.hidden = true; return; }
    box.hidden = false;
    stage.className = 'wp-stage';
    stage.style.height = '';
    open.hidden = true;
    if (kind === 'video') {
      stage.innerHTML = `<video controls playsinline preload="metadata" src="${esc(mediaUrl(w.video))}"${w.cover ? ` poster="${esc(mediaUrl(w.cover))}"` : ''}></video>`;
      $('#wpFile').textContent = basename(w.video);
      stage.querySelector('video').addEventListener('error', () => {
        if (w.embed_url) buildMedia('embed');          // uploaded file broken: use the link instead
        else stage.innerHTML = `<p class="modal-error">${esc(t('media.error'))}</p>`;
      });
    } else if (kind === 'audio') {
      stage.classList.add('is-audio-file');
      stage.innerHTML = `${w.cover ? `<img class="wp-audio-cover" src="${esc(mediaUrl(w.cover))}" alt="">` : ''}
        <audio controls preload="metadata" src="${esc(mediaUrl(w.audio))}"></audio>`;
      $('#wpFile').textContent = basename(w.audio);
      stage.querySelector('audio').addEventListener('error', () => {
        if (w.embed_url) buildMedia('embed');
      });
    } else {
      const emb = parseEmbed(w.embed_url);
      if (emb.audio) { stage.classList.add('is-audio'); stage.style.height = `${emb.height}px`; }
      stage.innerHTML = `<iframe src="${esc(emb.src)}" title="${esc(f(w, 'title'))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`;
      $('#wpFile').textContent = emb.host;
      open.href = w.embed_url;
      open.dataset.host = emb.host;
      open.hidden = false;
    }
    fillOpenLink();
  }
  function fillOpenLink() {
    const open = $('#wpOpen');
    if (open.dataset.host) open.textContent = `${t('openOn')} ${open.dataset.host} ↗`;
  }

  /* ── text parts: re-rendered on language change ── */
  function renderText() {
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('#year').textContent = new Date().getFullYear();

    if (failed || !work) {
      $('#wpHead').innerHTML = `<p class="empty">${esc(t(failed ? 'wp.error' : 'wp.missing'))}</p>`;
      return;
    }
    const w = work;
    const title = f(w, 'title') || 'Untitled';
    const alt = other(w, 'title');
    const cat = (CATS[w.category] && CATS[w.category][lang]) || '';
    document.title = `${title} · Tianqi Zhang / Mercu · 张天琪`;

    $('#wpHead').innerHTML = `
      ${cat ? `<p class="label sec-title wp-cat"><span>${esc(cat)}</span></p>` : ''}
      <h1 class="wp-title">${esc(title)}</h1>
      ${alt && alt !== title ? `<p class="wp-alt">${esc(alt)}</p>` : ''}`;

    const kind = kindOf(w);
    const emb = kind === 'embed' ? parseEmbed(w.embed_url) : null;
    const mediaWord = kind === 'audio' || (emb && emb.audio) ? t('m.audio') : kind === 'none' ? '' : t('m.video');
    const rows = [
      ['wp.year', w.year],
      ['wp.role', f(w, 'role')],
      ['wp.cat', cat],
      ['wp.media', f(w, 'medium') || mediaWord]
    ].filter((r) => r[1]);
    $('#wpMeta').innerHTML = `<dl class="wp-dl">${rows.map(([k, v]) => `<div><dt class="label">${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${w.link ? `<a class="wp-ext label" href="${esc(w.link)}" target="_blank" rel="noopener">${esc(t('wp.link'))} ↗</a>` : ''}`;

    /* Program note: its own field if filled in, otherwise the description.
       When both exist, the description becomes the lead paragraph above the note. */
    const desc = f(w, 'description');
    const note = f(w, 'program_note');
    const perf = (Array.isArray(w.performances) ? w.performances : []).filter((p) => p && (p.date || f(p, 'event') || p.venue));
    const credits = f(w, 'credits');
    let html = '';
    if (note && desc) html += `<div class="wp-lead">${paras(desc)}</div>`;
    if (note || desc) html += `<section class="wp-sec"><h2 class="label wp-h">${esc(t('wp.note'))}</h2><div class="wp-prose">${paras(note || desc)}</div></section>`;
    if (perf.length) {
      html += `<section class="wp-sec"><h2 class="label wp-h">${esc(t('wp.perf'))}</h2><ol class="wp-perf">${perf.map((p) => `
        <li><span class="label wp-date">${esc(p.date || '')}</span>
          <span class="wp-ev"><strong>${esc(f(p, 'event'))}</strong>${p.venue ? `<span>${esc(p.venue)}</span>` : ''}</span></li>`).join('')}</ol></section>`;
    }
    if (credits) html += `<section class="wp-sec"><h2 class="label wp-h">${esc(t('wp.credits'))}</h2><div class="wp-prose wp-credits">${paras(credits)}</div></section>`;
    $('#wpText').innerHTML = html;

    /* previous / next among visible works, wrapping around */
    const n = works.length;
    if (n > 1) {
      const card = (x, k) => {
        const cover = x.cover ? mediaUrl(x.cover) : (x.embed_url && (parseEmbed(x.embed_url) || {}).thumb) || '';
        return `<a class="wp-pg wp-pg-${k}" href="work.html?w=${encodeURIComponent(x._slug)}">
          <span class="wp-pg-thumb">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : ''}</span>
          <span class="wp-pg-txt"><span class="label">${esc(t(k === 'prev' ? 'wp.prev' : 'wp.next'))}</span><strong>${esc(f(x, 'title'))}</strong></span></a>`;
      };
      $('#wpPager').innerHTML = card(works[(idx - 1 + n) % n], 'prev') + card(works[(idx + 1) % n], 'next');
    }
    fillOpenLink();
  }

  $$('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
    renderText();
  }));

  async function boot() {
    try {
      const r = await fetch('content/works.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const list = (Array.isArray(j) ? j : (j && j.works) || []);
      assignSlugs(list);                         // on the full list, so addresses match the home page
      works = list.filter((w) => !w.hidden);
      const want = new URLSearchParams(location.search).get('w') || '';
      idx = works.findIndex((w) => w._slug === want);
      work = idx >= 0 ? works[idx] : null;
    } catch (e) { console.error(e); failed = true; }
    renderText();
    if (work) buildMedia(kindOf(work));
    window.scrollTo(0, 0);
  }
  boot();
})();
