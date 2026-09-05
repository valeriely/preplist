import { describe, expect, it } from 'vitest'
import dishesJson from '../data/dishes.json'
import type { Dish } from '../types'
import { archetypeFor, cookSteps, rolesFor, saucePlan } from './cookPlan'
import { methodFromEquipment } from './parseIngredients'
import { resolveDish } from './tally'

const dishes = dishesJson as Dish[]
const byName = (name: string) => {
  const dish = dishes.find((d) => d.name === name)
  if (!dish) throw new Error(`missing dish ${name}`)
  return dish
}
const forTwo = (name: string) => {
  const dish = byName(name)
  return resolveDish(dish, { dishId: dish.id, portions: 2, proteinId: dish.defaultProteinId })
}
const titles = (dish: Dish) => cookSteps(dish).map((s) => s.title)
const detail = (dish: Dish, title: string) =>
  cookSteps(dish).find((s) => s.title === title)?.detail ?? ''

describe('methodFromEquipment', () => {
  it('maps the messy equipment strings to a cook method', () => {
    expect(methodFromEquipment('Pan')).toBe('pan')
    expect(methodFromEquipment('Pan with a lid')).toBe('pan')
    expect(methodFromEquipment('Pot')).toBe('pot')
    expect(methodFromEquipment('Oven')).toBe('oven')
    expect(methodFromEquipment('Oven and Pan')).toBe('oven-pan')
    expect(methodFromEquipment('Pan or Pot')).toBe('pan-pot')
    expect(methodFromEquipment('Steamer & Pan')).toBe('steamer-pan')
    expect(methodFromEquipment('Pan + Air Fryer')).toBe('air-fryer')
    expect(methodFromEquipment('')).toBe('pan')
  })
})

describe('rolesFor', () => {
  it('sorts ingredients into cooking roles', () => {
    const roles = rolesFor(byName('Acqua Pazza Chicken'))
    expect(roles.protein?.itemId).toBe('chicken-thigh')
    expect(roles.aromatics.map((i) => i.itemId)).toContain('garlic')
    expect(roles.quickVeg.map((i) => i.itemId)).toContain('zucchini')
  })

  it('handles a dish with no protein', () => {
    const roles = rolesFor(byName('Easy Peasy Bok Choi'))
    expect(roles.protein).toBeNull()
    expect(roles.leafy.length + roles.quickVeg.length).toBeGreaterThan(0)
  })

  it('leaves tofu to the meat when the kit has both', () => {
    const roles = rolesFor(byName('Mapo Tofu'))
    expect(roles.protein?.name).toMatch(/pork|chicken/i)
  })
})

