import type { CookMethod, DishIngredient, ProteinOption, Quantity, SaucePack } from '../types'
import {
  aisleFor,
  cleanDisplayName,
  itemIdFromName,
  proteinFromPhrase,
} from './normalize'

const SAUCE_HEADER =
  /^(sauce\s*\/\s*marinade|marinade\s*\/\s*sauce|sauce|marinade)\s*:?\s*(.*)$/i

const QTY =
  /^(?<name>.+?)\s*:\s*(?<rest>~?\s*\d+(?:\.\d+)?\s*(?:g|ml|kg|pcs|tsp|tbsp|slices?|steaks?|fillets?|skewers)?(?:\s*[-–]\s*~?\s*\d+(?:\.\d+)?\s*(?:g|ml|kg)?)?(?:\s*\([^)]*\))?)\s*$/i

const MISSING_COLON = /^(?<name>.+?)\s+(?<rest>~?\d+(?:\.\d+)?\s*(?:g|ml|kg|pcs|tsp|tbsp))\s*$/i

function parseQuantity(rest: string): Quantity {
  const raw = rest.replace(/\s+/g, ' ').trim()
  const range = raw.match(
    /~?\s*(\d+(?:\.\d+)?)\s*(g|ml|kg|pcs|tsp|tbsp|slices?|steaks?|fillets?|skewers)?\s*[-–]\s*~?\s*(\d+(?:\.\d+)?)\s*(g|ml|kg)?/i,
  )
  if (range) {
    const unit = (range[2] || range[4] || '').toLowerCase() || null
    return {
      amount: Number(range[1]),
      min: Number(range[1]),
      max: Number(range[3]),
      unit: normalizeUnit(unit),
      raw,
    }
  }
  const single = raw.match(
    /~?\s*(\d+(?:\.\d+)?)\s*(g|ml|kg|pcs|tsp|tbsp|slices?|steaks?|fillets?|skewers)?/i,
  )
  if (single) {
    return {
      amount: Number(single[1]),
      unit: normalizeUnit((single[2] || '').toLowerCase()) || null,
      raw,
    }
  }
  return { amount: null, unit: null, raw }
}

function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null
  if (unit.startsWith('slice')) return 'slice'
  if (unit.startsWith('steak')) return 'steak'
  if (unit.startsWith('fillet')) return 'fillet'
  if (unit.startsWith('skewer')) return 'skewer'
  return unit
}

function splitComponents(list: string): string[] {
  const names: string[] = []
  let buf = ''
  let depth = 0
  for (const ch of list) {
    if (ch === '[') depth += 1
    if (ch === ']') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      const piece = cleanDisplayName(buf)
      if (piece) names.push(piece)
      buf = ''
      continue
    }
    buf += ch
  }
  const tail = cleanDisplayName(buf)
  if (tail) names.push(tail)
  return names
}

function skipLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^ingredients:?$/i.test(t)) return true
  if (/^optional:\s*rice$/i.test(t)) return true
  return false
}

