import type { CookStep, Dish, DishIngredient, Quantity, SaucePack } from '../types'
import { formatQuantity, roundQty } from './tally'

/**
 * Prepped does not publish its cooking steps online, so these methods are
 * derived from the kit's equipment, timing, ingredient roles and sauce make-up,
 * matched against how the dish is conventionally cooked. The printed recipe
 * card in the box stays the source of truth.
 *
 * Two rules hold everywhere:
 *  - Only the kit's own ingredients are used; nothing is invented.
 *  - A sauce pack is spent once. If one pack has to both marinate and sauce,
 *    the steps split that single amount instead of spending it twice.
 */

export interface Roles {
  protein: DishIngredient | null
  aromatics: DishIngredient[]
  hardVeg: DishIngredient[]
  quickVeg: DishIngredient[]
  leafy: DishIngredient[]
  garnish: DishIngredient[]
  carbs: DishIngredient[]
  marinade: SaucePack | null
  sauce: SaucePack | null
}

const AROMATIC =
  /garlic|ginger|shallot|onion|scallion|lemongrass|galangal|chilli|chili|curry leaf|curry leaves|lime leaf|lime leaves|banana leaf|banana leaves|pandan|turmeric|peppercorn|candlenut/i
const HARD =
  /carrot|potato|squash|pumpkin|kabocha|taro|corn|beet|cauliflower|broccoli|burdock|lotus|chayote|radish|eggplant|bamboo|turnip|parsnip|yam|winter melon|gourd|lily bulb|ginko|water chestnut|artichoke/i
const LEAFY =
  /bok choi|bok choy|spinach|kale|kailan|kai lan|yau mak|lettuce|mustard green|watercress|sprout|cabbage heart|chye sim|napa|greens|garlic shoot|perilla/i
const GARNISH =
  /cilantro|coriander|mint|thai basil|basil|sesame seed|seaweed|lime|lemon|parsley|dill|thyme|rosemary|spring onion|scallion|peanut|cashew|pine nut|feta|parmesan|halloumi|wolf berr|red date/i
const CARB =
  /^rice$|^rice:|noodle|tortilla|pasta|wrapper|pancake|rice cake|somen|cellophane|japchae|bread|bun|couscous/i

export function rolesFor(dish: Dish): Roles {
  const fresh = dish.ingredients.filter((i) => i.kind === 'fresh')
  const roles: Roles = {
    protein: fresh.find((i) => i.isProteinSlot) ?? null,
    aromatics: [],
    hardVeg: [],
    quickVeg: [],
    leafy: [],
    garnish: [],
    carbs: [],
    marinade: null,
    sauce: null,
  }

  for (const ing of fresh) {
    if (ing.isProteinSlot) continue
    const name = ing.name
    if (CARB.test(name)) roles.carbs.push(ing)
    else if (AROMATIC.test(name)) roles.aromatics.push(ing)
    else if (LEAFY.test(name)) roles.leafy.push(ing)
    else if (GARNISH.test(name)) roles.garnish.push(ing)
    else if (HARD.test(name)) roles.hardVeg.push(ing)
    else roles.quickVeg.push(ing)
  }

  const plan = saucePlan(dish)
  roles.marinade = plan.marinade?.pack ?? null
  roles.sauce = plan.finish?.pack ?? null
  return roles
}

/* ------------------------------------------------------------------ *
 * Sauce accounting
 * ------------------------------------------------------------------ */

type PackKind = 'marinade' | 'sauce' | 'both'

function classifyPack(pack: SaucePack): PackKind {
  const label = pack.label.toLowerCase()
  const marinade = /marinade/.test(label)
  const sauce = /sauce/.test(label)
  if (marinade && sauce) return 'both'
  if (marinade) return 'marinade'
  return 'sauce'
}

interface PackUse {
  pack: SaucePack
  /** Text for referring to the amount used in this step. */
  ref: string
  /** How much of the pack this step actually spends. */
  used: Quantity
}

export interface SaucePlan {
  marinade: PackUse | null
  finish: PackUse | null
  /** True when one pack was divided between marinating and saucing. */
  split: boolean
}

function packName(pack: SaucePack): string {
  return pack.label.toLowerCase()
}

function fullRef(pack: SaucePack): string {
  const qty = pack.quantity.amount != null ? ` (${formatQuantity(pack.quantity)})` : ''
  return `the ${packName(pack)}${qty}`
}

function splitAmounts(pack: SaucePack): { marinade: Quantity; finish: Quantity } {
  const total = pack.quantity.amount
  const unit = pack.quantity.unit
  if (total == null) {
    return {
      marinade: { amount: null, unit, raw: 'about a third' },
      finish: { amount: null, unit, raw: 'the rest' },
    }
  }
  // Kitchen-friendly numbers: nobody measures 43.3g out of a sachet.
  const raw = total / 3
  const part = total >= 45 ? Math.round(raw / 5) * 5 : roundQty(raw)
  const rest = roundQty(total - part)
  const marinade: Quantity = { amount: part, unit, raw: '' }
  marinade.raw = formatQuantity(marinade)
  const finish: Quantity = { amount: rest, unit, raw: '' }
  finish.raw = formatQuantity(finish)
  return { marinade, finish }
}

function splitRefs(pack: SaucePack): { marinade: string; finish: string } {
  const total = pack.quantity.amount
  const unit = pack.quantity.unit
  if (total == null || !unit) {
    return {
      marinade: `about a third of the ${packName(pack)}`,
      finish: `the rest of the ${packName(pack)}`,
    }
  }
  const { marinade, finish } = splitAmounts(pack)
  return {
    marinade: `about ${marinade.amount}${unit} of the ${formatQuantity(pack.quantity)} ${packName(pack)}`,
    finish: `the remaining ~${finish.amount}${unit} of ${packName(pack)}`,
  }
}

function packUse(pack: SaucePack, ref: string, used: Quantity = pack.quantity): PackUse {
  return { pack, ref, used: { ...used } }
}

