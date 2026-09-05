import type {
  Contribution,
  Dish,
  DishGroup,
  GroceryLine,
  PlanEntry,
  Quantity,
  SplitGroup,
  WeekPlan,
} from '../types'
import { AISLE_ORDER } from './normalize'

export function scaleQuantity(qty: Quantity, factor: number): Quantity {
  if (qty.amount == null) {
    return { ...qty }
  }
  const amount = roundQty(qty.amount * factor)
  const next: Quantity = { ...qty, amount, raw: formatQuantity({ ...qty, amount }) }
  if (qty.min != null) next.min = roundQty(qty.min * factor)
  if (qty.max != null) next.max = roundQty(qty.max * factor)
  return next
}

export function roundQty(n: number): number {
  return Math.round(n * 10) / 10
}

export function formatQuantity(qty: Quantity): string {
  if (qty.amount == null) return qty.raw || 'as needed'
  if (qty.min != null && qty.max != null && qty.min !== qty.max) {
    return `${formatNum(qty.min)}–${formatNum(qty.max)}${qty.unit ?? ''}`
  }
  return `${formatNum(qty.amount)}${qty.unit ?? ''}`
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(roundQty(n))
}

export function resolveDish(dish: Dish, entry: PlanEntry): Dish {
  const factor = entry.portions / dish.servingsBase
  const proteinId = entry.proteinId ?? dish.defaultProteinId
  const protein = dish.proteinOptions.find((p) => p.id === proteinId)

  const ingredients = dish.ingredients.map((ing) => {
    const scaled = { ...ing, quantity: scaleQuantity(ing.quantity, factor) }
    if (ing.isProteinSlot && protein) {
      return {
        ...scaled,
        itemId: protein.id,
        name: protein.label,
        recipeText: `${protein.label}: ${formatQuantity(scaled.quantity)}`,
      }
    }
    return scaled
  })

  const sauces = dish.sauces.map((s) => ({
    ...s,
    quantity: scaleQuantity(s.quantity, factor),
  }))

  return { ...dish, ingredients, sauces }
}

function addQty(a: Quantity, b: Quantity): Quantity {
  if (a.amount == null && b.amount == null) {
    return { amount: null, unit: null, raw: [a.raw, b.raw].filter(Boolean).join(' + ') }
  }
  if (a.amount == null) return { ...b }
  if (b.amount == null) return { ...a }
  const unit = a.unit ?? b.unit
  const amount = roundQty(a.amount + b.amount)
  const min = a.min != null || b.min != null ? roundQty((a.min ?? a.amount) + (b.min ?? b.amount)) : undefined
  const max = a.max != null || b.max != null ? roundQty((a.max ?? a.amount) + (b.max ?? b.amount)) : undefined
  const next: Quantity = { amount, unit, raw: '', min, max }
  next.raw = formatQuantity(next)
  return next
}

function lineKey(itemId: string, unit: string | null, kind: string): string {
  return `${kind}:${itemId}:${unit ?? 'none'}`
}

export function componentKey(itemId: string): string {
  return lineKey(itemId, null, 'pantry')
}

function saucePackLine(dish: Dish, hidden: Set<string>): GroceryLine[] {
  const lines: GroceryLine[] = []
  for (const sauce of dish.sauces) {
    const itemId = `${dish.id}:${sauce.id}`
    if (hidden.has(itemId)) continue
    lines.push({
      key: lineKey(itemId, sauce.quantity.unit, 'sauce-pack'),
      itemId,
      name: sauce.label,
      aisle: 'pantry',
      kind: 'sauce-pack',
      quantity: { ...sauce.quantity },
      contributions: [{ dishId: dish.id, dishName: dish.name, quantity: sauce.quantity }],
      components: sauce.components.filter((c) => !hidden.has(c.itemId)),
    })
  }
  return lines
}

function isSauceIngredient(ing: { kind: string; sauceId?: string }): boolean {
  return ing.kind === 'sauce-pack' || ing.sauceId != null
}

