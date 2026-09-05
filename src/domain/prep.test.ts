import { describe, expect, it } from 'vitest'
import dishesJson from '../data/dishes.json'
import type { Dish, PlanEntry } from '../types'
import { prepStations } from './prep'

const dishes = dishesJson as Dish[]
const byName = (name: string) => {
  const dish = dishes.find((d) => d.name === name)
  if (!dish) throw new Error(`missing dish ${name}`)
  return dish
}
const entry = (name: string, portions = 2): PlanEntry => {
  const dish = byName(name)
  return { dishId: dish.id, portions, proteinId: dish.defaultProteinId }
}
const station = (name: string, portions = 2) => prepStations(dishes, [entry(name, portions)])[0]

describe('prepStations', () => {
  it('segments a week as one station per meal', () => {
    const stations = prepStations(dishes, [
      entry('Acqua Pazza Chicken'),
      entry('Black Pepper Beef'),
    ])
    expect(stations.map((s) => s.dishName)).toEqual([
      'Acqua Pazza Chicken',
      'Black Pepper Beef',
    ])
  })

  it('pairs the meat with a split of the combined sauce/marinade pack', () => {
    const acqua = station('Acqua Pazza Chicken', 2)
    expect(acqua.marinade?.targetName).toMatch(/chicken/i)
    expect(acqua.marinade?.targetQty.amount).toBe(400)
    expect(acqua.marinade?.split).toBe(true)
    expect(acqua.marinade?.used.amount).toBe(95)
    expect(acqua.marinade?.total.amount).toBe(280)
    expect(acqua.marinade?.reserve?.amount).toBe(185)
    expect(acqua.marinade?.components).toContain('Cashew butter')
    expect(acqua.cookWith).toBeNull()
    expect(acqua.bag.some((line) => /zucchini/i.test(line.name))).toBe(true)
    expect(acqua.bag.some((line) => /chicken/i.test(line.name))).toBe(false)
  })

  it('does not treat a stir-fry sauce as a marinade', () => {
    const beef = station('Black Pepper Beef')
    expect(beef.marinade).toBeNull()
    expect(beef.protein?.name).toMatch(/beef/i)
    expect(beef.protein?.quantity.amount).toBe(240)
    expect(beef.skipNote).toMatch(/don't marinate/i)
    expect(beef.cookWith?.label).toMatch(/sauce/i)
    expect(beef.cookWith?.used.amount).toBe(120)
  })

  it('keeps a donburi broth for the pot, not a bag', () => {
    const gyudon = station('Kansai Style Gyudon')
    expect(gyudon.marinade).toBeNull()
    expect(gyudon.skipNote).toMatch(/don't marinate/i)
    expect(gyudon.protein).not.toBeNull()
  })

  it('uses each of two packs for its own job', () => {
    const cod = station('Miso Gindara Cod')
    expect(cod.marinade?.label).toMatch(/marinade/i)
    expect(cod.marinade?.targetName).toMatch(/gindara/i)
    expect(cod.cookWith?.label).toMatch(/sauce/i)
    expect(cod.skipNote).toBeNull()
  })

  it('still lists vegetables on a dish with no protein', () => {
    const greens = station('Easy Peasy Bok Choi')
    expect(greens.protein).toBeNull()
    expect(greens.marinade).toBeNull()
    expect(greens.bag.length).toBeGreaterThan(0)
    expect(greens.skipNote).toBeTruthy()
  })
})
