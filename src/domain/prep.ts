import type { Dish, PlanEntry, Quantity } from '../types'
import { rolesFor, saucePlan, wantsMarinadeFor } from './cookPlan'
import { resolveDish } from './tally'

export interface PrepLine {
  name: string
  quantity: Quantity
}

export interface PrepPack {
  label: string
  used: Quantity
  total: Quantity
  components: string[]
}

export interface PrepMarinade extends PrepPack {
  targetName: string
  targetQty: Quantity
  split: boolean
  reserve: Quantity | null
}

export interface PrepStation {
  dishId: string
  dishName: string
  portions: number
  time: string
  calories: string
  thumb: string | null
  protein: PrepLine | null
  marinade: PrepMarinade | null
  skipNote: string | null
  cookWith: PrepPack | null
  bag: PrepLine[]
}

function packView(pack: { pack: { label: string; quantity: Quantity; components: { name: string }[] }; used: Quantity }): PrepPack {
  return {
    label: pack.pack.label,
    used: pack.used,
    total: pack.pack.quantity,
    components: pack.pack.components.map((c) => c.name),
  }
}

export function prepStations(dishes: Dish[], entries: PlanEntry[]): PrepStation[] {
  const byId = new Map(dishes.map((d) => [d.id, d]))
  const stations: PrepStation[] = []

  for (const entry of entries) {
    const dish = byId.get(entry.dishId)
    if (!dish) continue
    const resolved = resolveDish(dish, entry)
    const roles = rolesFor(resolved)
    const plan = saucePlan(resolved, wantsMarinadeFor(resolved))
    const protein = roles.protein
      ? { name: roles.protein.name, quantity: roles.protein.quantity }
      : null

    const bag = resolved.ingredients
      .filter((ing) => ing.kind === 'fresh' && (!protein || ing.itemId !== roles.protein?.itemId))
      .map((ing) => ({ name: ing.name, quantity: ing.quantity }))

    const target =
      roles.protein ?? [...roles.hardVeg, ...roles.quickVeg, ...roles.leafy][0] ?? null

    const marinade: PrepMarinade | null =
      plan.marinade && target
        ? {
            ...packView(plan.marinade),
            targetName: target.name,
            targetQty: target.quantity,
            split: plan.split,
            reserve: plan.split && plan.finish ? plan.finish.used : null,
          }
        : null

    const separateFinish =
      plan.finish && (!plan.marinade || plan.finish.pack.id !== plan.marinade.pack.id)
    const cookWith = separateFinish && plan.finish ? packView(plan.finish) : null

    const skipNote = marinade
      ? null
      : cookWith
        ? `Don't marinate. The ${cookWith.label.toLowerCase()} goes in while you cook.`
        : plan.finish
          ? `Don't marinate. The ${plan.finish.pack.label.toLowerCase()} goes in while you cook.`
          : 'No marinade pack in this kit — follow the card when you cook.'

    stations.push({
      dishId: dish.id,
      dishName: dish.name,
      portions: entry.portions,
      time: dish.time,
      calories: dish.calories,
      thumb: dish.thumb,
      protein,
      marinade,
      skipNote,
      cookWith,
      bag,
    })
  }

  return stations
}
