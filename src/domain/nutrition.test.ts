import { describe, expect, it } from 'vitest'
import type { Dish } from '../types'
import { batchKcal, cookedPortion, kcalPerPax, parseCookedGrams } from './nutrition'

function dish(kcal: number | null, servingsBase = 1): Dish {
  return {
    id: 'test',
    name: 'Test',
    source: 'kit',
    servingsBase,
    time: '',
    timeMinutes: null,
    calories: kcal != null ? `${kcal}kcal` : '',
    caloriesKcal: kcal,
    equipment: 'Pan',
    method: 'pan',
    effortHats: null,
    spice: '',
    chillis: null,
    allergy: '',
    url: '',
    image: null,
    thumb: null,
    proteinTag: 'chicken',
    description: '',
    proteinOptions: [],
    defaultProteinId: null,
    ingredients: [],
    sauces: [],
  }
}

describe('kcalPerPax', () => {
  it('treats a normal kit figure as one person', () => {
    expect(kcalPerPax(dish(409))).toBe(409)
  })

  it('splits a serves-2 kit', () => {
    expect(kcalPerPax(dish(768, 2))).toBe(384)
  })

  it('returns null when the kit has no figure', () => {
    expect(kcalPerPax(dish(null))).toBeNull()
  })
})

describe('batchKcal', () => {
  it('scales 1-pax calories by the planned portions', () => {
    expect(batchKcal(dish(400), 2)).toBe(800)
  })

  it('does not double a serves-2 kit planned for 2', () => {
    expect(batchKcal(dish(768, 2), 2)).toBe(768)
  })
})

describe('cookedPortion', () => {
  it('divides the pot so 1 pax is weight and calories', () => {
    const portion = cookedPortion(dish(400), 2, 640)
    expect(portion).toEqual({
      kcalPerPax: 400,
      batchKcal: 800,
      cookedGrams: 640,
      gramsPerPax: 320,
    })
  })

  it('still yields grams per pax when calories are missing', () => {
    const portion = cookedPortion(dish(null), 2, 500)
    expect(portion?.gramsPerPax).toBe(250)
    expect(portion?.kcalPerPax).toBeNull()
  })

  it('rejects empty or negative weighs', () => {
    expect(cookedPortion(dish(400), 2, 0)).toBeNull()
    expect(cookedPortion(dish(400), 2, -10)).toBeNull()
  })
})

describe('parseCookedGrams', () => {
  it('reads a kitchen-scale number and clears blanks', () => {
    expect(parseCookedGrams('640')).toBe(640)
    expect(parseCookedGrams('640.4')).toBe(640)
    expect(parseCookedGrams('')).toBeNull()
    expect(parseCookedGrams('nope')).toBeNull()
  })
})
