import type { Aisle, ProteinOption, ProteinTag } from '../types'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[[^\]]*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function cleanDisplayName(name: string): string {
  return name
    .replace(/\[[^\]]*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,+$/g, '')
    .trim()
}

/** Spelling / plural / case only — cuts and onion types stay distinct. */
const ALIASES: Record<string, string> = {
  'chicken-thighs': 'chicken-thigh',
  'chicken-thigh': 'chicken-thigh',
  'chicken-breasts': 'chicken-breast',
  'onion': 'onion',
  'onions': 'onion',
  'yellow-onion': 'yellow-onion',
  'yellow-onions': 'yellow-onion',
  'red-onion': 'red-onion',
  'red-onions': 'red-onion',
  'spring-onion': 'spring-onion',
  'spring-onions': 'spring-onion',
  'scallion': 'scallion',
  'scallions': 'scallion',
  'carrot': 'carrot',
  'carrots': 'carrot',
  'cucumber': 'cucumber',
  'cucumbers': 'cucumber',
  'leek': 'leek',
  'leeks': 'leek',
  'green-pepper': 'green-pepper',
  'green-peppers': 'green-pepper',
  'red-pepper': 'red-pepper',
  'red-peppers': 'red-pepper',
  'yellow-pepper': 'yellow-pepper',
  'yellow-peppers': 'yellow-pepper',
  'cherry-tomato': 'cherry-tomato',
  'cherry-tomatoes': 'cherry-tomato',
  'long-bean': 'long-bean',
  'long-beans': 'long-bean',
  'snap-pea': 'snap-pea',
  'snap-peas': 'snap-pea',
  'oyster-mushroom': 'oyster-mushroom',
  'oyster-mushrooms': 'oyster-mushroom',
  'king-oyster': 'king-oyster-mushroom',
  'king-oyster-mushroom': 'king-oyster-mushroom',
  'king-oyster-mushrooms': 'king-oyster-mushroom',
  'shiitake-mushroom': 'shiitake-mushroom',
  'shiitake-mushrooms': 'shiitake-mushroom',
  'fresh-shiitake-mushroom': 'shiitake-mushroom',
  'fresh-shiitake-mushrooms': 'shiitake-mushroom',
  'woodear-mushroom': 'woodear-mushroom',
  'woodear-mushrooms': 'woodear-mushroom',
  'bamboo-shoot': 'bamboo-shoot',
  'bamboo-shoots': 'bamboo-shoot',
  'bean-sprout': 'bean-sprout',
  'bean-sprouts': 'bean-sprout',
  beansprouts: 'bean-sprout',
  'lime-leaf': 'lime-leaf',
  'lime-leaves': 'lime-leaf',
  'curry-leaf': 'curry-leaf',
  'curry-leaves': 'curry-leaf',
  'ginger-flower': 'ginger-flower',
  'chilli-padi': 'chilli-padi',
  'chili-padi': 'chilli-padi',
  'mild-red-chili': 'mild-red-chilli',
  'mild-red-chilis': 'mild-red-chilli',
  'mild-red-chilli': 'mild-red-chilli',
  'mild-red-chillis': 'mild-red-chilli',
  'dried-chili': 'dried-chilli',
  'dried-chilli': 'dried-chilli',
  'dried-chillis': 'dried-chilli',
  'kailan-stem': 'kailan-stem',
  'kailan-stems': 'kailan-stem',
  'lily-bulb': 'lily-bulb',
  'lily-bulbs': 'lily-bulb',
  'pork-belly': 'pork-belly',
  'tau-kwa': 'tau-kwa',
  'sweet-potato': 'sweet-potato',
  'water-chestnut': 'water-chestnut',
  'water-chestnuts': 'water-chestnut',
  'wong-bok': 'wong-bok',
  'red-date': 'red-date',
  'red-dates': 'red-date',
  'parmesan-cheese': 'parmesan',
  parmesan: 'parmesan',
  'light-soy-sauce': 'light-soy-sauce',
  'dark-soy-sauce': 'dark-soy-sauce',
  'corn-starch': 'cornstarch',
  cornstarch: 'cornstarch',
  'coarse-sea-salt': 'sea-salt',
  'sea-salt': 'sea-salt',
  salt: 'salt',
  sugar: 'sugar',
  'brown-sugar': 'brown-sugar',
  water: 'water',
  garlic: 'garlic',
  ginger: 'ginger',
  'sesame-oil': 'sesame-oil',
  'olive-oil': 'olive-oil',
}

