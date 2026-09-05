import { AISLE_LABEL } from '../domain/normalize'
import { prepStations, type PrepPack, type PrepStation } from '../domain/prep'
import { formatQuantity } from '../domain/tally'
import type { Dish, PlanEntry, Quantity, SplitGroup } from '../types'

export type SplitView = 'meal' | 'ingredient'

interface Props {
  view: SplitView
  onView: (view: SplitView) => void
  groups: SplitGroup[]
  dishes: Dish[]
  entries: PlanEntry[]
}

function qtyLabel(qty: Quantity): string {
  return formatQuantity(qty)
}

function packWithLine(pack: PrepPack): string {
  if (pack.used.amount != null && pack.total.amount != null && pack.used.amount !== pack.total.amount) {
    return `with ${qtyLabel(pack.used)} of the ${qtyLabel(pack.total)} ${pack.label.toLowerCase()}`
  }
  if (pack.used.amount != null) {
    return `with the ${qtyLabel(pack.used)} ${pack.label.toLowerCase()}`
  }
  return `with the ${pack.label.toLowerCase()}`
}

function MealCard({ station }: { station: PrepStation }) {
  const hero = station.marinade
    ? { name: station.marinade.targetName, qty: station.marinade.targetQty }
    : station.protein
      ? { name: station.protein.name, qty: station.protein.quantity }
      : null

  return (
    <section className="group">
      <header className="group-head">
        {station.thumb && <img src={station.thumb} alt="" loading="lazy" />}
        <div>
          <div className="group-title">{station.dishName}</div>
          <div className="group-sub">
            {station.portions} pax
            {station.time ? ` · ${station.time}` : ''}
            {station.calories ? ` · ${station.calories}` : ''}
          </div>
        </div>
      </header>
      <div className="group-body">
        {hero && (
          <div className={station.marinade ? 'prep-block' : 'prep-block skip'}>
            <div className="prep-block-title">{station.marinade ? 'Marinate' : 'Protein'}</div>
            <div className="prep-hero">
              <span>{hero.name}</span>
              <span className="alloc-qty">{qtyLabel(hero.qty)}</span>
            </div>
            {station.marinade ? (
              <>
                <div className="prep-with">{packWithLine(station.marinade)}</div>
                <div className="sauce-note">
                  {station.marinade.components.length > 0
                    ? station.marinade.components.join(', ')
                    : 'Mix as written on the recipe card.'}
                </div>
                {station.marinade.reserve && (
                  <div className="prep-reserve">
                    Keep {qtyLabel(station.marinade.reserve)} aside — the kit only gives you
                    one pack and the pan needs it.
                  </div>
                )}
              </>
            ) : (
              station.skipNote && <div className="sauce-note">{station.skipNote}</div>
            )}
          </div>
        )}

        {!hero && station.skipNote && (
          <div className="prep-block skip">
            <div className="prep-block-title">Prep</div>
            <div className="sauce-note">{station.skipNote}</div>
          </div>
        )}

        {station.cookWith && (
          <>
            <div className="group-label">Cook with later</div>
            <div className="alloc">
              <div className="alloc-name">
                <div>{station.cookWith.label}</div>
                {station.cookWith.components.length > 0 && (
                  <div className="sauce-note">{station.cookWith.components.join(', ')}</div>
                )}
              </div>
              <span className="alloc-qty">
                {station.cookWith.used.amount != null ? qtyLabel(station.cookWith.used) : '—'}
              </span>
            </div>
          </>
        )}

        {station.bag.length > 0 && (
          <>
            <div className="group-label">Bag separately</div>
            {station.bag.map((line) => (
              <div key={line.name} className="alloc">
                <div className="alloc-name">{line.name}</div>
                <span className="alloc-qty">{qtyLabel(line.quantity)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}

export default function SplitPage({ view, onView, groups, dishes, entries }: Props) {
  const byId = new Map(dishes.map((d) => [d.id, d]))
  const shared = groups.filter((g) => g.kind !== 'sauce-pack')
  const stations = prepStations(dishes, entries)
  const empty = entries.length === 0

  return (
    <>
      <div className="section-head">
        <h2>Prep</h2>
        <div className="segmented" role="group" aria-label="Group prep list">
          <button type="button" aria-pressed={view === 'meal'} onClick={() => onView('meal')}>
            By meal
          </button>
          <button
            type="button"
            aria-pressed={view === 'ingredient'}
            onClick={() => onView('ingredient')}
          >
            By ingredient
          </button>
        </div>
      </div>

      {empty && <p className="empty">Add dishes on Plan, then come here to bag and marinate each meal.</p>}

      {!empty && (
        <p className="item-sub" style={{ marginBottom: 14 }}>
          {view === 'meal'
            ? 'One card per dish: which meat, which pack, how much.'
            : 'Portion each ingredient into labelled bags before you marinate.'}
        </p>
      )}

      {view === 'meal' && stations.map((station) => <MealCard key={station.dishId} station={station} />)}

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
    </>
  )
}
