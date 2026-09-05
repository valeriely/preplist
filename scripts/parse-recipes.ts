import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultProteinId, proteinTagFor } from '../src/domain/normalize.ts'
import {
  dishIdFromName,
  inferServingsBase,
  methodFromEquipment,
  parseCalories,
  parseChillis,
  parseEffortHats,
  parseIngredientBlock,
  parseOptions,
  parseTimeMinutes,
} from '../src/domain/parseIngredients.ts'
import type { Dish, DishSource } from '../src/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(join(root, 'data/recipes.raw.json'), 'utf8')) as {
  name: string
  category: string
  price: string
  options: string
  effort: string
  equipment: string
  time: string
  spice: string
  calories: string
  ingredients: string
  allergy: string
  description: string
  url: string
}[]

function sourceOf(category: string): DishSource {
  if (/festive/i.test(category)) return 'festive'
  if (/meal/i.test(category)) return 'kit'
  return 'other'
}

const images = JSON.parse(readFileSync(join(root, 'src/data/images.json'), 'utf8')) as Record<
  string,
  { image: string; thumb: string }
>

const dishes: Dish[] = raw.map((row) => {
  const { ingredients, sauces } = parseIngredientBlock(row.ingredients)
  const proteinOptions = parseOptions(row.options)
  const cal = parseCalories(row.calories)
  const handle = row.url.split('/products/')[1]?.split(/[?#]/)[0] ?? ''
  const photo = images[handle]
  const proteinSlot = ingredients.find((i) => i.isProteinSlot)
  const time = row.time.replace(/\s+/g, ' ').trim()
  const equipment = row.equipment.replace(/\s+/g, ' ').trim()
  return {
    id: dishIdFromName(row.name),
    name: row.name,
    source: sourceOf(row.category),
    servingsBase: inferServingsBase(row.name, row.description, row.calories),
    time,
    timeMinutes: parseTimeMinutes(time),
    calories: cal.display,
    caloriesKcal: cal.kcal,
    equipment,
    method: methodFromEquipment(equipment),
    effortHats: parseEffortHats(row.effort),
    spice: row.spice.replace(/\s+/g, ' ').trim(),
    chillis: parseChillis(row.spice),
    allergy: row.allergy.replace(/\s+/g, ' ').trim(),
    url: row.url,
    image: photo?.image ?? null,
    thumb: photo?.thumb ?? null,
    proteinTag: proteinTagFor([
      proteinSlot?.itemId ?? '',
      proteinSlot?.name ?? '',
      ...proteinOptions.map((p) => p.id),
      row.name,
    ]),
    description: row.description,
    proteinOptions,
    defaultProteinId: defaultProteinId(proteinOptions),
    ingredients,
    sauces,
  }
})

const seen = new Map<string, number>()
for (const d of dishes) {
  const n = (seen.get(d.id) ?? 0) + 1
  seen.set(d.id, n)
  if (n > 1) d.id = `${d.id}-${n}`
}

writeFileSync(join(root, 'src/data/dishes.json'), JSON.stringify(dishes, null, 2))

const names = new Set<string>()
let unqty = 0
for (const d of dishes) {
  for (const i of d.ingredients) {
    names.add(`${i.itemId}\t${i.name}\t${i.aisle}\t${i.kind}`)
    if (i.kind === 'fresh' && i.quantity.amount == null) unqty += 1
  }
}

console.log(`Wrote ${dishes.length} dishes, ${names.size} item variants`)
console.log(`Fresh lines without quantity: ${unqty}`)
console.log(`Sauces: ${dishes.reduce((n, d) => n + d.sauces.length, 0)}`)
