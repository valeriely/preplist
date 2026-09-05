import { describe, expect, it } from 'vitest'
import type { Dish, WeekPlan } from '../types'
import { inferServingsBase, parseIngredientBlock, parseOptions } from './parseIngredients'
import { defaultProteinId } from './normalize'
import { groupByDish, resolveDish, splitByIngredient, tallyGrocery } from './tally'

const acquaBlock = `Ingredients
Chicken Thighs: 200g
Zucchini: 40g
Onions: 30g
Garlic: 5g

Sauce/Marinade: 140ml
Water, Cashew butter, Cornstarch, Coarse sea salt, Smoked paprika`

const ajiBlock = `Chicken Thighs: 150g
Butternut Squash: 50g
Yellow Onions: 50g

Marinade/Sauce: 50ml
Aji Amarillo, Dehydrated Coconut Cream, Brown Sugar`

function dish(id: string, name: string, block: string, extra: Partial<Dish> = {}): Dish {
  const { ingredients, sauces } = parseIngredientBlock(block)
  const proteinOptions = parseOptions('Cut: Chicken Thigh / Chicken Breast')
  return {
    id,
    name,
    source: 'kit',
    servingsBase: 1,
    time: '10 minutes',
    timeMinutes: 10,
    calories: '400kcal',
    caloriesKcal: 400,
    equipment: 'Pan',
    method: 'pan',
    effortHats: 1,
    spice: 'No Spice (0 chilli)',
    chillis: 0,
    allergy: '',
    url: '',
    image: null,
    thumb: null,
    proteinTag: 'chicken',
    description: '',
    proteinOptions,
    defaultProteinId: defaultProteinId(proteinOptions),
    ingredients,
    sauces,
    ...extra,
  }
}

describe('parseIngredientBlock', () => {
  it('parses weighed lines and expands sauce components', () => {
    const { ingredients, sauces } = parseIngredientBlock(acquaBlock)
    const chicken = ingredients.find((i) => i.itemId === 'chicken-thigh')
    expect(chicken?.quantity.amount).toBe(200)
    expect(chicken?.quantity.unit).toBe('g')
    expect(sauces).toHaveLength(1)
    expect(sauces[0].quantity.amount).toBe(140)
    expect(sauces[0].components.map((c) => c.itemId)).toContain('cashew-butter')
    expect(ingredients.some((i) => i.kind === 'pantry' && i.itemId === 'cashew-butter')).toBe(true)
  })

  it('keeps onion types on different ids', () => {
    const mixed = parseIngredientBlock('Onions: 30g\nYellow Onions: 50g\nRed Onions: 25g')
    const ids = mixed.ingredients.map((i) => i.itemId)
    expect(ids).toContain('onion')
    expect(ids).toContain('yellow-onion')
    expect(ids).toContain('red-onion')
  })
})

describe('inferServingsBase', () => {
  it('defaults to 1 and reads Serves 2 / feeds N', () => {
    expect(inferServingsBase('Acqua Pazza Chicken', 'A kit', '409kcal')).toBe(1)
    expect(inferServingsBase("Mum's Style Chicken Cabbage Braise (Serves 2)", '', '')).toBe(2)
    expect(inferServingsBase('Braised Stuffed Eggplants', 'Feeds 4 pax', '')).toBe(4)
  })
})