/**
 * Decides how the kit's sauce pack(s) get used. `wantsMarinade` lets a
 * technique opt out of marinating (a stir-fry sauce or donburi broth is not a
 * marinade) or opt in (a rempah gets divided).
 */
export function saucePlan(dish: Dish, wantsMarinade = true): SaucePlan {
  const packs = dish.sauces
  if (packs.length === 0) return { marinade: null, finish: null, split: false }

  if (packs.length >= 2) {
    const marinadePack =
      packs.find((p) => classifyPack(p) === 'marinade') ??
      packs.find((p) => classifyPack(p) === 'both') ??
      null
    const finishPack = packs.find((p) => p !== marinadePack) ?? null
    return {
      marinade:
        wantsMarinade && marinadePack ? packUse(marinadePack, fullRef(marinadePack)) : null,
      finish: finishPack ? packUse(finishPack, fullRef(finishPack)) : null,
      split: false,
    }
  }

  const pack = packs[0]
  const kind = classifyPack(pack)

  if (kind === 'marinade') {
    // Everything goes on the protein; nothing is left to pour in later.
    return { marinade: packUse(pack, fullRef(pack)), finish: null, split: false }
  }
  if (kind === 'sauce' || !wantsMarinade) {
    // A stir-fry / braising sauce is added while cooking, not used to marinate.
    return { marinade: null, finish: packUse(pack, fullRef(pack)), split: false }
  }

  const refs = splitRefs(pack)
  const amounts = splitAmounts(pack)
  return {
    marinade: packUse(pack, refs.marinade, amounts.marinade),
    finish: packUse(pack, refs.finish, amounts.finish),
    split: true,
  }
}

/** Techniques that flavour in the pan or pot, not in a bag beforehand. */
export function wantsMarinadeFor(dish: Dish): boolean {
  const archetype = archetypeFor(dish)
  return (
    archetype !== 'donburi-simmer' &&
    archetype !== 'soup' &&
    archetype !== 'noodle-pasta' &&
    archetype !== 'saute-veg'
  )
}

/* ------------------------------------------------------------------ *
 * Technique detection
 * ------------------------------------------------------------------ */

export type Archetype =
  | 'fried-rice'
  | 'noodle-pasta'
  | 'curry-paste'
  | 'donburi-simmer'
  | 'korean-grill'
  | 'salad-dressing'
  | 'wrap'
  | 'soup'
  | 'steam-fish'
  | 'miso-grill'
  | 'roast-whole'
  | 'skewer'
  | 'stir-fry'
  | 'braise'
  | 'tray-roast'
  | 'saute-veg'

function sauceText(dish: Dish): string {
  return dish.sauces
    .flatMap((s) => s.components.map((c) => c.name))
    .join(', ')
    .toLowerCase()
}

export function archetypeFor(dish: Dish): Archetype {
  const name = dish.name.toLowerCase()
  const blurb = `${name} ${dish.description.toLowerCase()}`
  const sauce = sauceText(dish)
  const roles = rolesFor(dish)
  const ingredients = dish.ingredients.map((i) => i.name.toLowerCase()).join(', ')
  const hasProtein = roles.protein != null

  if (/fried rice/.test(name)) return 'fried-rice'
  if (/aglio|pasta|japchae|noodle|somen|cellophane|spaghetti/.test(name)) return 'noodle-pasta'
  if (/tortilla|wrap/.test(ingredients) && /fajita|taco|quesadilla|shawarma|lahm/.test(blurb))
    return 'wrap'
  if (hasProtein && /gyudon|sukiyaki|donburi|oyakodon/.test(blurb)) return 'donburi-simmer'
  if (hasProtein && /bulgogi|galbi|dak-galbi|dak galbi/.test(name)) return 'korean-grill'
  if (/larb|nam tok|salad/.test(name) && roles.leafy.length + roles.garnish.length > 0)
    return 'salad-dressing'
  if (dish.method === 'steamer' || dish.method === 'steamer-pan') return 'steam-fish'
  if (hasProtein && /miso/.test(sauce) && (dish.method === 'oven' || dish.method === 'oven-pan'))
    return 'miso-grill'
  if (/skewer/.test(ingredients) || /yakitori|skewer|satay/.test(name)) return 'skewer'
  if (
    /soup|tonjiru|guk\b|miyeokguk|broth|chye|consomme/.test(name) &&
    (dish.method === 'pot' || dish.method === 'pan-pot')
  )
    return 'soup'
  if (
    /candlenut|galangal|belacan|rempah|tamarind|turmeric|curry|aji amarillo|harissa|assam/.test(
      sauce,
    ) ||
    /curry|lemak|assam|rendang|sambal|tikka|masala|jerk/.test(name)
  )
    return 'curry-paste'
  if (/~?\d+(\.\d+)?\s*kg/i.test(roles.protein?.quantity.raw ?? '') && dish.method === 'oven')
    return 'roast-whole'
  if (dish.method === 'oven' || dish.method === 'oven-pan' || dish.method === 'air-fryer')
    return 'tray-roast'
  if (dish.method === 'pot') return hasProtein ? 'braise' : 'saute-veg'
  return hasProtein ? 'stir-fry' : 'saute-veg'
}

