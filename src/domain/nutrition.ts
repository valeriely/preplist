import type { Dish } from '../types'

function servings(dish: Dish): number {
  return dish.servingsBase > 0 ? dish.servingsBase : 1
}

/** Kit calories are for `servingsBase` pax. Most Prepped kits are 1. */
export function kcalPerPax(dish: Dish): number | null {
  if (dish.caloriesKcal == null) return null
  return Math.round(dish.caloriesKcal / servings(dish))
}

export function batchKcal(dish: Dish, portions: number): number | null {
  const per = kcalPerPax(dish)
  if (per == null) return null
  return per * Math.max(1, portions)
}

export interface CookedPortion {
  kcalPerPax: number | null
  batchKcal: number | null
  cookedGrams: number
  gramsPerPax: number
}

/** After you weigh the finished pot, 1 pax is an equal slice of that weight. */
export function cookedPortion(
  dish: Dish,
  portions: number,
  cookedGrams: number,
): CookedPortion | null {
  if (!Number.isFinite(cookedGrams) || cookedGrams <= 0) return null
  const pax = Math.max(1, portions)
  return {
    kcalPerPax: kcalPerPax(dish),
    batchKcal: batchKcal(dish, pax),
    cookedGrams,
    gramsPerPax: Math.round(cookedGrams / pax),
  }
}

export function parseCookedGrams(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}
