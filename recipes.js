/*
 * Add new recipes here — each entry becomes a folded card on the shelf.
 *
 * ingredient fields
 *   qty    number for the recipe as written
 *   unit   'g' | 'ml' | 'tsp' | 'tbsp' | 'cup' (omit for "countable" things like bananas)
 *   name   string, or { one, many } for things that pluralise
 *   whole  true = round scaled counts to whole items (5 dates, not 5¼)
 *   note   { before, range: [min, max], unit, after } — a scaled aside, e.g. "approx. 35–40 g (pitted)"
 *
 * Optional: method: ['step one', 'step two'], and a doodle (small inline SVG, ~100×100).
 */
window.RECIPES = [
  {
    id: 'chomclit-ice-cream',
    title: 'Chomclit Ice Cream',
    blurb: 'banana · dates · cocoa',
    doodle: `
      <svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="#4f3022" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="50" cy="58" rx="39" ry="8" fill="#d9cfbb"/>
        <circle cx="35" cy="45" r="19" fill="#6b3f26"/>
        <circle cx="65" cy="46" r="18" fill="#7b4a2d"/>
        <circle cx="50" cy="31" r="17" fill="#5a3320"/>
        <path d="M24 40 C26 34 31 32 36 33 M56 40 C60 36 66 36 70 40 M41 24 C44 20 49 20 52 22" stroke="#b47a52" stroke-width="2"/>
        <path d="M13 58 C13 84 31 95 50 95 C69 95 87 84 87 58 C70 66 30 66 13 58Z" fill="#f1e8d4"/>
        <path d="M17 70 C34 80 66 80 83 70" stroke="#6f8fb4" stroke-width="3"/>
        <path d="M22 79 C38 88 62 88 78 79" stroke="#6f8fb4" stroke-width="1.6"/>
        <circle cx="75" cy="24" r="8" fill="#f4dc8a"/><circle cx="75" cy="24" r="3.2" fill="#f9eeb8" stroke-width="1.2"/>
        <path d="M23 20 C20 15 26 11 30 14 C33 17 30 22 25 23Z" fill="#e6c48c" stroke-width="1.8"/>
        <ellipse cx="58" cy="15" rx="5" ry="3.4" fill="#4a2a1a" transform="rotate(-24 58 15)" stroke-width="1.6"/>
        <g fill="#4f3022" stroke="none"><circle cx="40" cy="20" r="1"/><circle cx="68" cy="34" r="1"/><circle cx="29" cy="30" r="1"/><circle cx="52" cy="40" r="1"/></g>
      </svg>`,
    ingredients: [
      { qty: 1,   name: { one: 'ripe banana', many: 'ripe bananas' } },
      { qty: 5,   whole: true, name: { one: 'Deglet Noor date', many: 'Deglet Noor dates' },
        note: { before: 'approx. ', range: [35, 40], unit: 'g', after: ' (pitted)' } },
      { qty: 2,   unit: 'tbsp', name: 'cocoa powder' },
      { qty: 10,  unit: 'g',    name: 'cashews' },
      { qty: 1,   unit: 'tsp',  name: 'vanilla extract' },
      { qty: 250, unit: 'ml',   name: 'unsweetened soy milk' },
    ],
  },
];
