import { useMemo } from 'react'
import { PROTEIN_TAG_LABEL } from '../domain/normalize'
import { SearchIcon } from '../components/icons'
import type { Dish, PlanEntry, ProteinTag } from '../types'

export type CalorieBand = 'all' | 'under350' | '350to500' | 'over500'

const CALORIE_LABEL: Record<CalorieBand, string> = {
  all: 'Any calories',
  under350: 'Under 350 kcal',
  '350to500': '350–500 kcal',
  over500: 'Over 500 kcal',
}

const PROTEIN_TAGS: ProteinTag[] = ['chicken', 'pork', 'beef', 'seafood', 'veggie']

interface Props {
  dishes: Dish[]
  entries: PlanEntry[]
  query: string
  proteins: ProteinTag[]
  calories: CalorieBand
  onQuery: (q: string) => void
  onToggleProtein: (tag: ProteinTag) => void
  onCalories: (band: CalorieBand) => void
  onAdd: (dish: Dish) => void
  onRemove: (dishId: string) => void
  onPortions: (dishId: string, portions: number) => void
  onProtein: (dishId: string, proteinId: string) => void
}

function matchesCalories(dish: Dish, band: CalorieBand): boolean {
  if (band === 'all') return true
  const kcal = dish.caloriesKcal
  if (kcal == null) return false
  if (band === 'under350') return kcal < 350
  if (band === '350to500') return kcal >= 350 && kcal <= 500
  return kcal > 500
}

export default function PlanPage({
  dishes,
  entries,
  query,
  proteins,
  calories,
  onQuery,
  onToggleProtein,
  onCalories,
  onAdd,
  onRemove,
  onPortions,
  onProtein,
}: Props) {
  const selectedIds = useMemo(() => new Set(entries.map((e) => e.dishId)), [entries])
  const q = query.trim().toLowerCase()

  const filtered = dishes.filter((dish) => {
    if (q && !dish.name.toLowerCase().includes(q)) return false
    if (proteins.length > 0 && !proteins.includes(dish.proteinTag)) return false
    return matchesCalories(dish, calories)
  })

  const picked = filtered.filter((d) => selectedIds.has(d.id))
  const rest = filtered.filter((d) => !selectedIds.has(d.id))

  return (
    <>
      <div className="search-wrap">
        <span className="search-icon">
          <SearchIcon />
        </span>
        <input
          className="search"
          placeholder="Search 144 dishes"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search dishes"
        />
      </div>

      <div className="filters" role="group" aria-label="Filter by main protein">
        {PROTEIN_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className="chip"
            aria-pressed={proteins.includes(tag)}
            onClick={() => onToggleProtein(tag)}
          >
            {PROTEIN_TAG_LABEL[tag]}
          </button>
        ))}
      </div>

      <div className="filters" role="group" aria-label="Filter by calories">
        {(Object.keys(CALORIE_LABEL) as CalorieBand[]).map((band) => (
          <button
            key={band}
            type="button"
            className="chip"
            aria-pressed={calories === band}
            onClick={() => onCalories(band)}
          >
            {CALORIE_LABEL[band]}
          </button>
        ))}
      </div>

      {picked.length > 0 && (
        <>
          <div className="section-head">
            <h2>This week</h2>
            <span className="count-pill">{picked.length} selected</span>
          </div>
          <div className="grid">
            {picked.map((dish) => (
              <DishTile
                key={dish.id}
                dish={dish}
                entry={entries.find((e) => e.dishId === dish.id) ?? null}
                onAdd={onAdd}
                onRemove={onRemove}
                onPortions={onPortions}
                onProtein={onProtein}
              />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>{q || proteins.length || calories !== 'all' ? 'Matching dishes' : 'All dishes'}</h2>
        <span className="count-pill">{rest.length} dishes</span>
      </div>
      {rest.length === 0 ? (
        <p className="empty">No dishes match those filters. Clear a filter to see more.</p>
      ) : (
        <div className="grid">
          {rest.map((dish) => (
            <DishTile
              key={dish.id}
              dish={dish}
              entry={null}
              onAdd={onAdd}
              onRemove={onRemove}
              onPortions={onPortions}
              onProtein={onProtein}
            />
          ))}
        </div>
      )}
    </>
  )
}

function DishTile({
  dish,
  entry,
  onAdd,
  onRemove,
  onPortions,
  onProtein,
}: {
  dish: Dish
  entry: PlanEntry | null
  onAdd: (dish: Dish) => void
  onRemove: (dishId: string) => void
  onPortions: (dishId: string, portions: number) => void
  onProtein: (dishId: string, proteinId: string) => void
}) {
  const sub = [dish.time, dish.calories].filter(Boolean).join(' · ')
  return (
    <article className={`dish${entry ? ' picked' : ''}`}>
      <div className="dish-photo">
        {dish.thumb && (
          <img src={dish.thumb} alt={dish.name} loading="lazy" decoding="async" />
        )}
        <div className="dish-tags">
          <span className="tag">{PROTEIN_TAG_LABEL[dish.proteinTag]}</span>
          {dish.servingsBase > 1 && <span className="tag">{dish.servingsBase} pax</span>}
        </div>
        <div className="dish-photo-meta">
          <div className="dish-name">{dish.name}</div>
          <div className="dish-sub">{sub}</div>
        </div>
      </div>
      <div className="dish-body">
        {entry ? (
          <>
            <div className="stepper">
              <button
                type="button"
                onClick={() => onPortions(dish.id, Math.max(1, entry.portions - 1))}
                disabled={entry.portions <= 1}
                aria-label={`Fewer portions of ${dish.name}`}
              >
                −
              </button>
              <span className="count">{entry.portions} pax</span>
              <button
                type="button"
                onClick={() => onPortions(dish.id, entry.portions + 1)}
                aria-label={`More portions of ${dish.name}`}
              >
                +
              </button>
            </div>
            {dish.proteinOptions.length > 1 && (
              <select
                className="mini-select"
                value={entry.proteinId ?? dish.defaultProteinId ?? ''}
                onChange={(e) => onProtein(dish.id, e.target.value)}
                aria-label={`Protein for ${dish.name}`}
              >
                {dish.proteinOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="link-btn" onClick={() => onRemove(dish.id)}>
              Remove
            </button>
          </>
        ) : (
          <button type="button" className="add-btn" onClick={() => onAdd(dish)}>
            Add to week
          </button>
        )}
      </div>
    </article>
  )
}