/* ------------------------------------------------------------------ *
 * Step helpers
 * ------------------------------------------------------------------ */

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function names(list: DishIngredient[]): string {
  const parts = list.map((i) => i.name.toLowerCase())
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function withQty(ing: DishIngredient): string {
  const qty = formatQuantity(ing.quantity)
  return ing.quantity.amount != null ? `${ing.name.toLowerCase()} (${qty})` : ing.name.toLowerCase()
}

function share(total: number | null, fraction: number, min = 1): number | null {
  if (total == null) return null
  return Math.max(min, Math.round(total * fraction))
}

function isBrothy(ctx: Ctx): boolean {
  const pack = ctx.plan.finish?.pack
  if (!pack || pack.quantity.amount == null || pack.quantity.unit !== 'ml') return false
  const solids = ctx.dish.ingredients
    .filter((i) => i.kind === 'fresh' && i.quantity.unit === 'g')
    .reduce((sum, i) => sum + (i.quantity.amount ?? 0), 0)
  if (solids === 0) return pack.quantity.amount >= 200
  return pack.quantity.amount / solids >= 0.35
}

function thickens(plan: SaucePlan): boolean {
  const pack = plan.finish?.pack
  if (!pack) return false
  return pack.components.some((c) => /starch|flour/i.test(c.name))
}

function finishStep(roles: Roles, extra?: string, carbsUsed = false): CookStep {
  const bits: string[] = []
  if (roles.garnish.length) bits.push(`scatter ${names(roles.garnish)}`)
  if (roles.carbs.length && !carbsUsed) bits.push(`serve over ${names(roles.carbs)}`)
  const lead = bits.length ? `Off the heat, ${bits.join(', and ')}.` : 'Take it off the heat.'
  return {
    title: 'Finish',
    detail: `${lead} ${extra ?? 'Taste before it leaves the pan and serve straight away.'}`.trim(),
    minutes: null,
  }
}

function proteinName(roles: Roles): string {
  return roles.protein ? roles.protein.name.toLowerCase() : 'the main ingredient'
}

/* ------------------------------------------------------------------ *
 * Step builders
 * ------------------------------------------------------------------ */

interface Ctx {
  dish: Dish
  roles: Roles
  plan: SaucePlan
  total: number | null
  steps: CookStep[]
  /** Set when the carb is cooked into the dish, so "serve over rice" is wrong. */
  carbsUsed: boolean
}

function push(ctx: Ctx, step: CookStep | null) {
  if (step) ctx.steps.push(step)
}

function marinateStep(ctx: Ctx, minutes: number, note?: string): CookStep | null {
  const { plan, roles } = ctx
  if (!plan.marinade) return null
  const target = roles.protein
    ? withQty(roles.protein)
    : names([...roles.hardVeg, ...roles.quickVeg].slice(0, 3))
  if (!target) return null
  const reserve = plan.split
    ? ` Keep the rest aside — the kit only gives you one pack and the sauce needs it.`
    : ''
  return {
    title: roles.protein ? 'Marinate' : 'Season',
    detail: `Massage ${plan.marinade.ref} into ${target} and leave it ${minutes} minutes.${reserve}${
      note ? ` ${note}` : ''
    }`,
    minutes,
  }
}

function mepStep(ctx: Ctx): CookStep | null {
  const { roles } = ctx
  const line = [...roles.aromatics, ...roles.hardVeg, ...roles.quickVeg, ...roles.leafy]
  if (line.length < 3) return null
  return {
    title: 'Line up',
    detail: `Set ${names(
      line.slice(0, 6),
    )} within reach of the stove. Once the heat is on there is no time to chop.`,
    minutes: null,
  }
}

function aromaticStep(ctx: Ctx, minutes = 1, proteinInPan = true): CookStep | null {
  const { roles } = ctx
  if (roles.aromatics.length === 0) return null
  return {
    title: 'Aromatics',
    detail:
      roles.protein && proteinInPan
        ? `Push the protein to one side, add ${names(
            roles.aromatics,
          )} and stir until fragrant${burnWarning(roles.aromatics)}.`
        : `Add ${names(roles.aromatics)} to the hot oil and stir until fragrant${burnWarning(
            roles.aromatics,
          )}.`,
    minutes,
  }
}

function burnWarning(aromatics: DishIngredient[]): string {
  return aromatics.some((i) => /garlic/i.test(i.name)) ? ' — do not let the garlic brown' : ''
}

const TOFU = /tofu|tau kwa|beancurd|bean curd/i

function vegSteps(ctx: Ctx) {
  const { roles, total } = ctx
  if (roles.hardVeg.length) {
    push(ctx, {
      title: 'Firm vegetables first',
      detail: `Add ${names(roles.hardVeg)} — they take the longest, so give them a head start.`,
      minutes: share(total, 0.2, 2),
    })
  }
  const quick = roles.quickVeg.filter((i) => !TOFU.test(i.name))
  if (quick.length) {
    push(ctx, {
      title: 'Quick vegetables',
      detail: `Add ${names(quick)} and keep everything moving.`,
      minutes: share(total, 0.15, 1),
    })
  }
  const tofu = roles.quickVeg.filter((i) => TOFU.test(i.name))
  if (tofu.length) {
    push(ctx, {
      title: 'Tofu in gently',
      detail: `Slide ${names(
        tofu,
      )} in and stop tossing — push it around with the back of a spoon instead, or it breaks up into scraps.`,
      minutes: share(total, 0.15, 1),
    })
  }
}

function greensStep(ctx: Ctx): CookStep | null {
  const { roles } = ctx
  if (roles.leafy.length === 0) return null
  return {
    title: 'Greens last',
    detail: `Fold in ${names(roles.leafy)} for the final minute so they keep their bite.`,
    minutes: 1,
  }
}

/** Pan/pot sauce step that respects what is actually left in the pack. */
function sauceStep(ctx: Ctx, mode: 'reduce' | 'simmer' | 'poach', returning = false): CookStep {
  const { plan, total } = ctx
  const back = returning ? 'Return the protein to the pan, then ' : ''
  if (!plan.finish) {
    return {
      title: 'Deglaze',
      detail: cap(
        `${back}${
          returning ? 'add' : 'all of the marinade is already on the protein, so add'
        } a splash of water and scrape the sticky bits off the base — that is your sauce.`,
      ),
      minutes: share(total, 0.15, 1),
    }
  }
  const thickNote = thickens(plan)
    ? ' There is starch in it, so it will thicken quickly once it bubbles.'
    : ''
  if (mode === 'poach') {
    return {
      title: returning ? 'Back in, and reduce' : 'Reduce the sauce',
      detail: cap(
        `${back}pour in ${plan.finish.ref} and let it bubble away until it reduces to something that clings rather than pools. There is enough liquid here to braise in, so give it a few minutes rather than a few seconds.${thickNote}`,
      ),
      minutes: share(total, 0.35, 3),
    }
  }
  if (mode === 'simmer') {
    return {
      title: 'Simmer',
      detail: cap(
        `${back}add ${plan.finish.ref} plus enough water to almost cover, bring it to a simmer and put the lid on.${thickNote}`,
      ),
      minutes: share(total, 0.4, 3),
    }
  }
  return {
    title: returning ? 'Back in with the sauce' : 'Sauce it',
    detail: cap(
      `${back}pour ${plan.finish.ref} down the side of the hot pan and toss until it coats everything.${thickNote}`,
    ),
    minutes: share(total, 0.2, 1),
  }
}

/* ------------------------------------------------------------------ *
 * Archetype recipes
 * ------------------------------------------------------------------ */

function stirFry(ctx: Ctx) {
  const { roles, total } = ctx
  const veg = roles.aromatics.length + roles.hardVeg.length + roles.quickVeg.length
  // With vegetables to cook, the protein comes out of the pan and goes back at
  // the end. Leaving it in while everything else cooks is what turns it grey.
  const setAside = roles.protein != null && veg > 0

  push(ctx, marinateStep(ctx, 10, 'That short rest is enough for thin cuts.'))
  push(ctx, mepStep(ctx))
  if (roles.protein) {
    push(ctx, {
      title: 'Sear hot and fast',
      detail: `Get the pan properly hot with a little oil, spread ${proteinName(
        roles,
      )} in one layer and leave it to colour before turning. Crowding it steams the meat instead of searing it.${
        setAside
          ? ' Lift it out onto a plate while it is still a shade underdone — it goes back in at the end.'
          : ''
      }`,
      minutes: share(total, 0.3, 2),
    })
  }
  push(ctx, aromaticStep(ctx, 1, !setAside))
  vegSteps(ctx)
  push(ctx, sauceStep(ctx, isBrothy(ctx) ? 'poach' : 'reduce', setAside))
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function braise(ctx: Ctx) {
  const { roles, total } = ctx
  push(ctx, marinateStep(ctx, 15))
  push(ctx, mepStep(ctx))
  if (roles.protein) {
    push(ctx, {
      title: 'Brown the protein',
      detail: `Heat a little oil in the pot and brown ${proteinName(
        roles,
      )} on all sides. That colour is most of the flavour in a braise.`,
      minutes: share(total, 0.25, 2),
    })
  }
  push(ctx, aromaticStep(ctx))
  push(ctx, sauceStep(ctx, 'simmer'))
  if (roles.hardVeg.length) {
    push(ctx, {
      title: 'Add the firm vegetables',
      detail: `Drop in ${names(roles.hardVeg)} and let them cook in the liquid until tender.`,
      minutes: share(total, 0.3, 3),
    })
  }
  if (roles.quickVeg.length) {
    push(ctx, {
      title: 'Then the quick ones',
      detail: `Add ${names(roles.quickVeg)} near the end so they do not collapse.`,
      minutes: share(total, 0.15, 2),
    })
  }
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, 'Let it sit a minute off the heat; the sauce tightens as it cools.', ctx.carbsUsed))
}