const AISLE_BY_ID: Record<string, Aisle> = {
  'chicken-thigh': 'meat',
  'chicken-breast': 'meat',
  chicken: 'meat',
  'minced-chicken': 'meat',
  'pork-loin': 'meat',
  'pork-belly': 'meat',
  'pork-collar': 'meat',
  'lean-pork-collar': 'meat',
  'lean-pork-loin': 'meat',
  'minced-pork': 'meat',
  pork: 'meat',
  beef: 'meat',
  'minced-beef': 'meat',
  'beef-flank': 'meat',
  'sliced-beef-short-plate': 'meat',
  'short-plate': 'meat',
  'short-rib': 'meat',
  'baby-back-ribs': 'meat',
  'whole-chicken': 'meat',
  'oyster-mushroom': 'produce',
  'king-oyster-mushroom': 'produce',
  salmon: 'seafood',
  'snow-cod': 'seafood',
  gindara: 'seafood',
  'asian-seabass': 'seafood',
  'batang-spanish-mackerel': 'seafood',
  batang: 'seafood',
  mackerel: 'seafood',
  'smoke-haddock': 'seafood',
  'smoked-haddock': 'seafood',
  'atlantic-cod': 'seafood',
  bocourti: 'seafood',
  onion: 'produce',
  'yellow-onion': 'produce',
  'red-onion': 'produce',
  'spring-onion': 'produce',
  scallion: 'produce',
  garlic: 'produce',
  ginger: 'produce',
  zucchini: 'produce',
  carrot: 'produce',
  'long-bean': 'produce',
  'snap-pea': 'produce',
  peas: 'produce',
  cabbage: 'produce',
  lettuce: 'produce',
  'lettuce-leaves': 'produce',
  kale: 'produce',
  okra: 'produce',
  taro: 'produce',
  'butternut-squash': 'produce',
  pumpkin: 'produce',
  'kabocha-pumpkin': 'produce',
  kabocha: 'produce',
  'sweet-potato': 'produce',
  'cherry-tomato': 'produce',
  'red-pepper': 'produce',
  'green-pepper': 'produce',
  'yellow-pepper': 'produce',
  shallots: 'produce',
  'lime-leaf': 'produce',
  'curry-leaf': 'produce',
  lime: 'produce',
  lemon: 'produce',
  lemons: 'produce',
  tortillas: 'bakery',
  'tortilla-wraps': 'bakery',
  'dumpling-wrappers': 'bakery',
  rice: 'pantry',
  'toasted-rice': 'pantry',
  'rice-cakes': 'pantry',
  'rice-noodles': 'pantry',
  flour: 'bakery',
  butter: 'dairy',
  buttermilk: 'dairy',
  mozzarella: 'dairy',
  parmesan: 'dairy',
  feta: 'dairy',
  'maple-syrup': 'pantry',
  salt: 'pantry',
  'sea-salt': 'pantry',
  sugar: 'pantry',
  'brown-sugar': 'pantry',
  cornstarch: 'pantry',
  water: 'pantry',
  'light-soy-sauce': 'pantry',
  'dark-soy-sauce': 'pantry',
  'oyster-sauce': 'pantry',
  'sesame-oil': 'pantry',
  'olive-oil': 'pantry',
  'cashew-butter': 'pantry',
  'smoked-paprika': 'pantry',
}

const MEAT_RE =
  /\b(chicken|pork|beef|lamb|mince|ribeye|flank|short-?plate|short-?rib|ribs|sausage|bacon|thigh|breast|collar|loin|belly)\b/i
const SEAFOOD_RE =
  /\b(salmon|cod|gindara|seabass|mackerel|batang|haddock|fish|prawn|shrimp|squid)\b/i
const DAIRY_RE = /\b(butter|buttermilk|cheese|mozzarella|parmesan|feta|milk|yoghurt|yogurt|cream)\b/i
const BAKERY_RE = /\b(tortilla|wrapper|flour|panko|bread|pancake|bun)\b/i
const PANTRY_RE =
  /\b(sauce|soy|oil|salt|sugar|starch|powder|vinegar|wine|mirin|sake|stock|spice|cumin|paprika|pepper|miso|tahini|honey|maple|mustard|mayo|kecap|sambal|chilli|chili|garlic powder|onion powder|water|cornstarch|sesame|oregano|thyme|rosemary)\b/i

export function itemIdFromName(name: string): string {
  const cleaned = cleanDisplayName(name)
  const slug = slugify(cleaned)
  return ALIASES[slug] ?? slug
}

export function aisleFor(itemId: string, name: string): Aisle {
  if (AISLE_BY_ID[itemId]) return AISLE_BY_ID[itemId]
  const hay = `${itemId} ${name}`
  if (SEAFOOD_RE.test(hay)) return 'seafood'
  if (MEAT_RE.test(hay) && !/mushroom|tofu|tau-kwa/.test(hay)) return 'meat'
  if (DAIRY_RE.test(hay)) return 'dairy'
  if (BAKERY_RE.test(hay)) return 'bakery'
  if (PANTRY_RE.test(hay)) return 'pantry'
  return 'produce'
}