describe('tally + scale', () => {
  const acqua = dish('acqua', 'Acqua Pazza Chicken', acquaBlock)
  const aji = dish('aji', 'Aji Coconut Chicken Stew', ajiBlock)

  it('adds thigh grams across dishes and keeps yellow onion separate', () => {
    const plan: WeekPlan = {
      schemaVersion: 1,
      entries: [
        { dishId: 'acqua', portions: 2, proteinId: 'chicken-thigh' },
        { dishId: 'aji', portions: 2, proteinId: 'chicken-thigh' },
      ],
      hiddenItemIds: [],
      checkedKeys: [],
    }
    const lines = tallyGrocery([acqua, aji], plan)
    const thighs = lines.find((l) => l.itemId === 'chicken-thigh')
    expect(thighs?.quantity.amount).toBe(700)
    expect(thighs?.contributions).toHaveLength(2)
    expect(lines.find((l) => l.itemId === 'onion')?.quantity.amount).toBe(60)
    expect(lines.find((l) => l.itemId === 'yellow-onion')?.quantity.amount).toBe(100)
    expect(lines.find((l) => l.itemId === 'cashew-butter')).toBeTruthy()
  })

  it('does not merge thigh and breast', () => {
    const plan: WeekPlan = {
      schemaVersion: 1,
      entries: [
        { dishId: 'acqua', portions: 2, proteinId: 'chicken-thigh' },
        { dishId: 'aji', portions: 2, proteinId: 'chicken-breast' },
      ],
      hiddenItemIds: [],
      checkedKeys: [],
    }
    const lines = tallyGrocery([acqua, aji], plan)
    expect(lines.find((l) => l.itemId === 'chicken-thigh')?.quantity.amount).toBe(400)
    expect(lines.find((l) => l.itemId === 'chicken-breast')?.quantity.amount).toBe(300)
  })

  it('does not double a Serves-2 dish planned for 2 pax', () => {
    const mums = dish('mums', "Mum's braise", 'Chicken: 240g\nCabbage: 180g', {
      servingsBase: 2,
      proteinOptions: [],
      defaultProteinId: null,
    })
    const resolved = resolveDish(mums, { dishId: 'mums', portions: 2, proteinId: null })
    const chicken = resolved.ingredients.find((i) => i.itemId === 'chicken')
    expect(chicken?.quantity.amount).toBe(240)
  })

  it('hides pantry items marked as already owned', () => {
    const plan: WeekPlan = {
      schemaVersion: 1,
      entries: [{ dishId: 'acqua', portions: 1, proteinId: 'chicken-thigh' }],
      hiddenItemIds: ['cashew-butter', 'salt', 'sea-salt', 'water', 'cornstarch', 'smoked-paprika'],
      checkedKeys: [],
    }
    const lines = tallyGrocery([acqua], plan)
    expect(lines.find((l) => l.itemId === 'cashew-butter')).toBeUndefined()
    expect(lines.find((l) => l.itemId === 'chicken-thigh')).toBeTruthy()
  })

  it('groups the same week by dish without merging across dishes', () => {
    const plan: WeekPlan = {
      schemaVersion: 1,
      entries: [
        { dishId: 'acqua', portions: 2, proteinId: 'chicken-thigh' },
        { dishId: 'aji', portions: 2, proteinId: 'chicken-thigh' },
      ],
      hiddenItemIds: [],
      checkedKeys: [],
    }
    const groups = groupByDish([acqua, aji], plan)
    expect(groups.map((g) => g.dishName)).toEqual([
      'Acqua Pazza Chicken',
      'Aji Coconut Chicken Stew',
    ])
    const acquaChicken = groups[0].lines.find((l) => l.itemId === 'chicken-thigh')
    const ajiChicken = groups[1].lines.find((l) => l.itemId === 'chicken-thigh')
    expect(acquaChicken?.quantity.amount).toBe(400)
    expect(ajiChicken?.quantity.amount).toBe(300)
    expect(groups[0].sauces[0].quantity.amount).toBe(280)
  })

  it('splits a tallied item back into per-dish allocations', () => {
    const plan: WeekPlan = {
      schemaVersion: 1,
      entries: [
        { dishId: 'acqua', portions: 2, proteinId: 'chicken-thigh' },
        { dishId: 'aji', portions: 2, proteinId: 'chicken-thigh' },
      ],
      hiddenItemIds: [],
      checkedKeys: [],
    }
    const groups = splitByIngredient([acqua, aji], plan)
    const thighs = groups.find((g) => g.itemId === 'chicken-thigh')
    expect(thighs?.allocations.map((a) => a.quantity.amount).sort()).toEqual([300, 400])
  })
})