function curryPaste(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(ctx, marinateStep(ctx, 15, 'This is the "seal it in" step — it flavours the meat itself.'))
  push(ctx, mepStep(ctx))
  if (plan.finish) {
    push(ctx, {
      title: 'Fry the paste',
      detail: `Heat a good slick of oil over medium and fry ${plan.finish.ref} until it darkens and smells nutty and the oil separates out. Rushing this leaves a raw, gritty curry.`,
      minutes: share(total, 0.25, 2),
    })
    if (roles.protein) {
      push(ctx, {
        title: 'Coat the protein',
        detail: `Add ${proteinName(roles)} and turn it through the paste until every piece is coated.`,
        minutes: share(total, 0.2, 2),
      })
    }
  } else if (roles.protein) {
    push(ctx, {
      title: 'Fry off the paste',
      detail: `Heat a good slick of oil over medium and tip in ${proteinName(
        roles,
      )} with all the paste still clinging to it. Fry until the paste darkens, smells nutty and the oil separates out — rushing this leaves a raw, gritty curry.`,
      minutes: share(total, 0.3, 3),
    })
  }
  if (roles.aromatics.length) {
    push(ctx, {
      title: 'Aromatics',
      detail: `Stir in ${names(roles.aromatics)}.`,
      minutes: 1,
    })
  }
  push(ctx, {
    title: 'Loosen and simmer',
    detail: `Add water a little at a time to reach the gravy consistency you want, then simmer so the flavours settle.${
      /coconut/i.test(sauceText(ctx.dish))
        ? ' Keep it at a gentle simmer once the coconut goes in so it does not split.'
        : ''
    }`,
    minutes: share(total, 0.35, 3),
  })
  if (roles.hardVeg.length) {
    push(ctx, {
      title: 'Vegetables in',
      detail: `Add ${names([...roles.hardVeg, ...roles.quickVeg])} and cook until just tender.`,
      minutes: share(total, 0.25, 2),
    })
  } else if (roles.quickVeg.length) {
    push(ctx, {
      title: 'Vegetables in',
      detail: `Add ${names(roles.quickVeg)} and cook briefly.`,
      minutes: share(total, 0.2, 2),
    })
  }
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function donburi(ctx: Ctx) {
  const { roles, plan, total } = ctx
  ctx.carbsUsed = true
  const onions = roles.aromatics.filter((i) => /onion/i.test(i.name))
  const rest = roles.aromatics.filter((i) => !/onion/i.test(i.name))
  push(ctx, {
    title: 'Start the broth',
    detail: `Bring ${
      plan.finish?.ref ?? 'the sauce'
    } and a splash of water to a simmer in a wide pan — this is a simmered bowl, not a stir-fry, so nothing needs marinating.`,
    minutes: share(total, 0.2, 1),
  })
  if (onions.length) {
    push(ctx, {
      title: 'Soften the onions',
      detail: `Lay ${names(onions)} in the liquid and let them go soft and sweet.`,
      minutes: share(total, 0.3, 2),
    })
  }
  if (roles.quickVeg.length) {
    push(ctx, {
      title: 'Mushrooms and veg',
      detail: `Add ${names(roles.quickVeg)} and let them take on the broth.`,
      minutes: share(total, 0.2, 1),
    })
  }
  if (roles.protein) {
    push(ctx, {
      title: 'Slip in the beef',
      detail: `Separate ${proteinName(
        roles,
      )} and lay it over the top. Thin slices need barely a minute — pull them as soon as they lose their red.`,
      minutes: share(total, 0.2, 1),
    })
  }
  push(ctx, {
    title: 'Build the bowl',
    detail: `Spoon everything over ${
      roles.carbs.length ? names(roles.carbs) : 'rice'
    } while it is hot, and ladle over enough broth to soak into the rice${
      rest.length ? `, then top with ${names(rest)}` : ''
    }${roles.garnish.length ? ` and ${names(roles.garnish)}` : ''}. That soaked rice is the point of a donburi.`,
    minutes: null,
  })
}

function koreanGrill(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(ctx, marinateStep(ctx, 20, 'The sugar in it is what gives you the char later.'))
  push(ctx, mepStep(ctx))
  push(ctx, {
    title: 'Hot pan, no crowding',
    detail: `Get the pan very hot with a little oil and lay ${proteinName(
      roles,
    )} out flat in batches. You want caramelised edges, so resist stirring.`,
    minutes: share(total, 0.35, 2),
  })
  if (roles.aromatics.length || roles.hardVeg.length || roles.quickVeg.length) {
    push(ctx, {
      title: 'Vegetables in',
      detail: `Add ${names([
        ...roles.aromatics,
        ...roles.hardVeg,
        ...roles.quickVeg,
      ])} and let them pick up the caramelised sauce in the pan.`,
      minutes: share(total, 0.3, 2),
    })
  }
  if (plan.finish) {
    push(ctx, {
      title: 'Glaze',
      detail: `Add ${plan.finish.ref} and let it reduce and cling. Watch it — the sugar catches fast.`,
      minutes: share(total, 0.2, 1),
    })
  } else {
    push(ctx, {
      title: 'Glaze',
      detail:
        'Add a small splash of water to lift the caramelised marinade off the pan and turn the meat through it.',
      minutes: 1,
    })
  }
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function saladDressing(ctx: Ctx) {
  const { dish, roles, plan, total } = ctx
  const oven = dish.method === 'oven' || dish.method === 'oven-pan' || dish.method === 'air-fryer'
  push(ctx, marinateStep(ctx, 10))

  if (roles.protein) {
    push(ctx, {
      title: oven ? 'Roast the protein' : 'Sear it hard',
      detail: oven
        ? `Roast ${proteinName(roles)} at 200°C (180°C fan) until just done.`
        : `Get the pan smoking, then sear ${proteinName(
            roles,
          )} hard on both sides and leave it pink in the middle.`,
      minutes: share(total, 0.35, 2),
    })
    push(ctx, {
      title: 'Rest, then slice',
      detail:
        'Rest it a few minutes off the heat before slicing across the grain, or the juices run out onto the board.',
      minutes: 3,
    })
  }

  const roasted = [...roles.hardVeg, ...roles.aromatics]
  if (roasted.length) {
    push(ctx, {
      title: 'Roast the firm vegetables',
      detail: `Toss ${names(
        roasted,
      )} with a little oil and roast at 200°C (180°C fan) until the edges caramelise.`,
      minutes: share(total, 0.6, 15),
    })
  }
  if (roles.quickVeg.length || roles.leafy.length) {
    push(ctx, {
      title: 'Build the bowl',
      detail: `Put ${names([
        ...roles.leafy,
        ...roles.quickVeg,
      ])} in a large bowl and keep them cold and crisp — the contrast with the warm part is the whole idea.`,
      minutes: null,
    })
  }
  push(ctx, {
    title: 'Dress off the heat',
    detail: `Add the warm ${
      roles.protein ? 'sliced meat' : 'roasted vegetables'
    } and ${
      plan.finish?.ref ?? 'the dressing'
    }, then toss. Never cook this dressing — the acidity and the fresh herbs in it are exactly what heat destroys.`,
    minutes: null,
  })
  push(ctx, finishStep(roles, 'Serve it straight away, while one half is still warm and the other is cold.', ctx.carbsUsed))
}

function friedRice(ctx: Ctx) {
  const { roles, plan, total } = ctx
  ctx.carbsUsed = true
  push(ctx, marinateStep(ctx, 10))
  push(ctx, mepStep(ctx))
  push(ctx, {
    title: 'Loosen the rice',
    detail: `Break ${
      roles.carbs.length ? names(roles.carbs) : 'the rice'
    } up with your fingers so there are no clumps before it hits the pan. Clumps are what make fried rice soggy.`,
    minutes: null,
  })
  if (roles.protein) {
    push(ctx, {
      title: 'Cook the protein',
      detail: `Sear ${proteinName(roles)} in a hot, lightly oiled pan and set it aside.`,
      minutes: share(total, 0.25, 2),
    })
  }
  push(ctx, aromaticStep(ctx, 1, false))
  if (roles.hardVeg.length || roles.quickVeg.length) {
    push(ctx, {
      title: 'Vegetables',
      detail: `Add ${names([...roles.hardVeg, ...roles.quickVeg])} and keep the heat high.`,
      minutes: share(total, 0.2, 1),
    })
  }
  push(ctx, {
    title: 'Fry the rice',
    detail: `Turn the heat to maximum, add the rice and press it into the pan, then toss. Let it sit long enough to catch between tosses — that is where the flavour is.`,
    minutes: share(total, 0.3, 2),
  })
  push(ctx, {
    title: 'Season round the edge',
    detail: plan.finish
      ? `Pour ${plan.finish.ref} around the rim of the pan rather than onto the rice, so it caramelises on the way in, then fold everything together with the protein.`
      : 'Return the protein and fold everything together.',
    minutes: share(total, 0.15, 1),
  })
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function noodlePasta(ctx: Ctx) {
  const { roles, plan, total } = ctx
  ctx.carbsUsed = true
  push(ctx, marinateStep(ctx, 10))
  push(ctx, {
    title: 'Water on first',
    detail: `Get a pot of well-salted water boiling for ${
      roles.carbs.length ? names(roles.carbs) : 'the noodles'
    } and cook them a shade under done. Save a cup of the starchy water.`,
    minutes: share(total, 0.4, 3),
  })
  if (roles.protein) {
    push(ctx, {
      title: 'Sear the protein',
      detail: `While that goes, brown ${proteinName(roles)} in a wide pan.`,
      minutes: share(total, 0.25, 2),
    })
  }
  push(ctx, aromaticStep(ctx))
  if (roles.hardVeg.length || roles.quickVeg.length) {
    push(ctx, {
      title: 'Vegetables',
      detail: `Add ${names([...roles.hardVeg, ...roles.quickVeg])} and cook until just done.`,
      minutes: share(total, 0.2, 2),
    })
  }
  push(ctx, {
    title: 'Marry them in the pan',
    detail: `${
      plan.finish ? `Add ${plan.finish.ref}, ` : 'Then '
    }drag the drained noodles into the pan with a splash of the cooking water and toss hard until the sauce turns glossy and clings.`,
    minutes: share(total, 0.2, 2),
  })
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function wrap(ctx: Ctx) {
  const { roles, plan, total } = ctx
  const tortillas = roles.carbs
  ctx.carbsUsed = tortillas.length > 0
  push(ctx, marinateStep(ctx, 20))
  push(ctx, mepStep(ctx))
  push(ctx, {
    title: 'Char the protein',
    detail: `Sear ${proteinName(
      roles,
    )} in a hot dry-ish pan until the edges blacken in places. Those charred bits are the flavour.`,
    minutes: share(total, 0.35, 2),
  })
  if (roles.quickVeg.length || roles.aromatics.length) {
    push(ctx, {
      title: 'Peppers and onions',
      detail: `Add ${names([
        ...roles.aromatics,
        ...roles.quickVeg,
      ])} and leave them alone long enough to blister before tossing.`,
      minutes: share(total, 0.3, 2),
    })
  }
  if (plan.finish) {
    push(ctx, {
      title: 'Sauce',
      detail: `Add ${plan.finish.ref} and toss through, or keep it aside to spoon over at the table.`,
      minutes: 1,
    })
  }
  if (tortillas.length) {
    push(ctx, {
      title: 'Warm the tortillas',
      detail: `Warm ${names(
        tortillas,
      )} for a few seconds a side in the same pan until soft and speckled. Cold tortillas crack.`,
      minutes: 2,
    })
  }
  push(ctx, finishStep(roles, 'Build them at the table so nothing steams and goes limp.', ctx.carbsUsed))
}

function soup(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(ctx, marinateStep(ctx, 10))
  if (roles.protein) {
    push(ctx, {
      title: 'Brown, then cover',
      detail: `Brown ${proteinName(
        roles,
      )} in the pot first, then add water to cover generously. Skim off any grey foam that rises.`,
      minutes: share(total, 0.2, 3),
    })
  } else {
    push(ctx, {
      title: 'Start the pot',
      detail: 'Bring water to a boil in the pot.',
      minutes: share(total, 0.1, 2),
    })
  }
  push(ctx, aromaticStep(ctx, 2))
  push(ctx, {
    title: 'Simmer',
    detail: cap(
      `${
        plan.finish ? `stir in ${plan.finish.ref} and ` : ''
      }keep it at a bare simmer rather than a rolling boil — a hard boil makes the broth cloudy.`,
    ),
    minutes: share(total, 0.5, 8),
  })
  if (roles.hardVeg.length) {
    push(ctx, {
      title: 'Root vegetables',
      detail: `Add ${names(roles.hardVeg)} and cook until a knife slides in easily.`,
      minutes: share(total, 0.3, 5),
    })
  }
  if (roles.quickVeg.length) {
    push(ctx, {
      title: 'Softer pieces',
      detail: `Add ${names(roles.quickVeg)} for the last stretch only.`,
      minutes: share(total, 0.15, 2),
    })
  }
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, 'Taste for salt at the very end — the broth concentrates as it sits.', ctx.carbsUsed))
}

function steamFish(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(ctx, marinateStep(ctx, 10))
  push(ctx, {
    title: 'Hard boil the steamer',
    detail: 'Get the water at a full rolling boil before anything goes in; weak steam poaches.',
    minutes: null,
  })
  const onPlate = [...roles.aromatics, ...roles.hardVeg, ...roles.quickVeg]
  const isFish = /fish|cod|salmon|batang|seabass|mackerel|snapper|pomfret|halibut|gindara|prawn/i.test(
    roles.protein?.name ?? '',
  )
  push(ctx, {
    title: 'Plate it',
    detail: `Lay ${
      roles.protein ? withQty(roles.protein) : names([...roles.hardVeg, ...roles.quickVeg])
    } on a heatproof plate that fits your steamer${
      onPlate.length ? `, then top with ${names(onPlate)}` : ''
    }. Use a plate with a rim — the juices that collect are worth keeping.`,
    minutes: null,
  })
  push(ctx, {
    title: 'Steam',
    detail: isFish
      ? 'Cover and steam hard. It is done the moment the flesh turns opaque and parts at the bone — a minute too long and it goes rubbery.'
      : 'Cover and steam hard, and resist lifting the lid. Check at the thickest point rather than going by the clock.',
    minutes: total,
  })
  push(ctx, {
    title: 'Dress it',
    detail: isFish
      ? `Tip away the thin liquid that pooled on the plate — it is watery and slightly fishy${
          plan.finish ? `, then pour ${plan.finish.ref} over` : ''
        }.`
      : `Keep the juices that collected on the plate; spoon them back over${
          plan.finish ? ` along with ${plan.finish.ref}` : ''
        }.`,
    minutes: null,
  })
  if (roles.garnish.length) {
    push(ctx, {
      title: 'Hot oil finish',
      detail: `Pile ${names(
        roles.garnish,
      )} on top and, if you want the restaurant version, pour over a spoon of smoking hot oil to wake it up.`,
      minutes: null,
    })
  }
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function misoGrill(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(
    ctx,
    marinateStep(
      ctx,
      30,
      'Longer is better here — this is a saikyo-yaki style cure, so overnight is ideal if you planned ahead.',
    ),
  )
  if (plan.marinade) {
    push(ctx, {
      title: 'Wipe off the excess',
      detail: `Scrape most of the miso off before it goes in. Miso and sugar burn long before ${proteinName(
        roles,
      )} is cooked through.`,
      minutes: null,
    })
  }
  push(ctx, {
    title: 'Preheat',
    detail: 'Heat the oven to 200°C (180°C fan) and line the tray — this glaze welds itself on.',
    minutes: null,
  })
  push(ctx, {
    title: 'Roast',
    detail: `Roast ${proteinName(roles)}${
      roles.hardVeg.length || roles.quickVeg.length
        ? ` alongside ${names([...roles.hardVeg, ...roles.quickVeg])}`
        : ''
    } until just set and blistered on top.`,
    minutes: total,
  })
  if (plan.finish && plan.marinade) {
    push(ctx, {
      title: 'Glaze to serve',
      detail: `Warm ${plan.finish.ref} and spoon it over at the table rather than during cooking.`,
      minutes: null,
    })
  } else if (plan.finish) {
    push(ctx, {
      title: 'Glaze at the end',
      detail: `Brush ${plan.finish.ref} on for the last 3 minutes only. Miso and mirin are full of sugar — put them on at the start and you get a black crust before the middle is done.`,
      minutes: 3,
    })
  }
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function trayRoast(ctx: Ctx) {
  const { roles, plan, total } = ctx
  const airFryer = ctx.dish.method === 'air-fryer'
  push(ctx, marinateStep(ctx, 20))
  push(ctx, {
    title: 'Preheat',
    detail: airFryer
      ? 'Preheat the air fryer to 190°C — going in cold gives you pale, tough results.'
      : 'Heat the oven to 200°C (180°C fan) and get a tray ready.',
    minutes: null,
  })
  const leaves = [...roles.aromatics, ...roles.quickVeg, ...roles.hardVeg].filter((i) =>
    /banana leaf|banana leaves|parchment/i.test(i.name),
  )
  const bed = [...roles.hardVeg, ...roles.quickVeg, ...roles.aromatics].filter(
    (i) => !leaves.includes(i),
  )
  const glaze = plan.finish ? ` Spoon over ${plan.finish.ref}.` : ''
  let build: string
  if (bed.length && roles.protein) {
    build = `Toss ${names(bed)} with a little oil in one layer, then sit ${proteinName(
      roles,
    )} on top so its juices run into them.${glaze}`
  } else if (bed.length) {
    build = `Toss ${names(
      bed,
    )} with a little oil and spread them in one layer — piled up they steam instead of roasting.${glaze}`
  } else {
    build = `Arrange ${
      roles.protein ? withQty(roles.protein) : 'everything'
    } in a single layer.${glaze}`
  }
  if (leaves.length && roles.protein) {
    build = `Lay ${names(leaves)} out, pile ${names(
      bed,
    )} in the middle and sit ${proteinName(
      roles,
    )} on top.${glaze} Fold the leaf into a parcel and secure it — the fish steams in its own juices inside and picks up the scent of the leaf.`
  }
  push(ctx, {
    title: leaves.length ? 'Wrap the parcel' : airFryer ? 'Load the basket' : 'Build the tray',
    detail: build,
    minutes: null,
  })
  push(ctx, {
    title: airFryer ? 'Air fry' : 'Roast',
    detail: airFryer
      ? 'Cook in a single layer, shaking or turning halfway so it browns evenly.'
      : 'Roast for the stated time, turning or basting once at the halfway mark.',
    minutes: total,
  })
  push(ctx, {
    title: 'Check it',
    detail:
      'Check the thickest part is cooked through and give it another 3–5 minutes if it needs it — ovens vary more than recipes admit.',
    minutes: null,
  })
  if (roles.leafy.length) {
    push(ctx, {
      title: 'Greens',
      detail: `Add ${names(roles.leafy)} for the last few minutes only.`,
      minutes: 3,
    })
  }
  push(ctx, finishStep(roles, 'Rest it a couple of minutes before serving.', ctx.carbsUsed))
}

function roastWhole(ctx: Ctx) {
  const { roles, plan, total } = ctx
  const fish = /fish|salmon|haddock|cod|seabass|snapper|trout|barramundi/i.test(
    roles.protein?.name ?? '',
  )
  const it = fish ? 'the fish' : 'the bird'
  push(
    ctx,
    marinateStep(
      ctx,
      30,
      fish
        ? 'An hour is plenty for fish — leave it in a salty marinade overnight and the texture goes chalky.'
        : 'A whole bird wants as long as you can give it — overnight if possible.',
    ),
  )
  push(ctx, {
    title: 'Come to room temperature',
    detail: `Take it out of the fridge while the oven heats. Going in fridge-cold cooks ${it} unevenly — coloured outside, underdone in the middle.`,
    minutes: 20,
  })
  push(ctx, {
    title: 'Preheat',
    detail: fish
      ? 'Heat the oven to 180°C (160°C fan). A big fish wants gentler heat than a roast bird.'
      : 'Heat the oven to 200°C (180°C fan).',
    minutes: null,
  })
  const bed = [...roles.hardVeg, ...roles.aromatics].filter((i) => !/butter|ghee/i.test(i.name))
  const spread = [...roles.hardVeg, ...roles.aromatics].filter((i) => /butter|ghee/i.test(i.name))
  const rub = [
    spread.length ? `Spread ${names(spread)} over and into it` : '',
    plan.finish ? `rub over ${plan.finish.ref}` : '',
  ]
    .filter(Boolean)
    .join(' and ')
  push(ctx, {
    title: 'Set up the tray',
    detail: `${
      bed.length
        ? `Scatter ${names(bed)} in the tray as a bed and sit ${it} on top${
            fish ? '' : ', breast up'
          }.`
        : `Sit ${it} in the tray${fish ? '' : ' breast up'}.`
    }${rub ? ` ${cap(rub)}.` : ''}`,
    minutes: null,
  })
  push(ctx, {
    title: 'Roast',
    detail: fish
      ? 'Roast until the thickest part flakes when you press it and the eye has gone opaque. Cover loosely with foil if the skin colours before the middle is done.'
      : 'Roast until the juices at the thigh joint run clear, basting once or twice. Cover the breast with foil if it colours too fast.',
    minutes: total,
  })
  push(ctx, {
    title: 'Rest properly',
    detail: fish
      ? 'Let it sit 5–10 minutes before serving so it firms up enough to lift off the bone in whole pieces.'
      : 'Rest it 10–15 minutes before carving. This is not optional on a whole bird — carve it hot and the juice ends up on the board.',
    minutes: fish ? 8 : 12,
  })
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function skewer(ctx: Ctx) {
  const { roles, plan, total } = ctx
  push(ctx, marinateStep(ctx, 20))
  push(ctx, {
    title: 'Preheat',
    detail: 'Heat the oven to 220°C (200°C fan) — skewers want high heat and a short cook.',
    minutes: null,
  })
  push(ctx, {
    title: 'Lay them out',
    detail: `Space the skewers on a lined tray so air moves around them${
      roles.carbs.length ? `, with ${names(roles.carbs)} underneath to catch the drips` : ''
    }.`,
    minutes: null,
  })
  push(ctx, {
    title: 'Grill and baste',
    detail: plan.finish
      ? `Cook, turning once, and brush with ${plan.finish.ref} in two or three thin coats rather than one thick one — that is how the lacquered look builds.`
      : 'Cook, turning once, brushing with the pan juices as it goes.',
    minutes: total,
  })
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

function sauteVeg(ctx: Ctx) {
  const { roles } = ctx
  push(ctx, marinateStep(ctx, 5))
  push(ctx, mepStep(ctx))
  push(ctx, {
    title: 'Hot pan',
    detail: 'Get the pan hot with a little oil before anything goes in — vegetables steam in a cool pan.',
    minutes: null,
  })
  push(ctx, aromaticStep(ctx))
  vegSteps(ctx)
  push(ctx, sauceStep(ctx, isBrothy(ctx) ? 'poach' : 'reduce'))
  push(ctx, greensStep(ctx))
  push(ctx, finishStep(roles, undefined, ctx.carbsUsed))
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function cookSteps(dish: Dish): CookStep[] {
  const archetype = archetypeFor(dish)
  const plan = saucePlan(dish, wantsMarinadeFor(dish))
  const roles = rolesFor(dish)
  roles.marinade = plan.marinade?.pack ?? null
  roles.sauce = plan.finish?.pack ?? null

  const ctx: Ctx = { dish, roles, plan, total: dish.timeMinutes, steps: [], carbsUsed: false }

  switch (archetype) {
    case 'fried-rice':
      friedRice(ctx)
      break
    case 'noodle-pasta':
      noodlePasta(ctx)
      break
    case 'curry-paste':
      curryPaste(ctx)
      break
    case 'donburi-simmer':
      donburi(ctx)
      break
    case 'korean-grill':
      koreanGrill(ctx)
      break
    case 'salad-dressing':
      saladDressing(ctx)
      break
    case 'wrap':
      wrap(ctx)
      break
    case 'soup':
      soup(ctx)
      break
    case 'steam-fish':
      steamFish(ctx)
      break
    case 'miso-grill':
      misoGrill(ctx)
      break
    case 'roast-whole':
      roastWhole(ctx)
      break
    case 'skewer':
      skewer(ctx)
      break
    case 'tray-roast':
      trayRoast(ctx)
      break
    case 'braise':
      braise(ctx)
      break
    case 'saute-veg':
      sauteVeg(ctx)
      break
    default:
      stirFry(ctx)
  }

  if (ctx.dish.method === 'pan-pot' && archetype !== 'noodle-pasta' && roles.carbs.length) {
    ctx.steps.push({
      title: 'Second pot',
      detail: `Run a pot alongside for ${names(
        roles.carbs,
      )}; drain it and combine right at the end.`,
      minutes: share(ctx.total, 0.5, 3),
    })
  }

  return ctx.steps
}

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  'fried-rice': 'Fried rice',
  'noodle-pasta': 'Noodles',
  'curry-paste': 'Fresh curry paste',
  'donburi-simmer': 'Simmered bowl',
  'korean-grill': 'Korean grill',
  'salad-dressing': 'Warm salad',
  wrap: 'Wraps',
  soup: 'Soup',
  'steam-fish': 'Steamed',
  'miso-grill': 'Miso-cured',
  'roast-whole': 'Whole roast',
  skewer: 'Skewers',
  'stir-fry': 'Stir-fry',
  braise: 'Braise',
  'tray-roast': 'Tray roast',
  'saute-veg': 'Sautéed vegetables',
}

export function methodLabel(dish: Dish): string {
  return dish.equipment || 'Pan'
}
