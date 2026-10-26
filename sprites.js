/*
 * Pixel art, drawn in code. Every sprite is painted onto a tiny canvas once at startup
 * and handed to the page as a data URL; CSS scales it up with `image-rendering: pixelated`.
 */
window.Sprites = (() => {
  'use strict';

  const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const dot = (x, y, px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
  const rows = (x, grid, pal, ox = 0, oy = 0) => grid.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== '.' && pal[ch]) dot(x, 0, ox + i, oy + y, pal[ch]); }));
  const mirror = (grid, half) => grid.map(r => { const l = r.padEnd(half, '.').slice(0, half); return l + [...l].reverse().join(''); });
  const disc = (x, cx, cy, r, shade) => {
    for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
      for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
        const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const l = (-0.65 * dx - 0.75 * dy) / r; // light from the upper left
        dot(x, 0, px, py, shade(l, dx, dy));
      }
    }
  };
  /** Wraps every opaque pixel with a 1px outline — the classic pixel-art look. */
  const outline = (c, x, col) => {
    const { width: w, height: h } = c;
    const d = x.getImageData(0, 0, w, h).data;
    const solid = (px, py) => px >= 0 && py >= 0 && px < w && py < h && d[(py * w + px) * 4 + 3] > 0;
    x.fillStyle = col;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (solid(px, py)) continue;
      if (solid(px - 1, py) || solid(px + 1, py) || solid(px, py - 1) || solid(px, py + 1)) x.fillRect(px, py, 1, 1);
    }
  };
  const padded = (w, h, pad, fn) => { const [c, x] = make(w + pad * 2, h + pad * 2); x.translate(pad, pad); fn(x); x.setTransform(1, 0, 0, 1, 0, 0); return [c, x]; };
  const url = c => c.toDataURL();
  const sheet = (fw, fh, frames, fn) => { const [c, x] = make(fw * frames, fh); for (let i = 0; i < frames; i++) { x.save(); x.translate(fw * i, 0); x.beginPath(); x.rect(0, 0, fw, fh); x.clip(); fn(x, i); x.restore(); } return [c, x]; };

  /* ───────── the cat ───────── */
  const CAT_W = 31, CAT_H = 25;
  function cat() {
    const half = [
      '', '.....kk', '....kwpk', '....kwwpk', '....kkkkkkkkk',
      '....kwwwwwwww', '....kwwwwwwww', '....kwwwwwwww', '....kwwwewwww', '....kwwewewww',
      '....kccwwwwwp', '....kwwwwwwkw', '.....kwwwwwwk', '......krrrrrr', '.....kwwwwwwy',
      '....kwwwwwwww', '....kwwwwwwww', '....kwwwwwwww', '....kwwwwwwww', '....kwwwwwwww',
      '....kwwwwwwww', '....kwwwwwwww', '...kwwwwwwwwk', '...kwwkwwkwwk', '...kkkkkkkkkk',
    ];
    const grid = mirror(half, 13);
    const pal = { k: '#2a1d17', w: '#fff8ea', g: '#dccdb6', b: '#3b2e28', p: '#ef9aa4', c: '#f7bcbc', r: '#c4412f', y: '#f4c04e', e: '#2a1d17' };
    const patches = [
      [5, 2], [6, 2], [5, 3], [6, 3], [7, 3],
      [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [5, 7], [6, 7], [7, 7], [8, 7],
      [5, 16], [6, 16], [7, 16], [8, 16], [5, 17], [6, 17], [7, 17], [8, 17], [5, 18], [6, 18], [7, 18], [5, 19], [6, 19], [5, 20],
      [19, 18], [20, 18], [20, 19], [19, 19],
    ];
    const tails = [
      [[22, 22], [23, 22], [24, 22], [25, 21], [26, 21], [27, 20], [27, 19], [27, 18], [28, 17], [28, 16], [28, 15]],
      [[22, 22], [23, 22], [24, 22], [25, 21], [26, 20], [27, 19], [28, 19], [29, 18], [29, 17], [29, 16], [28, 15]],
    ];
    const [c, x] = sheet(CAT_W, CAT_H, 2, (ctx, f) => {
      rows(ctx, grid, pal);
      for (let px = 6; px < 20; px++) dot(ctx, 0, px, 15, pal.g);
      patches.forEach(([px, py]) => dot(ctx, 0, px, py, pal.b));
      [[12, 14], [13, 14], [12, 15], [13, 15]].forEach(([px, py]) => dot(ctx, 0, px, py, pal.y));
      dot(ctx, 0, 12, 14, '#fff0b0');
      tails[f].forEach(([px, py], i) => { const tip = i >= tails[f].length - 2; dot(ctx, 0, px, py, tip ? pal.w : pal.b); dot(ctx, 0, px + 1, py, tip ? pal.w : pal.b); dot(ctx, 0, px, py + 1, tip ? pal.w : pal.b); });
      if (f === 1) { dot(ctx, 0, 8, 8, pal.w); dot(ctx, 0, 17, 8, pal.w); dot(ctx, 0, 7, 9, pal.e); dot(ctx, 0, 9, 9, pal.e); dot(ctx, 0, 8, 9, pal.e); dot(ctx, 0, 16, 9, pal.e); dot(ctx, 0, 18, 9, pal.e); dot(ctx, 0, 17, 9, pal.e); }
    });
    return url(c);
  }

  /* ───────── the cauldron, fire and logs ───────── */
  const POT_W = 52, POT_H = 30;
  function pot() {
    const [c, x] = sheet(POT_W, POT_H, 2, (ctx, f) => {
      const cx = 26, rimY = 5;
      // body (lower half of an ellipse)
      for (let py = rimY; py <= 26; py++) {
        const t = (py - rimY) / 21, hw = Math.round(22 * Math.sqrt(Math.max(0, 1 - t * t)));
        for (let px = cx - hw; px < cx + hw; px++) {
          const u = (px - (cx - hw)) / (2 * hw + 1);
          let col = '#2c2833';
          if (u < 0.2 + t * 0.1) col = '#4a4556';
          else if (u < 0.34) col = '#3a3643';
          else if (u > 0.78 - t * 0.12) col = '#1d1a23';
          if (t > 0.85 && u > 0.4) col = '#1d1a23';
          dot(ctx, 0, px, py, col);
        }
      }
      [[9, 11], [10, 12], [10, 14], [11, 17], [12, 19]].forEach(([px, py]) => dot(ctx, 0, px, py, '#756f86'));
      [[11, 8], [19, 9], [33, 9], [41, 8]].forEach(([px, py]) => dot(ctx, 0, px, py, '#625c70'));
      // rim ring
      for (let py = rimY - 4; py <= rimY + 3; py++) for (let px = 0; px < POT_W; px++) {
        const dx = (px + 0.5 - cx) / 24, dy = (py + 0.5 - rimY) / 3.8;
        if (dx * dx + dy * dy <= 1) dot(ctx, 0, px, py, dy < 0 ? '#5b5668' : '#3a3643');
      }
      // stew
      for (let py = rimY - 3; py <= rimY + 2; py++) for (let px = 0; px < POT_W; px++) {
        const dx = (px + 0.5 - cx) / 21, dy = (py + 0.5 - rimY) / 2.6;
        if (dx * dx + dy * dy <= 1) dot(ctx, 0, px, py, dy < -0.2 ? '#8a4220' : '#c0652a');
      }
      const hi = f ? [[17, 4], [18, 4], [30, 5], [31, 5], [37, 4]] : [[20, 4], [21, 4], [27, 5], [33, 4], [34, 4]];
      hi.forEach(([px, py]) => dot(ctx, 0, px, py, '#f3a24a'));
      (f ? [[24, 3], [14, 5]] : [[15, 4], [36, 5]]).forEach(([px, py]) => { dot(ctx, 0, px, py, '#ffd58a'); dot(ctx, 0, px + 1, py, '#ffd58a'); });
      // handles
      [[1, 9], [0, 10], [0, 11], [0, 12], [1, 13], [2, 14], [50, 9], [51, 10], [51, 11], [51, 12], [50, 13], [49, 14]].forEach(([px, py]) => dot(ctx, 0, px, py, '#26222d'));
      // legs
      [10, 24, 38].forEach(lx => { for (let py = 25; py < 29; py++) for (let i = 0; i < 4; i++) dot(ctx, 0, lx + i, py, '#1d1a23'); });
    });
    outline(c, x, '#0e0b12');
    return url(c);
  }

  const FIRE_W = 36, FIRE_H = 24;
  function fire() {
    const tongues = [{ cx: 6, h: 12, w: 4 }, { cx: 12, h: 18, w: 5 }, { cx: 18, h: 23, w: 6 }, { cx: 25, h: 17, w: 5 }, { cx: 31, h: 11, w: 4 }];
    const [c] = sheet(FIRE_W, FIRE_H, 3, (ctx, f) => {
      tongues.forEach((tg, k) => {
        const sway = Math.round(Math.sin(f * 2.1 + k * 1.3) * 1.4), h = tg.h + Math.round(Math.sin(f * 2.6 + k * 2) * 2);
        for (let t = 0; t < h; t++) {
          const u = t / h, py = FIRE_H - 1 - t;
          const hw = tg.w * Math.pow(1 - Math.pow(u, 1.5), 0.9) + 0.4;
          const off = Math.round(sway * u * 2);
          for (let px = Math.round(tg.cx + off - hw); px <= Math.round(tg.cx + off + hw); px++) {
            const d = Math.abs(px - (tg.cx + off)) / Math.max(hw, 1);
            let col = '#d9421d';
            if (u > 0.82) col = '#a92e1b';
            else if (d < 0.78 && u < 0.78) col = '#ff8f2b';
            if (d < 0.45 && u < 0.55) col = '#ffd45a';
            if (d < 0.25 && u < 0.3) col = '#fff3b8';
            dot(ctx, 0, px, py, col);
          }
        }
      });
      for (let px = 3; px < 34; px++) { dot(ctx, 0, px, FIRE_H - 1, '#ffd45a'); if (px > 5 && px < 31) dot(ctx, 0, px, FIRE_H - 2, '#ffb43e'); }
    });
    return url(c);
  }

  const LOGS_W = 56, LOGS_H = 10;
  function logs() {
    const [c, x] = make(LOGS_W, LOGS_H);
    const log = (x0, x1, y0, slope, dark) => {
      for (let px = x0; px <= x1; px++) {
        const oy = Math.round((px - x0) * slope);
        for (let i = 0; i < 5; i++) {
          let col = i === 0 ? '#9a6a3a' : i < 3 ? '#6e4627' : i === 3 ? '#573619' : '#3c2412';
          if (dark) col = i === 0 ? '#80542e' : i < 3 ? '#5c3a20' : i === 3 ? '#472c15' : '#2f1c0d';
          if ((px * 7 + i * 3) % 11 === 0 && i > 0 && i < 4) col = dark ? '#3c2412' : '#4d3017';
          dot(x, 0, px, y0 + oy + i, col);
        }
      }
      for (let i = 0; i < 5; i++) { dot(x, 0, x0, y0 + i, '#d6a266'); dot(x, 0, x0 + 1, y0 + i, i === 2 ? '#8a5a2e' : '#c18b50'); }
    };
    log(14, 53, 4, -0.04, true);
    log(2, 41, 1, 0.07, false);
    [[10, 6], [24, 8], [30, 7], [42, 6], [47, 5]].forEach(([px, py]) => dot(x, 0, px, py, '#ff8a2a'));
    outline(c, x, '#1a0f08');
    return url(c);
  }

  /* ───────── ink pot + quill ───────── */
  const WELL_W = 22, WELL_H = 18;
  function well() {
    const [bc, bx] = make(WELL_W, WELL_H);
    for (let py = 2; py <= 6; py++) for (let px = 0; px < WELL_W; px++) {
      const dx = (px + 0.5 - 11) / 6.2, dy = (py + 0.5 - 4.5) / 2.4;
      if (dx * dx + dy * dy <= 1) dot(bx, 0, px, py, dy < -0.3 ? '#b98a35' : '#05070e');
    }
    outline(bc, bx, '#05070e');
    const [fc, fx] = make(WELL_W, WELL_H);
    for (let py = 5; py < 18; py++) {
      const t = (py - 5) / 12;
      const hw = py < 8 ? 6 : Math.round(6 + Math.min(1, (py - 7) / 3) * 4.5 - (t > 0.8 ? (t - 0.8) * 8 : 0));
      for (let px = 11 - hw; px < 11 + hw; px++) {
        const u = (px - (11 - hw)) / (2 * hw);
        let col = '#25346f';
        if (u < 0.22) col = '#4a62b0'; else if (u < 0.4) col = '#33478c'; else if (u > 0.75) col = '#17204a';
        if (t > 0.85) col = '#111838';
        dot(fx, 0, px, py, col);
      }
    }
    for (let px = 5; px < 17; px++) { dot(fx, 0, px, 5, '#f0c66a'); dot(fx, 0, px, 6, px < 8 ? '#e2b04c' : '#b07d25'); }
    [[3, 10], [3, 11], [4, 13], [5, 14]].forEach(([px, py]) => dot(fx, 0, px, py, '#9fb6f0'));
    dot(fx, 0, 4, 9, '#cfdcff');
    outline(fc, fx, '#05070e');
    return { back: url(bc), front: url(fc) };
  }

  const QUILL_W = 11, QUILL_H = 54;
  function quill() {
    const [c, x] = make(QUILL_W, QUILL_H);
    const vane = 38;
    for (let py = 0; py < vane; py++) {
      const t = py / vane, hw = 5 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, (t + 0.03)), 0.8)), 0.85);
      for (let px = 5 - Math.round(hw * 0.9); px <= 5 + Math.round(hw); px++) {
        if (px === 5) continue;
        const barb = (px + py) % 3 === 0;
        dot(x, 0, px, py, barb ? '#e4d3aa' : px < 5 ? '#f4ebd2' : '#fdf7e6');
      }
    }
    for (let py = 0; py < 50; py++) dot(x, 0, 5, py, py > 34 ? '#cdab68' : '#d8c08c');
    dot(x, 0, 5, 50, '#cdab68'); dot(x, 0, 5, 51, '#14100d'); dot(x, 0, 5, 52, '#14100d');
    outline(c, x, '#6f5a38');
    return url(c);
  }

  /* ───────── recipe doodles ───────── */
  function iceCream() {
    const [c, x] = padded(24, 22, 1, ctx => {
      const choc = (l) => (l > 0.5 ? '#a8714a' : l > 0.0 ? '#7e4b2b' : l > -0.5 ? '#613a21' : '#47281a');
      disc(ctx, 7.5, 10, 5.6, choc);
      disc(ctx, 16.5, 10.5, 5.4, (l) => choc(l - 0.05));
      disc(ctx, 12, 6.5, 5.2, choc);
      // banana coin + cashew
      disc(ctx, 19.5, 3.5, 2.6, l => (l > 0.3 ? '#fbeeb0' : '#f2d675'));
      dot(ctx, 0, 19, 3, '#b58a2e');
      [[3, 3], [4, 3], [4, 4], [5, 4]].forEach(([px, py]) => dot(ctx, 0, px, py, '#e6c48c'));
      [[9, 2], [10, 2], [11, 2]].forEach(([px, py]) => dot(ctx, 0, px, py, '#a8714a'));
      // bowl
      for (let py = 12; py <= 20; py++) {
        const t = (py - 12) / 9, hw = Math.round(11.5 * Math.sqrt(Math.max(0.02, 1 - t * t)));
        for (let px = 12 - hw; px < 12 + hw; px++) {
          const u = (px - (12 - hw)) / (2 * hw);
          let col = u < 0.25 ? '#fff8e6' : u > 0.75 ? '#cdb98f' : '#efe2c4';
          if (py === 15 || py === 16) col = u < 0.25 ? '#8fb0d8' : u > 0.75 ? '#496f9e' : '#6b92c4';
          dot(ctx, 0, px, py, col);
        }
      }
      for (let px = 1; px < 23; px++) { dot(ctx, 0, px, 12, '#fff8e6'); dot(ctx, 0, px, 13, px < 6 ? '#efe2c4' : '#d8c89f'); }
    });
    outline(c, x, '#3a2418');
    return url(c);
  }

  /* ───────── small things ───────── */
  function pin() {
    const [c, x] = padded(6, 6, 1, ctx => { disc(ctx, 3, 3, 3, l => (l > 0.55 ? '#ffb0a0' : l > -0.1 ? '#d8402f' : '#9c2418')); });
    outline(c, x, '#3a0e08');
    return url(c);
  }

  function corner() {
    const rowsC = ['rrrrrrrrrrr', 'r', 'r.rrrrrrrrr', 'r.r', 'r.r.rr', 'r.r.r', 'r.r.', 'r.r', 'r.r', 'r.r', 'r'];
    const [c, x] = make(11, 11);
    rows(x, rowsC, { r: '#6b3a1c' });
    dot(x, 0, 3, 3, '#a83a22'); dot(x, 0, 4, 4, '#a83a22');
    const out = { tl: url(c) };
    const flip = (sx, sy) => { const [d, dx] = make(11, 11); dx.translate(sx < 0 ? 11 : 0, sy < 0 ? 11 : 0); dx.scale(sx, sy); dx.drawImage(c, 0, 0); return url(d); };
    out.tr = flip(-1, 1); out.bl = flip(1, -1); out.br = flip(-1, -1);
    return out;
  }

  function flourish() {
    const half = ['...................r', '..................rr', '.......r.......rrrrr', 'rrrrrrrrr.rrrrrrrrrr', '.......r.......rrrrr', '..................rr', '...................r'];
    const [c, x] = make(40, 7);
    rows(x, mirror(half, 20), { r: '#6b3a1c' });
    [[19, 3], [20, 3]].forEach(([px, py]) => dot(x, 0, px, py, '#a83a22'));
    return url(c);
  }

  function blot() {
    const r = rng(11);
    const [c, x] = make(16, 14);
    for (let py = 0; py < 14; py++) for (let px = 0; px < 16; px++) {
      const dx = px - 7, dy = py - 6.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 3 + r() * 2.4) dot(x, 0, px, py, '#15100c');
    }
    for (let i = 0; i < 6; i++) dot(x, 0, Math.floor(r() * 16), Math.floor(r() * 14), '#15100c');
    return url(c);
  }

  /* ───────── the wall ───────── */
  function wall(palette, seed) {
    const r = rng(seed), S = 64, PW = 16;
    const [c, x] = make(S, S);
    for (let p = 0; p < S / PW; p++) {
      const base = palette.base[p % palette.base.length], ox = p * PW;
      x.fillStyle = base; x.fillRect(ox, 0, PW, S);
      const streaks = [];
      for (let i = 0; i < 5; i++) streaks.push({ x: ox + 2 + Math.floor(r() * (PW - 4)), y: Math.floor(r() * S), len: 8 + Math.floor(r() * 26), light: r() > 0.5 });
      streaks.forEach(s => { for (let k = 0; k < s.len; k++) dot(x, 0, s.x, (s.y + k) % S, s.light ? palette.light : palette.dark); });
      for (let i = 0; i < 14; i++) dot(x, 0, ox + 1 + Math.floor(r() * (PW - 2)), Math.floor(r() * S), r() > 0.5 ? palette.light : palette.dark);
      if (r() > 0.4) { const kx = ox + 4 + Math.floor(r() * 8), ky = 6 + Math.floor(r() * (S - 12)); disc(x, kx, ky, 2.3, l => (l > 0.3 ? palette.dark : palette.knot)); dot(x, 0, kx, ky, palette.dark); }
      const jy = Math.floor(r() * S);
      for (let i = 0; i < PW; i++) dot(x, 0, ox + i, jy, palette.seam);
      for (let y = 0; y < S; y++) { dot(x, 0, ox, y, palette.seam); dot(x, 0, ox + 1, y, palette.edge); }
    }
    return url(c);
  }

  const wallDusk = () => wall({ base: ['#3a2418', '#33201a', '#3d271b', '#37231a'], light: '#4a3022', dark: '#2a1a12', knot: '#241410', seam: '#1c0f09', edge: '#4a2f20' }, 5);
  const wallLit = () => wall({ base: ['#5a3420', '#54301f', '#603823', '#58321f'], light: '#7a4a2c', dark: '#3f2315', knot: '#33190e', seam: '#2a150b', edge: '#7a4a2c' }, 5);

  return { cat, pot, fire, logs, well, quill, iceCream, pin, corner, flourish, blot, wallDusk, wallLit, rng, make, dot,
    size: { cat: [CAT_W, CAT_H], pot: [POT_W, POT_H], fire: [FIRE_W, FIRE_H], logs: [LOGS_W, LOGS_H], well: [WELL_W, WELL_H], quill: [QUILL_W, QUILL_H] } };
})();