const PROTEIN_LABELS: { match: RegExp; id: string; label: string }[] = [
  { match: /chicken\s*thigh/i, id: 'chicken-thigh', label: 'Chicken thighs' },
  { match: /chicken\s*breast/i, id: 'chicken-breast', label: 'Chicken breast' },
  { match: /minced\s*chicken/i, id: 'minced-chicken', label: 'Minced chicken' },
  { match: /^chicken$|meat:\s*chicken\b/i, id: 'chicken', label: 'Chicken' },
  { match: /pork\s*loin/i, id: 'pork-loin', label: 'Pork loin' },
  { match: /pork\s*belly/i, id: 'pork-belly', label: 'Pork belly' },
  { match: /pork\s*collar|lean\s*pork/i, id: 'pork-collar', label: 'Pork collar' },
  { match: /minced\s*pork/i, id: 'minced-pork', label: 'Minced pork' },
  { match: /^pork$/i, id: 'pork', label: 'Pork' },
  { match: /oyster\s*mushroom/i, id: 'oyster-mushroom', label: 'Oyster mushrooms' },
  { match: /king\s*oyster/i, id: 'king-oyster-mushroom', label: 'King oyster mushrooms' },
  { match: /vegetarian|vegetables?\s*only/i, id: 'vegetarian', label: 'Vegetarian' },
  { match: /beef\s*flank/i, id: 'beef-flank', label: 'Beef flank' },
  { match: /short\s*plate/i, id: 'short-plate', label: 'Beef short plate' },
  { match: /ribeye/i, id: 'ribeye', label: 'Ribeye' },
  { match: /^beef$/i, id: 'beef', label: 'Beef' },
  { match: /atlantic\s*cod/i, id: 'atlantic-cod', label: 'Atlantic cod' },
  { match: /bocourti/i, id: 'bocourti', label: 'Bocourti' },
]

export function proteinFromPhrase(phrase: string): ProteinOption | null {
  const cleaned = phrase.replace(/\(\+\$[\d.]+\)/g, '').trim()
  if (!cleaned || /^(nothing|no rice|rice)$/i.test(cleaned)) return null
  if (/lettuce|perilla|yuzu butter|kombu butter/i.test(cleaned)) return null
  if (/single|double/i.test(cleaned) && /portion/i.test(cleaned)) return null
  if (/^single$|^double$/i.test(cleaned)) return null

  for (const row of PROTEIN_LABELS) {
    if (row.match.test(cleaned)) return { id: row.id, label: row.label }
  }
  if (/^chicken\b/i.test(cleaned)) return { id: 'chicken', label: 'Chicken' }
  if (/^pork\b/i.test(cleaned)) return { id: 'pork', label: 'Pork' }
  if (/^beef\b/i.test(cleaned)) return { id: 'beef', label: 'Beef' }
  return { id: itemIdFromName(cleaned), label: cleanDisplayName(cleaned) }
}

export function defaultProteinId(options: ProteinOption[]): string | null {
  const chicken = options.find((o) => o.id.startsWith('chicken'))
  return chicken?.id ?? options[0]?.id ?? null
}

export function isChickenLike(id: string): boolean {
  return id.startsWith('chicken')
}

export function proteinTagFor(ids: string[]): ProteinTag {
  const hay = ids.join(' ').toLowerCase()
  if (/chicken/.test(hay)) return 'chicken'
  if (/pork|bacon|baby.?back rib|char siu|tonjiru|dong po/.test(hay)) return 'pork'
  if (/beef|ribeye|short.?plate|short.?rib|flank|galbi|gyudon|steak|meatball/.test(hay)) return 'beef'
  if (
    /salmon|cod|gindara|seabass|sea bass|mackerel|batang|haddock|\bfish\b|ikan|prawn|shrimp|squid|scallop|barramundi|tilapia|snapper|halibut|tuna|anchov/.test(
      hay,
    )
  )
    return 'seafood'
  return 'veggie'
}

export const PROTEIN_TAG_LABEL: Record<ProteinTag, string> = {
  chicken: 'Chicken',
  pork: 'Pork',
  beef: 'Beef',
  seafood: 'Seafood',
  veggie: 'Veggie',
}

export const AISLE_ORDER: Aisle[] = ['meat', 'seafood', 'produce', 'dairy', 'bakery', 'pantry']

export const AISLE_LABEL: Record<Aisle, string> = {
  meat: 'Meat',
  seafood: 'Seafood',
  produce: 'Produce',
  dairy: 'Dairy',
  bakery: 'Bakery',
  pantry: 'Pantry & sauces',
}