export function parseIngredientBlock(block: string): {
  ingredients: DishIngredient[]
  sauces: SaucePack[]
} {
  const lines = block
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !skipLine(l))

  const ingredients: DishIngredient[] = []
  const sauces: SaucePack[] = []
  let sauceIndex = 0

  const pushFresh = (name: string, qtyRaw: string, recipeText: string) => {
    const display = cleanDisplayName(name)
    if (!display) return
    const itemId = itemIdFromName(display)
    ingredients.push({
      itemId,
      name: display,
      recipeText,
      quantity: parseQuantity(qtyRaw),
      aisle: aisleFor(itemId, display),
      kind: 'fresh',
    })
  }

  const pushSauce = (label: string, headerRest: string, componentLine: string | null) => {
    const id = `sauce-${++sauceIndex}`
    const rest = headerRest.trim()
    const qtyMatch = rest.match(
      /^(~?\s*\d+(?:\.\d+)?\s*(?:g|ml|kg))(?:\s*$)/i,
    )
    let quantity: Quantity = { amount: null, unit: null, raw: rest }
    let inlineList = rest
    if (qtyMatch) {
      quantity = parseQuantity(qtyMatch[1])
      inlineList = ''
    }
    const listSource = [inlineList, componentLine].filter(Boolean).join(', ')
    const components = splitComponents(listSource)
      .filter((n) => !SAUCE_HEADER.test(n))
      .map((name) => ({ itemId: itemIdFromName(name), name }))

    sauces.push({ id, label: label.replace(/:$/, ''), quantity, components })

    if (quantity.amount != null) {
      ingredients.push({
        itemId: `${id}-pack`,
        name: label.replace(/:$/, ''),
        recipeText: `${label} ${quantity.raw}`.trim(),
        quantity,
        aisle: 'pantry',
        kind: 'sauce-pack',
        sauceId: id,
      })
    }

    for (const c of components) {
      ingredients.push({
        itemId: c.itemId,
        name: c.name,
        recipeText: c.name,
        quantity: { amount: null, unit: null, raw: '' },
        aisle: aisleFor(c.itemId, c.name),
        kind: 'pantry',
        sauceId: id,
      })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const sauce = line.match(SAUCE_HEADER)
    if (sauce) {
      const label = cleanDisplayName(sauce[1].replace(/\s+/g, '/'))
      const rest = sauce[2] ?? ''
      const looksLikeQtyOnly = /^\s*~?\d/.test(rest) && !rest.includes(',')
      const next = lines[i + 1]
      const nextIsHeader = next && (SAUCE_HEADER.test(next) || QTY.test(next) || MISSING_COLON.test(next))
      let componentLine: string | null = null
      if ((!rest || looksLikeQtyOnly) && next && !nextIsHeader && !SAUCE_HEADER.test(next) && !QTY.test(next)) {
        componentLine = next
        i += 1
      }
      const prettyLabel = /marinade/i.test(sauce[1]) && /sauce/i.test(sauce[1])
        ? 'Sauce / marinade'
        : /marinade/i.test(sauce[1])
          ? 'Marinade'
          : 'Sauce'
      pushSauce(prettyLabel || label, rest, componentLine)
      continue
    }

    const qty = line.match(QTY)
    if (qty?.groups) {
      pushFresh(qty.groups.name, qty.groups.rest, line)
      continue
    }
    const missing = line.match(MISSING_COLON)
    if (missing?.groups && !line.includes(',')) {
      pushFresh(missing.groups.name, missing.groups.rest, line)
      continue
    }

    // Name-only festive lines (no commas = one ingredient)
    if (!line.includes(',') && line.length < 80) {
      const display = cleanDisplayName(line)
      const itemId = itemIdFromName(display)
      ingredients.push({
        itemId,
        name: display,
        recipeText: line,
        quantity: { amount: null, unit: null, raw: '' },
        aisle: aisleFor(itemId, display),
        kind: aisleFor(itemId, display) === 'pantry' ? 'pantry' : 'fresh',
      })
    }
  }

  markProteinSlot(ingredients)
  return { ingredients, sauces }
}

function markProteinSlot(ingredients: DishIngredient[]) {
  const fresh = ingredients.filter((i) => i.kind === 'fresh')
  const meat =
    /chicken|pork|beef|lamb|mutton|duck|turkey|salmon|cod|mackerel|seabass|sea-bass|batang|gindara|haddock|halibut|tuna|snapper|barramundi|tilapia|pomfret|threadfin|grouper|dory|prawn|shrimp|squid|sotong|scallop|rib|flank|mince|short-plate|shortplate|collar|brisket|sirloin|striploin|ribeye|belly|drumstick|sausage/i
  // Tofu only claims the slot when there is no meat in the kit, so mapo tofu
  // still treats the minced pork as the thing to brown.
  const hit = fresh.find((i) => meat.test(i.itemId)) ?? fresh.find((i) => /tofu|tempeh/i.test(i.itemId))
  if (hit) hit.isProteinSlot = true
}

