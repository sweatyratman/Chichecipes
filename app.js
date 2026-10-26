(() => {
  'use strict';

  const RECIPES = window.RECIPES || [];
  const STORE_KEY = 'chichecipes:v1';
  const MIN_CARDS = 4; // always show at least 2 rows on the shelf

  const $ = (sel, root = document) => root.querySelector(sel);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /** Returns { text, value, unit } for display, picking friendlier units as amounts grow or shrink. */
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

  /* ───────── cards ───────── */
  const grid = $('#grid');
  const sheet = $('#sheet');
  const veil = $('#veil');
  let current = null; // { recipe, card }
  let busy = false;

  const BLANK_DOODLE = `<svg viewBox="0 0 60 60" aria-hidden="true" fill="none" stroke="#e9d6b4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 48 L16 36 L42 10 L50 18 L24 44 Z"/><path d="M38 14 L46 22 M12 48 L24 44"/></svg>`;

  function renderGrid() {
    grid.innerHTML = '';
    RECIPES.forEach(r => {
      const card = document.createElement('button');
      card.className = 'card paper';
      card.type = 'button';
      card.dataset.id = r.id;
      card.innerHTML = `<span class="tape"></span><span class="doodle">${r.doodle || ''}</span><span class="c-title"></span><span class="c-meta"></span>`;
      $('.c-title', card).textContent = r.title;
      $('.c-meta', card).textContent = r.blurb || `${r.ingredients.length} ingredients`;
      card.addEventListener('click', () => openRecipe(r, card));
      grid.appendChild(card);
    });
    const total = Math.max(MIN_CARDS, Math.ceil(RECIPES.length / 2) * 2);
    for (let i = RECIPES.length; i < total; i++) {
      const blank = document.createElement('div');
      blank.className = 'card blank';
      blank.innerHTML = `<span class="doodle">${BLANK_DOODLE}</span><span class="c-title">a blank page</span>`;
      grid.appendChild(blank);
    }
  }

  /* ───────── the sheet ───────── */
  const PEN_SVG = `<svg viewBox="0 0 10 54" aria-hidden="true"><path d="M5 54 L1.6 44 L8.4 44Z" fill="#e7d2ae"/><path d="M4 52 L5 54 L6 52Z" fill="#1d3a9a"/><rect x="1.6" y="12" width="6.8" height="32" rx="1.2" fill="#1d3a9a"/><rect x="1.6" y="12" width="2.4" height="32" fill="#2f55c9"/><rect x="1.6" y="38" width="6.8" height="3" fill="#c9c9d4"/><rect x="6.8" y="0" width="1.6" height="22" rx=".8" fill="#c9c9d4"/><rect x="1.6" y="0" width="6.8" height="6" rx="2" fill="#16296f"/></svg>`;

  function targetRect() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const top = Math.round($('.top').getBoundingClientRect().bottom + 4);
    const width = Math.min(780, vw - 20);
    const bottom = Math.max(64, Math.min(130, vh * 0.15));
    return { top, left: Math.round((vw - width) / 2), width, height: Math.max(320, vh - top - bottom) };
  }
  const px = r => ({ top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
  const setRect = r => Object.assign(sheet.style, px(r));

  function buildSheet(r, card) {
    const scale = saved.scale[r.id] || 1;
    sheet.setAttribute('aria-label', r.title);
    sheet.innerHTML = `
      <div class="face">${card.innerHTML}</div>
      <div class="inner">
        <button class="back" type="button">← all recipes</button>
        <h2></h2>
        <p class="blurb"></p>
        <div class="scale">
          <div class="scale-head">
            <label for="scale-range">Scale it up</label>
            <span class="scale-val">×<input id="scale-num" type="number" inputmode="decimal" min="0.01" step="any" aria-label="Scale multiplier"></span>
          </div>
          <div class="scale-row">
            <input id="scale-range" type="range" min="0.25" max="10" step="0.25">
            <button type="button" class="reset-scale">back to ×1</button>
          </div>
        </div>
        <h3>Ingredients</h3>
        <ul class="ings"></ul>
        <div class="sheet-foot"><span>tap an ingredient to cross it off</span><button type="button" class="rub">rub out all ticks</button></div>
      </div>
      <div class="folds"></div>`;
    $('h2', sheet).textContent = r.title;
    $('.blurb', sheet).textContent = r.blurb || '';
    if (!r.blurb) $('.blurb', sheet).remove();

    if (r.method && r.method.length) {
      const ol = document.createElement('ol');
      ol.className = 'method';
      r.method.forEach(step => { const li = document.createElement('li'); li.textContent = step; ol.appendChild(li); });
      $('.sheet-foot', sheet).before(Object.assign(document.createElement('h3'), { textContent: 'Method', style: 'margin-top:26px' }), ol);
    }

    const list = $('.ings', sheet);
    const ticks = saved.ticks[r.id] || (saved.ticks[r.id] = {});
    r.ingredients.forEach((ing, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ing';
      btn.dataset.i = i;
      btn.setAttribute('aria-pressed', ticks[i] ? 'true' : 'false');
      btn.innerHTML = `<span class="ink main"><span class="qty"></span> <span class="nm"></span></span><span class="ink note"></span><span class="pen" aria-hidden="true">${PEN_SVG}</span>`;
      btn.addEventListener('click', () => toggleTick(r, btn, i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    const range = $('#scale-range', sheet), num = $('#scale-num', sheet);
    const apply = (value, from) => {
      saved.scale[r.id] = value;
      if (from !== 'range') range.value = Math.min(10, Math.max(0.25, value));
      if (from !== 'num') num.value = prettyScale(value);
      updateQuantities(r, value);
      persist();
    };
    range.addEventListener('input', () => apply(parseFloat(range.value), 'range'));
    num.addEventListener('input', () => { const v = parseFloat(num.value); if (v > 0 && isFinite(v)) apply(Math.min(v, 10000), 'num'); });
    num.addEventListener('blur', () => { num.value = prettyScale(saved.scale[r.id] || 1); });
    $('.reset-scale', sheet).addEventListener('click', () => apply(1));
    $('.back', sheet).addEventListener('click', closeRecipe);
    $('.rub', sheet).addEventListener('click', () => {
      saved.ticks[r.id] = {};
      persist();
      list.querySelectorAll('.ing[aria-pressed=true]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    });

    range.value = Math.min(10, Math.max(0.25, scale));
    num.value = prettyScale(scale);
    updateQuantities(r, scale);
  }

  function updateQuantities(r, scale) {
    $$('.ing', sheet).forEach((btn, i) => {
      const d = describe(r.ingredients[i], scale);
      $('.qty', btn).textContent = d.qty;
      $('.nm', btn).textContent = d.name;
      const note = $('.note', btn);
      note.textContent = d.note;
      note.hidden = !d.note;
    });
    relayoutStrikes();
  }
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ───────── pen strikes ───────── */
  function rng(seed) { // tiny deterministic PRNG so each ingredient keeps its own scribble
    let s = seed * 9301 + 49297;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  }

  /** (Re)draws the two pen strokes for one text span; returns its [forward, back] paths. */
  function layoutStrike(btn, ink, seed) {
    if (!ink._svg) {
      ink._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ink._svg.classList.add('strike');
      ink._svg.setAttribute('aria-hidden', 'true');
      ink._svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'path'), document.createElementNS('http://www.w3.org/2000/svg', 'path'));
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

  function strikeInks(btn) { return $$('.ink', btn).filter(ink => !ink.hidden); }

  function relayoutStrikes() {
    $$('.ing', sheet).forEach(btn => {
      const seed = Number(btn.dataset.i) * 11;
      $$('.ink', btn).forEach((ink, k) => {
        if (!ink._svg && btn.getAttribute('aria-pressed') !== 'true') return;
        const paths = layoutStrike(btn, ink, seed + k);
        ink._svg.style.display = ink.hidden ? 'none' : '';
        paths.forEach(p => { p.style.transition = 'none'; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
        void ink.offsetWidth;
        paths.forEach(p => { p.style.transition = ''; });
      });
    });
  }

  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function playStrike(btn) {
    cancelAnimationFrame(btn._raf);
    const pen = $('.pen', btn);
    const segs = [];
    strikeInks(btn).forEach((ink, k) => {
      const paths = layoutStrike(btn, ink, Number(btn.dataset.i) * 11 + k);
      const list = k === 0 ? [paths[0], paths[1]] : [paths[0]];
      list.forEach(p => {
        const len = p.getTotalLength();
        p.style.transition = 'none';
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        segs.push({ p, len, ink, dur: Math.min(750, 180 + len * 2.4) });
      });
      if (list.length < 2) paths[1].style.strokeDashoffset = 0;
    });
    void btn.offsetWidth;
    segs.forEach(s => { s.p.style.transition = ''; });

    pen.classList.add('on');
    let i = 0, t0 = performance.now();
    const frame = now => {
      const s = segs[i];
      const t = Math.min(1, (now - t0) / s.dur), e = ease(t);
      s.p.style.strokeDashoffset = s.len * (1 - e);
      const pt = s.p.getPointAtLength(s.len * e);
      const svgBox = s.ink._svg;
      pen.style.transform = `translate(${parseFloat(svgBox.style.left) + pt.x}px, ${parseFloat(svgBox.style.top) + pt.y}px)`;
      if (t >= 1) { i += 1; t0 = now + 60; }
      if (i < segs.length) btn._raf = requestAnimationFrame(frame);
      else setTimeout(() => pen.classList.remove('on'), 150);
    };
    btn._raf = requestAnimationFrame(frame);
  }

  function toggleTick(r, btn, i) {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    saved.ticks[r.id] = saved.ticks[r.id] || {};
    if (on) saved.ticks[r.id][i] = true; else delete saved.ticks[r.id][i];
    persist();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      if (reduced()) { relayoutStrikes(); return; }
      playStrike(btn);
    } else {
      cancelAnimationFrame(btn._raf);
      $('.pen', btn).classList.remove('on');
    }
  }

  /* ───────── unfold / fold ───────── */
  const EASE_OPEN = 'cubic-bezier(.22,.8,.2,1)';
  const rotOf = card => parseFloat(getComputedStyle(card).getPropertyValue('--rot')) || 0;

  function openRecipe(r, card) {
    if (current || busy) return;
    busy = true;
    current = { recipe: r, card };
    buildSheet(r, card);

    const from = card.getBoundingClientRect();
    const to = targetRect();
    card.classList.add('lifted');
    sheet.hidden = false;
    veil.hidden = false;
    document.body.classList.add('cooking', 'locked');
    setRect(to);
    relayoutStrikes();

    if (reduced()) { busy = false; $('.face', sheet).remove(); $('.folds', sheet).remove(); $('.back', sheet).focus(); return; }

    const rot = rotOf(card);
    const anim = sheet.animate([
      { ...px(from), transform: `perspective(1400px) rotateX(26deg) rotate(${rot}deg)` },
      { ...px(to), transform: 'perspective(1400px) rotateX(0deg) rotate(0deg)' },
    ], { duration: 1000, easing: EASE_OPEN });
    $('.face', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 80, easing: 'ease-in', fill: 'forwards' });
    $('.folds', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 950, easing: 'ease-in', fill: 'forwards' });
    $('.inner', sheet).animate([
      { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
    ], { duration: 800, delay: 260, easing: 'ease-out', fill: 'backwards' });
    anim.finished.catch(() => {}).then(() => { busy = false; const b = $('.back', sheet); if (b) b.focus({ preventScroll: true }); });
  }

  function closeRecipe() {
    if (!current || busy) return;
    busy = true;
    const { card } = current;
    $$('.ing', sheet).forEach(b => cancelAnimationFrame(b._raf));
    document.body.classList.remove('cooking');

    const finish = () => {
      sheet.hidden = true;
      veil.hidden = true;
      sheet.innerHTML = '';
      card.classList.remove('lifted');
      document.body.classList.remove('locked');
      card.focus({ preventScroll: true });
      current = null;
      busy = false;
    };
    if (reduced()) return finish();

    const from = sheet.getBoundingClientRect();
    const to = card.getBoundingClientRect();
    const rot = rotOf(card);
    $('.inner', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
    $('.face', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 260, easing: 'ease-out', fill: 'forwards' });
    $('.folds', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 100, easing: 'ease-out', fill: 'forwards' });
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    sheet.animate([
      { ...px(from), transform: 'perspective(1400px) rotateX(0deg) rotate(0deg)' },
      { ...px(to), transform: `perspective(1400px) rotateX(22deg) rotate(${rot}deg)` },
    ], { duration: 720, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'forwards' })
      .finished.catch(() => {}).then(finish);
  }

  veil.addEventListener('click', closeRecipe);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRecipe(); });
  window.addEventListener('resize', () => { if (current && !busy) { setRect(targetRect()); relayoutStrikes(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current) relayoutStrikes(); });

  renderGrid();
})();