export function tallyGrocery(dishes: Dish[], plan: WeekPlan): GroceryLine[] {
  const hidden = new Set(plan.hiddenItemIds)
  const byDish = new Map(dishes.map((d) => [d.id, d]))
  const map = new Map<string, GroceryLine>()

  for (const entry of plan.entries) {
    const dish = byDish.get(entry.dishId)
    if (!dish) continue
    const resolved = resolveDish(dish, entry)
    for (const line of saucePackLine(resolved, hidden)) {
      map.set(line.key, line)
    }
    for (const ing of resolved.ingredients) {
      if (hidden.has(ing.itemId)) continue
      if (isSauceIngredient(ing)) continue
      const key = lineKey(ing.itemId, ing.quantity.unit, ing.kind)
      const contribution: Contribution = {
        dishId: dish.id,
        dishName: dish.name,
        quantity: ing.quantity,
      }
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          itemId: ing.itemId,
          name: ing.name,
          aisle: ing.aisle,
          kind: ing.kind,
          quantity: { ...ing.quantity },
          contributions: [contribution],
        })
      } else {
        existing.quantity = addQty(existing.quantity, ing.quantity)
        existing.contributions.push(contribution)
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const aisle = AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle)
    if (aisle !== 0) return aisle
    if (a.kind !== b.kind) {
      const order = { fresh: 0, 'sauce-pack': 1, pantry: 2 }
      return order[a.kind] - order[b.kind]
    }
    return a.name.localeCompare(b.name)
  })
}

export function groceryByAisle(lines: GroceryLine[]): { aisle: GroceryLine['aisle']; lines: GroceryLine[] }[] {
  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    lines: lines.filter((l) => l.aisle === aisle),
  }))
  return groups.filter((g) => g.lines.length > 0)
}

export function groupByDish(dishes: Dish[], plan: WeekPlan, hidePantry = true): DishGroup[] {
  const hidden = new Set(hidePantry ? plan.hiddenItemIds : [])
  const byDish = new Map(dishes.map((d) => [d.id, d]))
  const groups: DishGroup[] = []

  for (const entry of plan.entries) {
    const dish = byDish.get(entry.dishId)
    if (!dish) continue
    const resolved = resolveDish(dish, entry)
    const protein = dish.proteinOptions.find(
      (p) => p.id === (entry.proteinId ?? dish.defaultProteinId),
    )
    const lines: GroceryLine[] = [
      ...resolved.ingredients
        .filter((ing) => !hidden.has(ing.itemId) && !isSauceIngredient(ing))
        .map((ing) => ({
          key: `${dish.id}:${ing.itemId}:${ing.quantity.unit ?? 'none'}:${ing.kind}`,
          itemId: ing.itemId,
          name: ing.name,
          aisle: ing.aisle,
          kind: ing.kind,
          quantity: ing.quantity,
          contributions: [{ dishId: dish.id, dishName: dish.name, quantity: ing.quantity }],
        })),
      ...saucePackLine(resolved, hidden),
    ].sort((a, b) => {
        const order = { fresh: 0, 'sauce-pack': 1, pantry: 2 }
        if (a.kind !== b.kind) return order[a.kind] - order[b.kind]
        const aisle = AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle)
        if (aisle !== 0) return aisle
        return a.name.localeCompare(b.name)
      })

    groups.push({
      dishId: dish.id,
      dishName: dish.name,
      portions: entry.portions,
      time: dish.time,
      calories: dish.calories,
      thumb: dish.thumb,
      proteinLabel: protein?.label ?? null,
      lines,
      sauces: resolved.sauces,
    })
  }

  return groups
}

export function splitByIngredient(dishes: Dish[], plan: WeekPlan): SplitGroup[] {
  const lines = tallyGrocery(dishes, { ...plan, hiddenItemIds: [] })
  return lines.map((line) => ({
    itemId: line.itemId,
    name: line.name,
    aisle: line.aisle,
    kind: line.kind,
    total: line.quantity,
    allocations: line.contributions,
  }))
}

export function emptyPlan(): WeekPlan {
  return { schemaVersion: 1, entries: [], hiddenItemIds: [], checkedKeys: [] }
}
