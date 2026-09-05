import { ARCHETYPE_LABEL, archetypeFor, cookSteps, methodLabel, rolesFor } from '../domain/cookPlan'
import { batchKcal, cookedPortion, kcalPerPax, parseCookedGrams } from '../domain/nutrition'
import { formatQuantity, resolveDish } from '../domain/tally'
import { PROTEIN_TAG_LABEL } from '../domain/normalize'
import { TimeIcon } from '../components/icons'
import type { Dish, PlanEntry } from '../types'

interface Props {
  dishes: Dish[]
  entries: PlanEntry[]
  openDishId: string | null
  notes: Record<string, string>
  cookedGrams: Record<string, number>
  onOpen: (dishId: string | null) => void
  onNote: (dishId: string, note: string) => void
  onCookedGrams: (dishId: string, grams: number | null) => void
}

export default function CookPage({
  dishes,
  entries,
  openDishId,
  notes,
  cookedGrams,
  onOpen,
  onNote,
  onCookedGrams,
}: Props) {
  const byId = new Map(dishes.map((d) => [d.id, d]))
  const planned = entries
    .map((entry) => {
      const dish = byId.get(entry.dishId)
      return dish ? { dish, entry } : null
    })
    .filter((x): x is { dish: Dish; entry: PlanEntry } => x !== null)

  if (planned.length === 0) {
    return <p className="empty">Add dishes on Plan, then come here for a rough cooking method.</p>
  }

  const open = planned.find((p) => p.dish.id === openDishId)
  if (open) {
    return (
      <CookDetail
        dish={open.dish}
        entry={open.entry}
        note={notes[open.dish.id] ?? ''}
        cookedGrams={cookedGrams[open.dish.id] ?? null}
        onBack={() => onOpen(null)}
        onNote={(value) => onNote(open.dish.id, value)}
        onCookedGrams={(grams) => onCookedGrams(open.dish.id, grams)}
      />
    )
  }

  return (
    <>
      <div className="section-head">
        <h2>Cook</h2>
        <span className="count-pill">{planned.length} dishes</span>
      </div>
      <p className="item-sub" style={{ marginBottom: 14 }}>
        Tap a dish for a rough method built from its kit details.
      </p>
      <div className="grid">
        {planned.map(({ dish, entry }) => {
          const perPax = kcalPerPax(dish)
          return (
            <button
              key={dish.id}
              type="button"
              className="dish cook-tile"
              onClick={() => onOpen(dish.id)}
            >
              <div className="dish-photo">
                {dish.thumb && <img src={dish.thumb} alt="" loading="lazy" decoding="async" />}
                <div className="dish-tags">
                  <span className="tag">{methodLabel(dish)}</span>
                </div>
                <div className="dish-photo-meta">
                  <div className="dish-name">{dish.name}</div>
                  <div className="dish-sub">
                    {entry.portions} pax
                    {perPax != null ? ` · ${perPax} kcal / pax` : ''}
                    {dish.time ? ` · ${dish.time}` : ''}
                  </div>
                </div>
              </div>
              <div className="dish-body">
                <span className="cook-cta">
                  {cookSteps(dish).length} steps
                  {dish.effortHats ? ` · ${'▲'.repeat(dish.effortHats)} effort` : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function CookDetail({
  dish,
  entry,
  note,
  cookedGrams,
  onBack,
  onNote,
  onCookedGrams,
}: {
  dish: Dish
  entry: PlanEntry
  note: string
  cookedGrams: number | null
  onBack: () => void
  onNote: (value: string) => void
  onCookedGrams: (grams: number | null) => void
}) {
  const resolved = resolveDish(dish, entry)
  const steps = cookSteps(resolved)
  const roles = rolesFor(resolved)
  const fresh = resolved.ingredients.filter((i) => i.kind === 'fresh')
  const perPax = kcalPerPax(dish)
  const batch = batchKcal(dish, entry.portions)
  const portion = cookedGrams != null ? cookedPortion(dish, entry.portions, cookedGrams) : null

  return (
    <>
      <div className="detail-top">
        <button type="button" className="tiny" onClick={onBack}>
          ← All dishes
        </button>
      </div>

      <section className="hero">
        {dish.image && <img src={dish.image} alt={dish.name} />}
        <div className="hero-text">
          <h2>{dish.name}</h2>
          <div className="hero-meta">
            <span>
              <TimeIcon /> {dish.time || 'see card'}
            </span>
            <span>{methodLabel(dish)}</span>
            <span>{entry.portions} pax</span>
            {perPax != null && <span>{perPax} kcal / 1 pax</span>}
            {batch != null && entry.portions !== 1 && <span>{batch} kcal for {entry.portions} pax</span>}
          </div>
        </div>
      </section>

      <div className="badges">
        <span className="badge">{ARCHETYPE_LABEL[archetypeFor(resolved)]}</span>
        <span className="badge">{PROTEIN_TAG_LABEL[dish.proteinTag]}</span>
        {dish.effortHats && <span className="badge">{dish.effortHats} hat effort</span>}
        {dish.chillis != null && (
          <span className="badge">
            {dish.chillis === 0 ? 'No spice' : `${'🌶'.repeat(Math.min(dish.chillis, 3))} spice`}
          </span>
        )}
      </div>

      <p className="disclaimer">
        Prepped ships a printed recipe card with the official steps. This method is inferred from the
        kit’s equipment, timing and ingredients, matched to how the dish is normally cooked — treat
        it as a reminder, not gospel.{' '}
        <a href={dish.url} target="_blank" rel="noreferrer">
          Dish page ↗
        </a>
      </p>

      <div className="group-label">You need</div>
      <div className="group">
        <div className="group-body">
          {fresh.map((ing) => (
            <div key={ing.itemId + ing.recipeText} className="alloc">
              <div className="alloc-name">{ing.name}</div>
              <span className="alloc-qty">{formatQuantity(ing.quantity)}</span>
            </div>
          ))}
          {resolved.sauces.map((sauce) => (
            <div key={sauce.id} className="alloc">
              <div className="alloc-name">
                <div>{sauce.label}</div>
                {sauce.components.length > 0 && (
                  <div className="sauce-note">
                    {sauce.components.map((c) => c.name).join(', ')}
                  </div>
                )}
              </div>
              <span className="alloc-qty">
                {sauce.quantity.amount != null ? formatQuantity(sauce.quantity) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="group-label">Rough method</div>
      <ol className="steps">
        {steps.map((step, i) => (
          <li key={step.title + i} className="step">
            <span className="step-num">{i + 1}</span>
            <div className="step-body">
              <div className="step-title">
                {step.title}
                {step.minutes != null && <span className="step-time">~{step.minutes} min</span>}
              </div>
              <p className="step-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {roles.protein && (
        <p className="item-sub">
          Keep this dish’s {roles.protein.name.toLowerCase()} (
          {formatQuantity(roles.protein.quantity)}) in its own bag so it does not mix with the rest
          of the week.
        </p>
      )}

      <div className="group-label">Portion</div>
      <div className="portion-card">
        {perPax != null ? (
          <p className="portion-kcal">
            <strong>{perPax} kcal</strong> / 1 pax
            {batch != null && entry.portions !== 1 && (
              <>
                {' '}
                · <strong>{batch} kcal</strong> for this {entry.portions} pax cook
              </>
            )}
          </p>
        ) : (
          <p className="item-sub">This kit has no calorie figure. You can still weigh the pot to split it evenly.</p>
        )}
        <label className="portion-weigh">
          <span>Weigh the whole cooked dish</span>
          <span className="portion-weigh-field">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder="e.g. 640"
              value={cookedGrams ?? ''}
              onChange={(e) => onCookedGrams(parseCookedGrams(e.target.value))}
              aria-label={`Cooked weight of ${dish.name} in grams`}
            />
            <span>g</span>
          </span>
        </label>
        {portion && (
          <p className="portion-result">
            1 pax = <strong>{portion.gramsPerPax} g</strong>
            {portion.kcalPerPax != null && (
              <>
                {' '}
                = <strong>{portion.kcalPerPax} kcal</strong>
              </>
            )}
          </p>
        )}
        <p className="item-sub">
          Weigh the finished pot, not the raw kit. Rice or sides that are not in the kit are not in
          the calorie number.
        </p>
      </div>

      <div className="group-label">My notes</div>
      <textarea
        className="notes"
        value={note}
        placeholder="What you changed, how long it actually took, what to buy more of…"
        onChange={(e) => onNote(e.target.value)}
        aria-label={`Notes for ${dish.name}`}
      />
    </>
  )
}