export function parseOptions(options: string): ProteinOption[] {
  if (!options) return []
  const found: ProteinOption[] = []
  const seen = new Set<string>()
  const parts = options.split('|').map((p) => p.trim())
  for (const part of parts) {
    const labeled = part.match(/^([^:]+):{1,2}\s*(.+)$/)
    const key = (labeled?.[1] ?? '').replace(/:$/, '').trim().toLowerCase()
    const value = labeled?.[2] ?? part
    if (/rice|add\s*ons?|butter/i.test(key)) continue
    if (/size/i.test(key) && /portion/i.test(value)) continue
    for (const piece of value.split('/')) {
      const opt = proteinFromPhrase(piece)
      if (!opt || seen.has(opt.id)) continue
      seen.add(opt.id)
      found.push(opt)
    }
  }
  return found
}

export function inferServingsBase(name: string, description: string, calories: string): number {
  const blob = `${name}\n${description}\n${calories}`
  const servesTitle = name.match(/serves\s+(\d+)/i)
  if (servesTitle) return Number(servesTitle[1])
  const kcalServes = calories.match(/serves\s+(\d+)/i)
  if (kcalServes) return Number(kcalServes[1])
  const range = blob.match(
    /feeds?\s+(\d+)\s*(?:-|–|to)\s*(\d+)|shareable[^\d]{0,24}(\d+)\s*(?:-|–)\s*(\d+)\s*pax|for\s+(\d+)\s*(?:-|–)\s*(\d+)\s*pax/i,
  )
  if (range) {
    const n = Number(range[1] || range[3] || range[5])
    if (n) return n
  }
  const single = blob.match(
    /feeds?\s+(\d+)\s*(?:pax|people)?|serving size:\s*feeds\s+(\d+)|the roll feeds\s+(\d+)/i,
  )
  if (single) return Number(single[1] || single[2] || single[3])
  return 1
}

export function parseCalories(calories: string): { display: string; kcal: number | null } {
  const display = calories.replace(/\s+/g, ' ').trim()
  const n = display.match(/(\d+)\s*kcal/i)
  return { display, kcal: n ? Number(n[1]) : null }
}

/** Upper bound of a "5-8 minutes" / "~40 minutes" cooking time. */
export function parseTimeMinutes(time: string): number | null {
  const nums = time.match(/\d+/g)
  if (!nums) return null
  return Math.max(...nums.map(Number))
}

export function parseEffortHats(effort: string): number | null {
  const n = effort.match(/(\d+)\s*hat/i)
  return n ? Number(n[1]) : null
}

export function parseChillis(spice: string): number | null {
  const explicit = spice.match(/(\d+)\s*chilli/i)
  if (explicit) return Number(explicit[1])
  if (/no[\s-]*spic|non[\s-]*spic/i.test(spice)) return 0
  if (/mild to medium/i.test(spice)) return 2
  if (/mild/i.test(spice)) return 1
  if (/medium/i.test(spice)) return 2
  if (/spicy|hot/i.test(spice)) return 3
  return null
}

export function methodFromEquipment(equipment: string): CookMethod {
  const e = equipment.toLowerCase()
  const has = (re: RegExp) => re.test(e)
  const pan = has(/pan|stove|fry/)
  const pot = has(/\bpot\b/)
  const oven = has(/oven/)
  const steamer = has(/steam/)
  const airFryer = has(/air.?fryer/)
  const blender = has(/blender/)

  if (airFryer) return 'air-fryer'
  if (steamer && pan) return 'steamer-pan'
  if (steamer && pot) return 'steamer-pan'
  if (steamer) return 'steamer'
  if (oven && blender) return 'blender'
  if (oven && (pan || pot)) return 'oven-pan'
  if (oven) return 'oven'
  if (pan && pot) return 'pan-pot'
  if (pot) return 'pot'
  return 'pan'
}

export function dishIdFromName(name: string): string {
  return itemIdFromName(name) || slugifyFallback(name)
}

function slugifyFallback(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
