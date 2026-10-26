(() => {
  'use strict';

  const RECIPES = window.RECIPES || [];
  const STORE_KEY = 'chichecipes:v1';
  const MIN_CARDS = 2; // keep the shelf at least one row wide
  const NS = 'http://www.w3.org/2000/svg';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ───────── persistence (ticks + scale per recipe) ───────── */
  let saved = { ticks: {}, scale: {} };
  try { saved = Object.assign(saved, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { /* private mode etc. */ }
  const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) { /* ignore */ } };

  /* ───────── quantity formatting ───────── */
  const FRACTIONS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];

  function fraction(n) {
    if (n >= 10) return String(Math.round(n));
    let whole = Math.floor(n);
    let best = FRACTIONS[0];
    for (const f of FRACTIONS) if (Math.abs(n - whole - f[0]) < Math.abs(n - whole - best[0])) best = f;
    if (best[0] === 1) whole += 1;
    const glyph = best[0] === 1 ? '' : best[1];
    return (whole || glyph ? `${whole || ''}${glyph}` : '0');
  }

  function decimal(n) {
    if (n >= 100) return String(Math.round(n / 5) * 5);
    if (n >= 10) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }

  /** Returns { text, value } for display, picking friendlier units as amounts grow or shrink. */
  function amount(qty, unit, whole) {
    if (unit === 'g') return qty >= 1000 ? { text: `${Math.round(qty / 10) / 100} kg`, value: qty } : { text: `${decimal(qty)} g`, value: qty };
    if (unit === 'ml') return qty >= 1000 ? { text: `${Math.round(qty / 10) / 100} L`, value: qty } : { text: `${decimal(qty)} ml`, value: qty };
    if (unit === 'tsp' || unit === 'tbsp' || unit === 'cup') {
      const tsp = qty * { tsp: 1, tbsp: 3, cup: 48 }[unit];
      if (tsp >= 48) return { text: `${fraction(tsp / 48)} cup${tsp / 48 > 1 ? 's' : ''}`, value: tsp / 48 };
      if (tsp >= 3) return { text: `${fraction(tsp / 3)} tbsp`, value: tsp / 3 };
      return tsp < 1 / 16 ? { text: 'a pinch', value: 1 } : { text: `${fraction(tsp)} tsp`, value: tsp };
    }
    const n = whole ? Math.max(1, Math.round(qty)) : qty;
    return { text: whole ? String(n) : fraction(n), value: n };
  }

  function describe(ing, scale) {
    const a = amount(ing.qty * scale, ing.unit, ing.whole);
    const name = typeof ing.name === 'string' ? ing.name : (a.value > 1 ? ing.name.many : ing.name.one);
    let note = '';
    if (ing.note) {
      const [lo, hi] = ing.note.range.map(v => amount(v * scale, ing.note.unit).text);
      const loNum = lo.replace(/ ?[a-zA-Z]+$/, ''), loUnit = lo.replace(loNum, '').trim();
      const hiUnit = hi.replace(/^[\d.]+ ?/, '');
      note = `${ing.note.before || ''}${loUnit === hiUnit ? loNum : lo}–${hi}${ing.note.after || ''}`;
    }
    return { qty: a.text, name, note };
  }

  const prettyScale = n => String(Math.round(n * 100) / 100);

  /* ───────── fairy lights ───────── */
  function buildLights() {
    const box = $('#lights');
    const vw = window.innerWidth;
    const swags = Math.max(2, Math.round(vw / 360));
    const perSwag = Math.max(3, Math.round(vw / swags / 80));
    const y = f => 12 + 30 * 4 * f * (1 - f);
    let d = '';
    for (let i = 0; i <= swags * 24; i++) {
      const x = i / (swags * 24), f = (x * swags) % 1 || (i === 0 ? 0 : 1);
      d += `${i ? 'L' : 'M'}${(x * 1000).toFixed(1)},${y(f).toFixed(1)} `;
    }
    box.innerHTML = `<svg viewBox="0 0 1000 74" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
    $('path', box).setAttribute('vector-effect', 'non-scaling-stroke');
    for (let s = 0; s < swags; s++) {
      for (let k = 1; k <= perSwag; k++) {
        const f = k / (perSwag + 1), x = (s + f) / swags;
        const b = document.createElement('i');
        b.className = 'bulb';
        b.style.left = (x * 100) + '%';
        b.style.top = (y(f) - 2) + 'px';
        b.style.animationDelay = (-((s * 7 + k * 3) % 11) * 0.31) + 's';
        box.appendChild(b);
      }
    }
  }

  /* ───────── the shelf ───────── */
  const grid = $('#grid');
  const stage = $('#stage');
  const veil = $('#veil');
  let current = null; // { recipe, card }
  let busy = false;

  const BLANK_DOODLE = `<svg viewBox="0 0 60 60" aria-hidden="true" fill="none" stroke="#e6c99d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 48 L16 36 L42 10 L50 18 L24 44 Z"/><path d="M38 14 L46 22 M12 48 L24 44"/></svg>`;

  /** Where the opened page sits. Cards take the aspect ratio of the page's folded half. */
  function geometry() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const header = $('.top');
    const top = Math.round(header.offsetTop + header.offsetHeight + 8);
    const width = Math.min(780, vw - 20);
    const bottom = Math.max(64, Math.min(130, vh * 0.15));
    const height = clamp(vh - top - bottom, 340, 680);
    return { top, left: Math.round((vw - width) / 2), width, height };
  }
  const px = g => ({ top: g.top + 'px', left: g.left + 'px', width: g.width + 'px', height: g.height + 'px' });

  function fitCards() {
    const g = geometry();
    grid.style.setProperty('--r', ((g.height / 2) / g.width).toFixed(4));
  }

  function renderGrid() {
    grid.innerHTML = '';
    fitCards();
    RECIPES.forEach(r => {
      const card = document.createElement('button');
      card.className = 'card paper';
      card.type = 'button';
      card.dataset.id = r.id;
      card.setAttribute('aria-label', `Open ${r.title}`);
      card.innerHTML = `<span class="doodle">${r.doodle || ''}</span><span class="c-text"><span class="c-title"></span><span class="c-meta"></span></span>`;
      $('.c-title', card).textContent = r.title;
      $('.c-meta', card).textContent = r.blurb || `${r.ingredients.length} ingredients`;
      card.addEventListener('click', () => openRecipe(r, card));
      grid.appendChild(card);
    });
    const total = Math.max(MIN_CARDS, Math.ceil(RECIPES.length / 2) * 2);
    for (let i = RECIPES.length; i < total; i++) {
      const blank = document.createElement('div');
      blank.className = 'card blank';
      blank.innerHTML = `<span class="doodle">${BLANK_DOODLE}</span><span class="c-text"><span class="c-title">a blank page</span></span>`;
      grid.appendChild(blank);
    }
  }

  /* ───────── the quill + inkwell ───────── */
  function quillSVG() {
    const tipY = 12, endY = 152, half = y => {
      const t = (y - tipY) / (endY - tipY);
      return 18 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.85);
    };
    const side = dir => {
      let pts = '';
      for (let y = tipY; y <= endY; y += 4) pts += `${(22 + dir * half(y) * (dir < 0 ? 0.88 : 1)).toFixed(1)},${y} `;
      return pts;
    };
    let barbs = '';
    for (let y = 20; y < endY - 6; y += 4.2) {
      const h = half(y - 8) * 0.96;
      barbs += `<path d="M22,${y} L${(22 - h * 0.88).toFixed(1)},${(y - 8).toFixed(1)} M22,${y} L${(22 + h).toFixed(1)},${(y - 8).toFixed(1)}"/>`;
    }
    return `<svg viewBox="0 0 44 190" aria-hidden="true">
      <defs>
        <linearGradient id="vane" x1="0" x2="1"><stop offset="0" stop-color="#f4e9d0"/><stop offset=".5" stop-color="#fffaf0"/><stop offset="1" stop-color="#ecdcb9"/></linearGradient>
      </defs>
      <polygon points="${side(-1)} ${side(1).split(' ').reverse().join(' ')}" fill="url(#vane)" stroke="#b79b69" stroke-width=".8" stroke-linejoin="round"/>
      <g stroke="#a98b57" stroke-opacity=".38" stroke-width=".55" fill="none">${barbs}</g>
      <path d="M22,10 L22,170" stroke="#d6bd8a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M22,150 L22,176" stroke="#cfae6e" stroke-width="3" stroke-linecap="round"/>
      <path d="M20.4,170 L23.6,170 L22.9,190 L21.1,190Z" fill="#d9bb7c" stroke="#a98450" stroke-width=".5"/>
      <path d="M21.2,181 L22.8,181 L22.9,190 L21.1,190Z" fill="#1f2b63"/>
    </svg>`;
  }

  const WELL_BACK = `<svg viewBox="0 0 96 88" aria-hidden="true">
      <ellipse cx="48" cy="30" rx="23" ry="7" fill="#0a0f2c"/>
      <path d="M25,30 Q48,22 71,30" fill="none" stroke="#b98a35" stroke-width="2.4"/>
    </svg>`;
  const WELL_FRONT = `<svg viewBox="0 0 96 88" aria-hidden="true">
      <defs>
        <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#3a4d8c"/><stop offset=".45" stop-color="#1b2655"/><stop offset="1" stop-color="#0d1332"/></linearGradient>
        <linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#a87626"/><stop offset=".35" stop-color="#f0cf7e"/><stop offset="1" stop-color="#8a5c18"/></linearGradient>
      </defs>
      <ellipse cx="48" cy="82" rx="42" ry="6.5" fill="#2c1606" opacity=".32"/>
      <path d="M26,33 C9,41 4,68 17,78 C30,86 66,86 79,78 C92,68 87,41 70,33 Q48,43 26,33Z" fill="url(#glass)" stroke="#0a0f2a" stroke-width="1.5"/>
      <path d="M17,52 C15,62 19,70 26,75" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="3" stroke-linecap="round"/>
      <path d="M70,46 C73,52 74,58 72,64" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2" stroke-linecap="round"/>
      <path d="M24,30 Q48,40 72,30 L72,35 Q48,45 24,35Z" fill="url(#brass)" stroke="#6e4a14" stroke-width="1"/>
    </svg>`;

  /* ───────── the page ───────── */
  const PAPER_DETAILS = '<div class="coffee"></div>';

  function buildInner(r) {
    const scale = saved.scale[r.id] || 1;
    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.innerHTML = `
      ${PAPER_DETAILS}
      <button class="back" type="button">‹ back to the shelf</button>
      <h2></h2>
      <p class="blurb"></p>
      <div class="scale-wrap"><div class="scale">
        <div class="scale-head">
          <label for="scale-range">scale it up</label>
          <span class="scale-val">×<input id="scale-num" type="number" inputmode="decimal" min="0.01" step="any" aria-label="Scale multiplier"></span>
        </div>
        <div class="scale-row">
          <input id="scale-range" type="range" min="0.25" max="10" step="0.25" aria-label="Scale slider">
          <button type="button" class="reset-scale">back to ×1</button>
        </div>
      </div></div>
      <h3>Ingredients</h3>
      <ul class="ings"></ul>
      <div class="foot"><span>tap an ingredient to cross it off</span><button type="button" class="rub">rub out the ink</button></div>`;
    $('h2', inner).textContent = r.title;
    if (r.blurb) $('.blurb', inner).textContent = r.blurb; else $('.blurb', inner).remove();

    if (r.method && r.method.length) {
      const ol = document.createElement('ol');
      ol.className = 'method';
      r.method.forEach(step => { const li = document.createElement('li'); li.textContent = step; ol.appendChild(li); });
      const h = document.createElement('h3');
      h.textContent = 'Method';
      h.style.marginTop = '24px';
      $('.foot', inner).before(h, ol);
    }

    const list = $('.ings', inner);
    const ticks = saved.ticks[r.id] || (saved.ticks[r.id] = {});
    r.ingredients.forEach((ing, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ing' + (ticks[i] ? ' crossed' : '');
      btn.dataset.i = i;
      btn.setAttribute('aria-pressed', ticks[i] ? 'true' : 'false');
      btn.innerHTML = `<span class="ink main"><span class="qty"></span> <span class="nm"></span></span><span class="ink note"></span>`;
      btn.addEventListener('click', () => toggleTick(r, btn, i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    const range = $('#scale-range', inner), num = $('#scale-num', inner);
    const apply = (value, from) => {
      saved.scale[r.id] = value;
      if (from !== 'range') range.value = clamp(value, 0.25, 10);
      if (from !== 'num') num.value = prettyScale(value);
      updateQuantities(r, value);
      persist();
    };
    range.addEventListener('input', () => apply(parseFloat(range.value), 'range'));
    num.addEventListener('input', () => { const v = parseFloat(num.value); if (v > 0 && isFinite(v)) apply(Math.min(v, 10000), 'num'); });
    num.addEventListener('blur', () => { num.value = prettyScale(saved.scale[r.id] || 1); });
    $('.reset-scale', inner).addEventListener('click', () => apply(1));
    $('.back', inner).addEventListener('click', closeRecipe);
    $('.rub', inner).addEventListener('click', () => {
      saved.ticks[r.id] = {};
      persist();
      cancelJobs();
      $$('.ing.crossed', inner).forEach(b => { b.classList.remove('crossed'); b.setAttribute('aria-pressed', 'false'); });
    });

    range.value = clamp(scale, 0.25, 10);
    num.value = prettyScale(scale);
    return inner;
  }

  function updateQuantities(r, scale) {
    $$('.ing', stage).forEach((btn, i) => {
      const d = describe(r.ingredients[i], scale);
      $('.qty', btn).textContent = d.qty;
      $('.nm', btn).textContent = d.name;
      const note = $('.note', btn);
      note.textContent = d.note;
      note.hidden = !d.note;
    });
    relayoutStrikes();
  }

  /* ───────── quill strikes ───────── */
  function rng(seed) { // tiny deterministic PRNG so each ingredient keeps its own scribble
    let s = seed * 9301 + 49297;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  }

  /** (Re)draws the two pen strokes for one text span; returns its [forward, back] paths. */
  function layoutStrike(btn, ink, seed) {
    if (!ink._svg) {
      ink._svg = document.createElementNS(NS, 'svg');
      ink._svg.classList.add('strike');
      ink._svg.setAttribute('aria-hidden', 'true');
      ink._svg.append(document.createElementNS(NS, 'path'), document.createElementNS(NS, 'path'));
      btn.appendChild(ink._svg);
    }
    const w = ink.offsetWidth, h = ink.offsetHeight, pad = 7;
    const svg = ink._svg;
    svg.setAttribute('width', w + pad * 2);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w + pad * 2} ${h}`);
    svg.style.left = (ink.offsetLeft - pad) + 'px';
    svg.style.top = ink.offsetTop + 'px';

    const rand = rng(seed + 3);
    const y = h * 0.58, wob = () => (rand() - 0.5) * 3.2;
    const segs = Math.max(3, Math.round(w / 38));
    const step = (w + pad * 2 - 4) / segs;
    let d = `M2,${(y + 2 + wob()).toFixed(1)}`;
    for (let s = 1; s <= segs; s++) {
      const x = 2 + step * s, slope = (-3 * s) / segs;
      d += ` Q${(x - step / 2).toFixed(1)},${(y + wob() * 1.5 + slope).toFixed(1)} ${x.toFixed(1)},${(y + slope + wob()).toFixed(1)}`;
    }
    const endY = y - 3;
    const back = `M${w + pad - 1},${(endY + 4).toFixed(1)} Q${(w * 0.65).toFixed(1)},${(y + 5 + wob()).toFixed(1)} ${(w * 0.3 + pad).toFixed(1)},${(y + 1 + wob()).toFixed(1)}`;
    const paths = svg.querySelectorAll('path');
    paths[0].setAttribute('d', d);
    paths[1].setAttribute('d', back);
    return paths;
  }

  const strikeInks = btn => $$('.ink', btn).filter(ink => !ink.hidden);
  const hidePath = p => { const len = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; return len; };

  function relayoutStrikes(root = stage) {
    $$('.ing', root).forEach(btn => {
      if (btn._job) return; // a strike is queued or being drawn; leave it alone
      const seed = Number(btn.dataset.i) * 11;
      $$('.ink', btn).forEach((ink, k) => {
        if (!ink._svg && !btn.classList.contains('crossed')) return;
        const paths = layoutStrike(btn, ink, seed + k);
        ink._svg.style.display = ink.hidden ? 'none' : '';
        paths.forEach(p => { p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
      });
    });
  }

  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  let queue = [];
  let running = null;

  function tween(job, dur, fn) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const step = now => {
        if (job.cancelled) return resolve(false);
        const t = clamp((now - t0) / dur, 0, 1);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(step); else resolve(true);
      };
      requestAnimationFrame(step);
    });
  }

  async function runStrike(job) {
    const btn = job.btn;
    const quill = $('.quill', stage), well = $('.well', stage);
    const wr = well.getBoundingClientRect();
    const REST = { x: 48, y: 40, a: -14 }, WRITE_A = 22;
    let pos = { ...REST };
    const place = p => { pos = p; quill.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.a.toFixed(1)}deg)`; };
    const local = (x, y) => ({ x: x - wr.left, y: y - wr.top });

    const segs = [];
    strikeInks(btn).forEach((ink, k) => {
      const paths = layoutStrike(btn, ink, Number(btn.dataset.i) * 11 + k);
      (k === 0 ? [paths[0], paths[1]] : [paths[0]]).forEach(p => segs.push({ p, ink, len: hidePath(p), dur: 0 }));
      if (k !== 0) hidePath(paths[1]);
    });
    segs.forEach(s => { s.dur = Math.min(800, 200 + s.len * 2.6); });
    void btn.offsetWidth;
    segs.forEach(s => { s.p.style.transition = ''; });
    const at = (s, f) => { const pt = s.p.getPointAtLength(s.len * f), r = s.ink._svg.getBoundingClientRect(); return local(r.left + pt.x, r.top + pt.y); };

    const travel = (to, dur, lift) => {
      const from = { ...pos };
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
      return tween(job, dur, e => {
        const u = 1 - e;
        place({
          x: u * u * from.x + 2 * u * e * mid.x + e * e * to.x,
          y: u * u * from.y + 2 * u * e * mid.y + e * e * to.y,
          a: from.a + (to.a - from.a) * e,
        });
      });
    };

    quill.style.willChange = 'transform';
    let ok = await travel({ ...at(segs[0], 0), a: WRITE_A }, 650, 70);
    for (let i = 0; ok && i < segs.length; i++) {
      const s = segs[i];
      if (i === 0 || s.ink !== segs[i - 1].ink) btn.classList.add('crossed');
      ok = await tween(job, s.dur, e => {
        s.p.style.strokeDashoffset = s.len * (1 - e);
        place({ ...at(s, e), a: WRITE_A + Math.sin(e * 9) * 1.5 });
      });
      if (ok && i < segs.length - 1) ok = await travel({ ...at(segs[i + 1], 0), a: WRITE_A }, 160, 14);
    }
    job.cancelled = false; // always return the quill to its pot
    await travel({ ...REST, y: REST.y }, 700, 60);
    quill.style.willChange = '';
  }

  async function pump() {
    if (running) return;
    while (queue.length) {
      const job = queue.shift();
      running = job;
      if (!job.cancelled) {
        const wasCancelled = () => job.cancelled;
        try { await runStrike(job); } catch (e) { /* stage was torn down */ }
        if (wasCancelled()) job.btn.classList.remove('crossed');
      }
      job.btn._job = null;
      running = null;
    }
  }

  function cancelJobs() {
    queue.forEach(j => { j.cancelled = true; j.btn._job = null; });
    queue = [];
    if (running) running.cancelled = true;
  }

  function toggleTick(r, btn, i) {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    saved.ticks[r.id] = saved.ticks[r.id] || {};
    if (on) saved.ticks[r.id][i] = true; else delete saved.ticks[r.id][i];
    persist();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      if (reduced()) { btn.classList.add('crossed'); relayoutStrikes(); return; }
      const job = { btn, cancelled: false };
      btn._job = job;
      queue.push(job);
      pump();
    } else {
      if (btn._job) { btn._job.cancelled = true; }
      btn.classList.remove('crossed');
    }
  }

  /* ───────── unfold / fold ───────── */
  const rotOf = card => parseFloat(getComputedStyle(card).getPropertyValue('--rot')) || 0;
  const stripIds = root => $$('[id]', root).forEach(n => n.removeAttribute('id'));

  /** The lower half of the page, hinged at the middle: its outside is the card, its inside the ingredients. */
  function makeFlap(card, s) {
    const flap = document.createElement('div');
    flap.className = 'flap';
    flap.setAttribute('aria-hidden', 'true');
    const front = document.createElement('div');
    front.className = 'face flap-front';
    const clone = document.createElement('div');
    clone.className = 'clone';
    const page = $('.page', stage).cloneNode(true);
    const inner = $('.inner', stage).cloneNode(true);
    inner.classList.remove('folded');
    stripIds(inner);
    $$('button, input', inner).forEach(n => { n.tabIndex = -1; });
    clone.append(page, inner);
    front.append(clone, Object.assign(document.createElement('div'), { className: 'shade' }));

    const back = document.createElement('div');
    back.className = 'face flap-back paper';
    const face = card.cloneNode(true);
    face.classList.remove('pressed', 'lifted');
    face.classList.add('back-face');
    face.removeAttribute('data-id');
    face.tabIndex = -1;
    Object.assign(face.style, { width: card.offsetWidth + 'px', height: card.offsetHeight + 'px', aspectRatio: 'auto', transform: `scale(${1 / s})`, boxShadow: 'none', background: 'none' });
    back.append(face, Object.assign(document.createElement('div'), { className: 'shade' }));
    flap.append(front, back);
    return flap;
  }

  function buildStage(r) {
    stage.setAttribute('aria-label', r.title);
    stage.innerHTML = '<div class="page paper"></div>';
    stage.append(buildInner(r));
    const tools = document.createElement('div');
    tools.className = 'tools';
    tools.innerHTML = `<div class="well">${WELL_BACK}<div class="quill">${quillSVG()}</div>${WELL_FRONT}</div>`;
    stage.append(tools);
    $('.quill', stage).style.transform = 'translate(48px, 40px) rotate(-14deg)';
  }

  function openRecipe(r, card) {
    if (current || busy) return;
    busy = true;
    current = { recipe: r, card };

    card.classList.add('pressed');
    const cr = card.getBoundingClientRect();
    const g = geometry();
    const s = card.offsetWidth / g.width;

    veil.hidden = false;
    stage.hidden = false;
    Object.assign(stage.style, px(g));
    document.body.classList.add('cooking', 'locked');
    buildStage(r);
    updateQuantities(r, saved.scale[r.id] || 1);
    card.classList.add('lifted');

    if (reduced()) {
      $('.tools', stage).classList.add('on');
      busy = false;
      $('.back', stage).focus({ preventScroll: true });
      return;
    }

    stage.classList.add('folded');
    const flap = makeFlap(card, s);
    stage.append(flap);

    const dx = cr.left + cr.width / 2 - (g.left + g.width / 2);
    const dy = cr.top + cr.height / 2 - (g.top + g.height / 4);
    const rot = rotOf(card);
    const move = stage.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${s})` },
      { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
    ], { duration: 1000, easing: 'cubic-bezier(.25,.7,.2,1)', fill: 'both' });
    const swing = flap.animate([{ transform: 'rotateX(180deg)' }, { transform: 'rotateX(0deg)' }],
      { duration: 1050, delay: 300, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' });
    $$('.shade', flap).forEach(sh => sh.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], { duration: 1050, delay: 300, fill: 'both' }));

    swing.finished.then(() => {
      stage.classList.remove('folded');
      flap.remove();
      move.cancel();
      $('.tools', stage).classList.add('on');
      relayoutStrikes();
      busy = false;
      const b = $('.back', stage);
      if (b) b.focus({ preventScroll: true });
    }).catch(() => { busy = false; });
  }

  function closeRecipe() {
    if (!current || busy) return;
    busy = true;
    const { card } = current;
    cancelJobs();
    document.body.classList.remove('cooking');

    const finish = () => {
      stage.hidden = true;
      veil.hidden = true;
      stage.innerHTML = '';
      stage.className = 'stage';
      stage.getAnimations().forEach(a => a.cancel());
      card.classList.remove('lifted', 'pressed');
      document.body.classList.remove('locked');
      card.focus({ preventScroll: true });
      current = null;
      busy = false;
    };
    if (reduced()) return finish();

    const g = geometry();
    const cr = card.getBoundingClientRect();
    const s = card.offsetWidth / g.width;
    $('.inner', stage).scrollTop = 0;
    $('.tools', stage).classList.remove('on');
    Object.assign(stage.style, px(g));
    relayoutStrikes();
    const flap = makeFlap(card, s);
    flap.style.transform = 'rotateX(180deg)'; // end state; animation drives it
    stage.classList.add('folded');
    stage.append(flap);

    const dx = cr.left + cr.width / 2 - (g.left + g.width / 2);
    const dy = cr.top + cr.height / 2 - (g.top + g.height / 4);
    const rot = rotOf(card);
    const swing = flap.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)' }],
      { duration: 900, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'both' });
    $$('.shade', flap).forEach(sh => sh.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], { duration: 900, fill: 'both' }));
    const move = stage.animate([
      { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${s})` },
    ], { duration: 900, delay: 520, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'both' });
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 500, fill: 'both' });
    Promise.all([swing.finished, move.finished]).then(finish).catch(finish);
  }

  veil.addEventListener('click', closeRecipe);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRecipe(); });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      buildLights();
      if (current && !busy) { Object.assign(stage.style, px(geometry())); relayoutStrikes(); }
      else if (!current) fitCards();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current && !busy) relayoutStrikes(); });

  buildLights();
  renderGrid();
})();
