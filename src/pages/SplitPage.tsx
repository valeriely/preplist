import { AISLE_LABEL } from '../domain/normalize'
import { formatQuantity } from '../domain/tally'
import type { Dish, DishGroup, SplitGroup } from '../types'

export type SplitView = 'ingredient' | 'dish'

interface Props {
  view: SplitView
  onView: (view: SplitView) => void
  groups: SplitGroup[]
  dishGroups: DishGroup[]
  dishes: Dish[]
}

export default function SplitPage({ view, onView, groups, dishGroups, dishes }: Props) {
  const byId = new Map(dishes.map((d) => [d.id, d]))
  const shared = groups.filter((g) => g.kind !== 'sauce-pack')

  return (
    <>
      <div className="section-head">
        <h2>Prep</h2>
        <div className="segmented" role="group" aria-label="Group prep list">
          <button
            type="button"
            aria-pressed={view === 'ingredient'}
            onClick={() => onView('ingredient')}
          >
            By ingredient
          </button>
          <button type="button" aria-pressed={view === 'dish'} onClick={() => onView('dish')}>
            By dish
          </button>
        </div>
      </div>

      {shared.length === 0 && (
        <p className="empty">Add dishes first, then split what you bought by dish.</p>
      )}

      {shared.length > 0 && (
        <p className="item-sub" style={{ marginBottom: 14 }}>
          {view === 'ingredient'
            ? 'Portion each ingredient into labelled bags before you marinate.'
            : 'Everything one dish needs, so nothing gets mixed up.'}
        </p>
      )}

      {view === 'ingredient' &&
        shared.map((group) => (
          <section key={`${group.kind}-${group.itemId}`} className="group">
            <header className="group-head">
              <div>
                <div className="group-title">
                  {group.name}
                  {group.total.amount != null ? ` — ${formatQuantity(group.total)}` : ''}
                </div>
                <div className="group-sub">
                  {AISLE_LABEL[group.aisle]} · {group.allocations.length}{' '}
                  {group.allocations.length === 1 ? 'dish' : 'dishes'}
                </div>
              </div>
            </header>
            <div className="group-body">
              {group.allocations.map((a) => (
                <div key={a.dishId + a.quantity.raw} className="alloc">
                  <div className="alloc-name">
                    <div>{a.dishName}</div>
                    {byId.get(a.dishId)?.time && (
                      <div className="sauce-note">{byId.get(a.dishId)?.time}</div>
                    )}
                  </div>
                  <span className="alloc-qty">{formatQuantity(a.quantity)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

      {view === 'dish' &&
        dishGroups.map((group) => {
          const dish = byId.get(group.dishId)
          const fresh = group.lines.filter((l) => l.kind === 'fresh')
          return (
            <section key={group.dishId} className="group">
              <header className="group-head">
                {group.thumb && <img src={group.thumb} alt="" loading="lazy" />}
                <div>
                  <div className="group-title">{group.dishName}</div>
                  <div className="group-sub">
                    {group.portions} pax
                    {group.time ? ` · ${group.time}` : ''}
                    {group.calories ? ` · ${group.calories}` : ''}
                  </div>
                </div>
              </header>
              <div className="group-body">
                <div className="group-label">Prep these</div>
                {fresh.map((line) => (
                  <div key={line.key} className="alloc">
                    <div className="alloc-name">{line.name}</div>
                    <span className="alloc-qty">{formatQuantity(line.quantity)}</span>
                  </div>
                ))}
                {dish?.sauces.map((sauce, i) => (
                  <div key={sauce.id}>
                    <div className="group-label">
                      {sauce.label}
                      {group.sauces[i]?.quantity.amount != null
                        ? ` · ${formatQuantity(group.sauces[i].quantity)}`
                        : ''}
                    </div>
                    <div className="sauce-note">
                      {sauce.components.length > 0
                        ? sauce.components.map((c) => c.name).join(', ')
                        : 'Mix as written on the recipe card.'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
    </>
  )
}
