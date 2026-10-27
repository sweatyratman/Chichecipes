/*
 * Add new recipes here — each entry becomes a folded card on the shelf.
 *
 * ingredient fields
 *   qty    number for the recipe as written
 *   unit   'g' | 'ml' | 'tsp' | 'tbsp' | 'cup' (omit for "countable" things like bananas)
 *   name   string, or { one, many } for things that pluralise
 *   whole  true = round scaled counts to whole items (5 dates, not 5¼)
 *   text   a fixed line that never scales (use instead of qty/unit/name), e.g. { text: 'Oat milk just below line' }
 *   note   { before, range: [min, max], unit, after } — a scaled aside, e.g. "approx. 35–40 g (pitted)"
 *
 * Optional: method: ['step one', 'step two'], and a doodle (the name of a sprite in sprites.js, e.g. 'iceCream').
 */
window.RECIPES = [
  {
    id: 'chomclit-ice-cream',
    title: 'Chomclit Ice Cream',
    doodle: 'iceCream',
    ingredients: [
      { qty: 1,   name: { one: 'ripe banana', many: 'ripe bananas' } },
      { qty: 5,   whole: true, name: { one: 'Deglet Noor date', many: 'Deglet Noor dates' },
        note: { before: 'approx. ', range: [35, 40], unit: 'g', after: ' (pitted)' } },
      { qty: 2,   unit: 'tbsp', name: 'cocoa powder' },
      { qty: 10,  unit: 'g',    name: 'cashews' },
      { qty: 1,   unit: 'tsp',  name: 'vanilla extract' },
      { qty: 250, unit: 'ml',   name: 'unsweetened oat milk' },
    ],
  },
  {
    id: 'hot-chomclit',
    title: 'Hot Chomclit',
    doodle: 'mug',
    ingredients: [
      { text: 'Oat milk just below line' }, // a fixed amount: never scales
      { qty: 3,   unit: 'tsp', name: 'date sugar' },
      { qty: 2,   unit: 'tsp', name: 'cacao powder' },
      { qty: 0.5, unit: 'tsp', name: 'decaf instant coffee' },
    ],
  },
];
