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
      if (unit === 'tsp') return tsp < 1 / 16 ? { text: 'a pinch', value: 1 } : { text: `${fraction(tsp)} tsp`, value: tsp }; // teaspoons stay teaspoons
      if (tsp >= 48) return { text: `${fraction(tsp / 48)} cup${tsp / 48 > 1 ? 's' : ''}`, value: tsp / 48 };
      if (tsp >= 3) return { text: `${fraction(tsp / 3)} tbsp`, value: tsp / 3 };
      return tsp < 1 / 16 ? { text: 'a pinch', value: 1 } : { text: `${fraction(tsp)} tsp`, value: tsp };
    }
    const n = whole ? Math.max(1, Math.round(qty)) : qty;
    return { text: whole ? String(n) : fraction(n), value: n };
  }

  function describe(ing, scale) {
    if (ing.text) return { qty: '', name: ing.text, note: '' };
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

  /* ───────── pixel art ───────── */
  const PS = { cps: 3, hps: 4, wps: 3, dps: 3, sps: 3 };
  const rootStyle = document.documentElement.style;
  const S = window.Sprites;
  const IMG = {};

  function loadSprites() {
    IMG.cat = S.cat(); IMG.pot = S.pot(); IMG.fire = S.fire(); IMG.fireLow = S.fire(true); IMG.logs = S.logs();
    IMG.well = S.well(); IMG.quill = S.quill(); IMG.pin = S.pin(); IMG.flourish = S.flourish(); IMG.blot = S.blot();
    IMG.corner = S.corner();
    IMG.blots = [11, 23, 37, 51].map(sd => S.blot(sd));
    IMG.doodles = { iceCream: { src: S.iceCream(), w: 26 }, mug: { src: S.mug(), w: 26 } };
    const wax = ['#fff4dc', '#f1e1bf', '#cdb88e'];
    const set = (k, v) => rootStyle.setProperty(k, `url(${v})`);
    set('--img-cat', IMG.cat); set('--img-pot', IMG.pot); set('--img-fire', IMG.fire); set('--img-fire-low', IMG.fireLow); set('--img-logs', IMG.logs);
    set('--img-wall-dusk', S.wallDusk2()); set('--img-wall-lit', S.wallLit2());
    set('--img-bricks-dusk', S.bricksDusk()); set('--img-bricks-lit', S.bricksLit());
    set('--img-mantel', S.mantelTile()); set('--img-surround', S.surround()); set('--img-firebox', S.firebox());
    set('--img-candle-tall', S.candle(4, 11, 7, wax)); set('--img-candle-mid', S.candle(3, 7, 6, wax)); set('--img-candle-stub', S.candle(5, 4, 9, wax));
    set('--img-web', S.web()); set('--img-spider', S.spider());
    Object.entries(IMG.corner).forEach(([k, v]) => set(`--img-c-${k}`, v));
  }

  function applyPixelScale() {
    const vw = window.innerWidth;
    PS.hps = vw >= 900 ? 4 : 3;
    PS.cps = vw >= 520 ? 3 : 2;
    PS.wps = vw >= 520 ? 3 : 2;
    PS.dps = vw >= 520 ? 3 : 2;
    PS.sps = vw >= 520 ? 3 : 2;
    Object.entries(PS).forEach(([k, v]) => rootStyle.setProperty(`--${k}`, v));
  }

  /* ───────── candles on the mantel ───────── */
  function buildMantel() {
    const mantel = $('#mantel');
    if (mantel.querySelector('.cndl')) return;
    ['tall c1', 'mid c2', 'stub c3', 'tall c4'].forEach(cls => { const c = document.createElement('i'); c.className = `cndl ${cls}`; mantel.appendChild(c); });
  }

  /* ───────── wear and tear: every page ages a little differently ───────── */
  function wearFor(id) {
    let h = 2166136261;
    for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const r = S.rng(h >>> 0), pick = a => a[Math.floor(r() * a.length)];
    const [bx, by] = pick([[0, 0], [100, 0], [0, 100], [100, 100]]);
    return {
      tone: pick(['#ead7a6', '#e5cf98', '#efdcae', '#e1c98f']),
      bx: bx + '%', by: by + '%', ba: (0.14 + r() * 0.22).toFixed(2),
      blots: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ x: 5 + r() * 84, y: 6 + r() * 82, rot: Math.floor(r() * 360), s: 0.5 + r() * 0.9, v: Math.floor(r() * 4) })),
      ring: r() < 0.7 ? { x: 12 + r() * 60, y: 22 + r() * 56, d: 64 + r() * 70, o: 0.35 + r() * 0.35, rot: Math.floor(r() * 360) } : null,
      crease: r() < 0.55 ? { h: r() < 0.5, pos: 22 + r() * 56 } : null,
    };
  }
  function applyWear(el, w) {
    el.style.setProperty('--tone', w.tone); el.style.setProperty('--bx', w.bx); el.style.setProperty('--by', w.by); el.style.setProperty('--ba', w.ba);
  }

  /* ───────── the shelf ───────── */
  const grid = $('#grid');
  const stage = $('#stage');
  const veil = $('#veil');
  let current = null; // { recipe, card }
  let busy = false;

  function doodleImg(name) {
    const d = IMG.doodles[name] || IMG.doodles.iceCream;
    return `<img class="doodle" alt="" src="${d.src}" style="--nw:${d.w}">`;
  }

  /** Where the opened page sits. Cards take the aspect ratio of the page's folded half. */
  function geometry() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const header = $('.top');
    const top = Math.round(header.offsetTop + header.offsetHeight + 8);
    const width = Math.min(620, vw - 20);
    const bottom = PS.hps * 47 + 8; // leave the whole cauldron + fire visible
    const height = clamp(vh - top - bottom, 330, 720);
    return { top, left: Math.round((vw - width) / 2), width, height };
  }
  const px = g => ({ top: g.top + 'px', left: g.left + 'px', width: g.width + 'px', height: g.height + 'px' });

  function fitCards() {
    const g = geometry();
    grid.style.setProperty('--r', ((g.height / 2) / g.width).toFixed(4));
  }

  const shelf = $('#shelf'), shelfWrap = $('#shelfWrap'), shelfUp = $('#shelfUp'), shelfDown = $('#shelfDown');

  /** The recipes live on the chimney breast: a fixed window between the header and the mantel that scrolls row by row. */
  function layoutShelf() {
    const header = $('.top');
    const top = header.offsetTop + header.offsetHeight + 4;
    const mantelTop = window.innerHeight - PS.hps * 70;
    shelfWrap.style.setProperty('--shelf-top', top + 'px');
    shelfWrap.style.setProperty('--shelf-h', Math.max(160, mantelTop - top - 10) + 'px');
    updateArrows();
  }
  function updateArrows() {
    const max = shelf.scrollHeight - shelf.clientHeight;
    shelfUp.hidden = shelf.scrollTop < 8;
    shelfDown.hidden = max <= 8 || shelf.scrollTop > max - 8;
  }
  const rowStep = () => { const s = $('.slot', shelf); return s ? s.offsetHeight + parseFloat(getComputedStyle($('#grid')).rowGap || 0) : 160; };
  shelf.addEventListener('scroll', updateArrows, { passive: true });
  shelfUp.addEventListener('click', () => shelf.scrollBy({ top: -rowStep(), behavior: 'smooth' }));
  shelfDown.addEventListener('click', () => shelf.scrollBy({ top: rowStep(), behavior: 'smooth' }));

  function renderGrid() {
    grid.innerHTML = '';
    fitCards();
    layoutShelf();
    RECIPES.forEach(r => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<i class="hole"></i><img class="pin px" alt="" src="${IMG.pin}">`;
      const card = document.createElement('button');
      card.className = 'card paper';
      applyWear(card, wearFor(r.id));
      card.type = 'button';
      card.dataset.id = r.id;
      card.setAttribute('aria-label', `Open ${r.title}`);
      card.innerHTML = `${doodleImg(r.doodle)}<span class="c-text"><span class="c-title"></span></span>`;
      $('.c-title', card).textContent = r.title;
      card.addEventListener('click', () => openRecipe(r, card));
      slot.appendChild(card);
      grid.appendChild(slot);
    });
    const total = Math.max(MIN_CARDS, Math.ceil(RECIPES.length / 2) * 2);
    for (let i = RECIPES.length; i < total; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = `<div class="card blank"><span class="c-text"><span class="c-title">a blank page</span></span></div>`;
      grid.appendChild(slot);
    }
  }

  /* ───────── the page ───────── */

  function wearMarks(id) {
    const w = wearFor(id);
    let html = '';
    if (w.ring) html += `<div class="coffee" style="left:${w.ring.x}%;top:${w.ring.y}%;width:${w.ring.d}px;height:${w.ring.d}px;opacity:${w.ring.o};transform:rotate(${w.ring.rot}deg) scaleY(.95)"></div>`;
    if (w.crease) html += `<div class="crease ${w.crease.h ? 'h' : 'v'}" style="${w.crease.h ? 'top' : 'left'}:${w.crease.pos}%"></div>`;
    w.blots.forEach(b => { html += `<img class="blot" alt="" src="${IMG.blots[b.v]}" style="left:${b.x}%;top:${b.y}%;opacity:${(0.6 + b.s * 0.25).toFixed(2)};transform:rotate(${b.rot}deg) scale(${b.s.toFixed(2)})">`; });
    return html;
  }

  function buildInner(r) {
    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.innerHTML = `
      ${wearMarks(r.id)}
      <h2></h2>
      <img class="orn" alt="" src="${IMG.flourish}">
      <h3>Ingredients</h3>
      <ul class="ings"></ul>
      <div class="foot">tap an ingredient to cross it off · tap the ink pot to start afresh · tap beside the page to close</div>`;
    const h2 = $('h2', inner);
    const cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = r.title.charAt(0);
    h2.append(cap, r.title.slice(1));

    if (r.method && r.method.length) {
      const ol = document.createElement('ol');
      ol.className = 'method';
      r.method.forEach(step => { const li = document.createElement('li'); li.textContent = step; ol.appendChild(li); });
      const h = document.createElement('h3');
      h.textContent = 'Method';
      h.style.marginTop = '14px';
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

  /** (Re)draws the single pen stroke across an ingredient's main text. */
  function layoutStrike(btn, ink, seed) {
    if (!ink._svg) {
      ink._svg = document.createElementNS(NS, 'svg');
      ink._svg.classList.add('strike');
      ink._svg.setAttribute('aria-hidden', 'true');
      ink._svg.append(document.createElementNS(NS, 'path'));
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
    const y = h * 0.6, wob = () => (rand() - 0.5) * 3;
    const segs = Math.max(3, Math.round(w / 38));
    const step = (w + pad * 2 - 4) / segs;
    let d = `M2,${(y + 2 + wob()).toFixed(1)}`;
    for (let s = 1; s <= segs; s++) {
      const x = 2 + step * s, slope = (-3 * s) / segs;
      d += ` Q${(x - step / 2).toFixed(1)},${(y + wob() * 1.4 + slope).toFixed(1)} ${x.toFixed(1)},${(y + slope + wob()).toFixed(1)}`;
    }
    const path = svg.querySelector('path');
    path.setAttribute('d', d);
    return path;
  }

  const hidePath = p => { const len = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; return len; };

  function relayoutStrikes(root = stage) {
    $$('.ing', root).forEach(btn => {
      if (btn._job) return; // a strike is queued or being drawn; leave it alone
      const ink = $('.ink.main', btn);
      if (!ink._svg && !btn.classList.contains('crossed')) return;
      const p = layoutStrike(btn, ink, Number(btn.dataset.i) * 11);
      p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = '';
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
    const REST = { x: 11 * PS.wps, y: 8 * PS.wps, a: -14 }, WRITE_A = 22;
    let pos = { ...REST };
    const place = p => { pos = p; quill.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.a.toFixed(1)}deg)`; };
    const local = (x, y) => ({ x: x - wr.left, y: y - wr.top });

    const ink = $('.ink.main', btn);
    const p = layoutStrike(btn, ink, Number(btn.dataset.i) * 11);
    const len = hidePath(p);
    const dur = Math.min(900, 260 + len * 2.8);
    void btn.offsetWidth;
    p.style.transition = '';
    const at = f => { const pt = p.getPointAtLength(len * f), r = ink._svg.getBoundingClientRect(); return local(r.left + pt.x, r.top + pt.y); };

    const travel = (to, ms, lift) => {
      const from = { ...pos };
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
      return tween(job, ms, e => {
        const u = 1 - e;
        place({
          x: u * u * from.x + 2 * u * e * mid.x + e * e * to.x,
          y: u * u * from.y + 2 * u * e * mid.y + e * e * to.y,
          a: from.a + (to.a - from.a) * e,
        });
      });
    };

    quill.style.willChange = 'transform';
    let ok = await travel({ ...at(0), a: WRITE_A }, 650, 70);
    if (ok) {
      btn.classList.add('crossed');
      ok = await tween(job, dur, e => {
        p.style.strokeDashoffset = len * (1 - e);
        place({ ...at(e), a: WRITE_A + Math.sin(e * 9) * 1.5 });
      });
    }
    job.cancelled = false; // always return the quill to its pot
    await travel({ ...REST }, 700, 60);
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

  const PRESETS = [1, 2, 3, 4, 5];

  function buildScalebar(r) {
    const bar = document.createElement('div');
    bar.className = 'scalebar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Scale the recipe');
    PRESETS.forEach(n => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.dataset.x = n;
      b.textContent = `${n}×`;
      b.setAttribute('aria-label', `Make ${n} times`);
      b.addEventListener('click', () => setScale(r, n));
      bar.appendChild(b);
    });
    const custom = document.createElement('label');
    custom.className = 'tab custom';
    custom.innerHTML = '<input type="number" inputmode="decimal" min="0.01" step="any" placeholder="n" aria-label="Custom multiplier">×';
    const input = $('input', custom);
    input.addEventListener('input', () => { const v = parseFloat(input.value); if (v > 0 && isFinite(v)) setScale(r, Math.min(v, 10000), true); });
    input.addEventListener('blur', () => syncScalebar(r));
    bar.appendChild(custom);
    return bar;
  }

  function syncScalebar(r, typing) {
    const x = saved.scale[r.id] || 1;
    $$('.tab[data-x]', stage).forEach(b => b.classList.toggle('on', Number(b.dataset.x) === x));
    const custom = $('.tab.custom', stage), input = $('.tab.custom input', stage);
    const isPreset = PRESETS.includes(x);
    custom.classList.toggle('on', !isPreset);
    if (!typing) input.value = isPreset ? '' : prettyScale(x);
  }

  function setScale(r, value, typing) {
    saved.scale[r.id] = value;
    persist();
    updateQuantities(r, value);
    syncScalebar(r, typing);
  }

  function resetInk() {
    if (!current) return;
    const r = current.recipe;
    saved.ticks[r.id] = {};
    persist();
    cancelJobs();
    $$('.ing.crossed', stage).forEach(b => { b.classList.remove('crossed'); b.setAttribute('aria-pressed', 'false'); });
    const well = $('.well', stage);
    well.classList.remove('bump');
    void well.offsetWidth;
    well.classList.add('bump');
  }

  function buildStage(r) {
    stage.setAttribute('aria-label', r.title);
    stage.innerHTML = '<div class="page paper"></div>';
    stage.tabIndex = -1;
    applyWear($('.page', stage), wearFor(r.id));
    stage.append(buildInner(r));
    const tools = document.createElement('div');
    tools.className = 'tools';
    tools.innerHTML = `<button class="well" type="button" aria-label="Ink pot: wipe away all the crossed-out ink">
        <img class="wback" alt="" src="${IMG.well.back}"><div class="quill"><img alt="" src="${IMG.quill}"></div><img class="wfront" alt="" src="${IMG.well.front}">
      </button>`;
    tools.append(buildScalebar(r));
    $('.well', tools).addEventListener('click', resetInk);
    stage.append(tools);
    $('.quill', stage).style.transform = `translate(${11 * PS.wps}px, ${8 * PS.wps}px) rotate(-14deg)`;
  }

  function openRecipe(r, card) {
    if (current || busy) return;
    busy = true;
    current = { recipe: r, card };

    card.parentElement.classList.remove('pin-in');
    card.parentElement.classList.add('open'); // the pin is pulled out
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
    syncScalebar(r);
    card.classList.add('lifted');

    if (reduced()) {
      $('.tools', stage).classList.add('on');
      busy = false;
      stage.focus({ preventScroll: true });
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
      stage.focus({ preventScroll: true });
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
      const slot = card.parentElement;
      slot.classList.remove('open');
      slot.classList.add('pin-in'); // ...and pushed back in
      setTimeout(() => slot.classList.remove('pin-in'), 600);
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
  // anywhere that isn't the page itself folds it back up
  document.addEventListener('pointerdown', e => {
    if (current && !busy && !stage.contains(e.target)) closeRecipe();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRecipe(); });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      applyPixelScale();
      layoutShelf();
      if (current && !busy) { Object.assign(stage.style, px(geometry())); relayoutStrikes(); }
      else if (!current) fitCards();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current && !busy) relayoutStrikes(); });

  loadSprites();
  applyPixelScale();
  buildMantel();
  renderGrid();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutShelf);
})();
