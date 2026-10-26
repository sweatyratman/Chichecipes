/*
 * Add new recipes here — each entry becomes a card on the shelf.
 *
 * ingredient fields
 *   qty    number for the recipe as written
 *   unit   'g' | 'ml' | 'tsp' | 'tbsp' | 'cup' (omit for "countable" things like bananas)
 *   name   string, or { one, many } for things that pluralise
 *   whole  true = round scaled counts to whole items (5 dates, not 5¼)
 *   note   { before, range: [min, max], unit, after } — a scaled aside, e.g. "approx. 35–40 g (pitted)"
 *
 * Optional: method: ['step one', 'step two']
 */
window.RECIPES = [
  {
    id: 'chomclit-ice-cream',
    title: 'Chomclit Ice Cream',
    blurb: 'banana · dates · cocoa',
    doodle: `
      <svg viewBox="0 0 80 100" aria-hidden="true" fill="none" stroke="#3a2e26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 52 L40 94 L58 52Z" fill="#e6b86e"/>
        <path d="M29 62 L48 80 M37 56 L53 70 M26 52 L44 88 M54 52 L36 88" stroke="#b9843c" stroke-width="1.6"/>
        <path d="M15 52 C8 36 17 22 30 22 C32 11 49 10 52 22 C65 22 72 38 65 52 C59 58 51 53 46 58 C42 53 36 59 30 55 C24 56 19 56 15 52Z" fill="#6d4228"/>
        <path d="M24 34 C26 29 30 28 34 29 M50 30 C55 31 58 35 58 39" stroke="#a96f4a" stroke-width="2"/>
        <circle cx="40" cy="11" r="5.5" fill="#d8453b"/>
        <path d="M40 6 C42 1 46 0 49 1" stroke="#4a7a3a"/>
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