describe('sauce accounting', () => {
  it('never spends one pack twice', () => {
    // The reported bug: a single 120ml pack was used to marinate and then
    // poured in again as the sauce.
    for (const dish of dishes) {
      const resolved = resolveDish(dish, {
        dishId: dish.id,
        portions: 2,
        proteinId: dish.defaultProteinId,
      })
      const steps = cookSteps(resolved)
      for (const pack of resolved.sauces) {
        if (pack.quantity.amount == null) continue
        const full = `(${pack.quantity.raw})`
        const mentions = steps.filter((s) => s.detail.includes(full))
        expect(mentions.length, `${dish.name} restates ${full}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('divides a combined sauce/marinade pack into two amounts that add up', () => {
    const plan = saucePlan(forTwo('Assam Curry Chicken'))
    expect(plan.split).toBe(true)
    expect(plan.marinade?.ref).toContain('45g')
    expect(plan.finish?.ref).toContain('85g')
  })

  it('treats a sauce-only pack as a finishing sauce, not a marinade', () => {
    const plan = saucePlan(byName('Black Pepper Beef'))
    expect(plan.marinade).toBeNull()
    expect(plan.finish?.ref).toContain('60ml')
  })

  it('keeps a marinade-only pack on the protein and deglazes instead', () => {
    const plan = saucePlan(byName('Steamed Kabocha Chicken'))
    expect(plan.marinade).not.toBeNull()
    expect(plan.finish).toBeNull()
  })

  it('uses each of two separate packs for its own job', () => {
    const plan = saucePlan(byName('Miso Gindara Cod'))
    expect(plan.marinade?.pack.label).toMatch(/marinade/i)
    expect(plan.finish?.pack.label).toMatch(/sauce/i)
    expect(plan.marinade?.pack).not.toBe(plan.finish?.pack)
  })
})

describe('archetypeFor', () => {
  it('recognises the technique behind the dish', () => {
    expect(archetypeFor(byName('Black Pepper Beef'))).toBe('stir-fry')
    expect(archetypeFor(byName('Assam Curry Chicken'))).toBe('curry-paste')
    expect(archetypeFor(byName('Kansai Style Gyudon'))).toBe('donburi-simmer')
    expect(archetypeFor(byName('Nam Tok (Waterfall Steak Salad)'))).toBe('salad-dressing')
    expect(archetypeFor(byName('Tom Yum Chicken Fried Rice'))).toBe('fried-rice')
    expect(archetypeFor(byName('Calabrese Pasta'))).toBe('noodle-pasta')
    expect(archetypeFor(byName('Dak-Galbi (Spicy Chicken)'))).toBe('korean-grill')
  })
})

describe('cookSteps', () => {
  it('sears, sauces and finishes a stir-fry without marinating in the sauce', () => {
    const dish = forTwo('Black Pepper Beef')
    const list = titles(dish)
    expect(list).not.toContain('Marinate')
    expect(list).toContain('Sear hot and fast')
    expect(list[list.length - 1]).toBe('Finish')
    expect(detail(dish, 'Back in with the sauce')).toContain('120ml')
  })

  it('blooms the spice paste rather than only marinating with it', () => {
    const dish = forTwo('Assam Curry Chicken')
    expect(titles(dish)).toContain('Fry the paste')
    expect(detail(dish, 'Fry the paste')).toMatch(/oil separates/)
  })

  it('fries the paste off the protein when the whole pack was a marinade', () => {
    const dish = forTwo('Kale + Chicken Lemak')
    expect(titles(dish)).toContain('Fry off the paste')
    expect(titles(dish)).not.toContain('Fry the paste')
  })

  it('simmers a donburi instead of marinating and searing', () => {
    const list = titles(forTwo('Kansai Style Gyudon'))
    expect(list).toContain('Start the broth')
    expect(list).not.toContain('Marinate')
    expect(list).not.toContain('Sear hot and fast')
  })

  it('keeps a fresh dressing off the heat', () => {
    const dish = forTwo('Nam Tok (Waterfall Steak Salad)')
    expect(detail(dish, 'Dress off the heat')).toMatch(/never cook this dressing/i)
  })

  it('rests meat before slicing it for a salad', () => {
    const list = titles(forTwo('Nam Tok (Waterfall Steak Salad)'))
    expect(list.indexOf('Rest, then slice')).toBeGreaterThan(list.indexOf('Sear it hard'))
  })

  it('adds tofu gently instead of tossing it with the vegetables', () => {
    expect(detail(forTwo('Mapo Tofu'), 'Tofu in gently')).toMatch(/breaks up/)
  })

  it('preheats before roasting', () => {
    const list = titles(forTwo('Chipotle Peri Peri Chicken and Veggies'))
    expect(list.indexOf('Preheat')).toBeLessThan(list.indexOf('Roast'))
  })

  it('scales the quantities named in the steps with portions', () => {
    const marinate = detail(forTwo('Acqua Pazza Chicken'), 'Marinate')
    expect(marinate).toContain('400g')
    expect(marinate).toContain('280ml')
  })

  it('never talks about ingredients the kit does not include', () => {
    for (const dish of dishes) {
      const steps = cookSteps(dish)
      for (const step of steps) {
        expect(step.detail, dish.name).not.toContain('the main ingredient')
        if (!rolesFor(dish).protein) {
          expect(step.detail, dish.name).not.toMatch(/push the protein|the bird|sliced meat/i)
        }
      }
    }
  })

  it('produces usable steps for every dish in the catalogue', () => {
    for (const dish of dishes) {
      const steps = cookSteps(dish)
      expect(steps.length, dish.name).toBeGreaterThanOrEqual(3)
      for (const step of steps) {
        expect(step.title.length, dish.name).toBeGreaterThan(0)
        expect(step.detail.length, dish.name).toBeGreaterThan(10)
        expect(step.detail, dish.name).not.toContain('undefined')
        expect(step.detail, dish.name).not.toContain('NaN')
        expect(step.detail, dish.name).toMatch(/^[A-Z]/)
      }
    }
  })
})
