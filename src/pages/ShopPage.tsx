import { AISLE_LABEL } from '../domain/normalize'
import { formatQuantity } from '../domain/tally'
import type { DishGroup, GroceryLine } from '../types'

export type ShopView = 'aisle' | 'dish'

interface Props {
  view: ShopView
  onView: (view: ShopView) => void
  groups: { aisle: GroceryLine['aisle']; lines: GroceryLine[] }[]
  dishGroups: DishGroup[]
  checkedKeys: string[]
  onToggleBought: (key: string) => void
  onHide: (itemId: string) => void
}

export default function ShopPage({
  view,
  onView,
  groups,
  dishGroups,
  checkedKeys,
  onToggleBought,
  onHide,
}: Props) {
  const checked = new Set(checkedKeys)
  const hasItems = groups.length > 0

  return (
    <>
      <div className="section-head">
        <h2>Grocery list</h2>
        <div className="segmented" role="group" aria-label="Group grocery list">
          <button type="button" aria-pressed={view === 'aisle'} onClick={() => onView('aisle')}>
            By aisle
          </button>
          <button type="button" aria-pressed={view === 'dish'} onClick={() => onView('dish')}>
            By dish
          </button>
        </div>
      </div>

      {!hasItems && <p className="empty">Add dishes on Plan to build a grocery list.</p>}

      {hasItems && view === 'aisle' &&
        groups.map((group) => (
          <section key={group.aisle}>
            <h3 className="aisle-head">{AISLE_LABEL[group.aisle]}</h3>
            <div className="list">
              {group.lines.map((line) => (
                <Row
                  key={line.key}
                  line={line}
                  done={checked.has(line.key)}
                  showDishes
                  onToggle={onToggleBought}
                  onHide={onHide}
                />
              ))}
            </div>
          </section>
        ))}

      {hasItems && view === 'dish' &&
        dishGroups.map((group) => (
          <section key={group.dishId} className="group">
            <header className="group-head">
              {group.thumb && <img src={group.thumb} alt="" loading="lazy" />}
              <div>
                <div className="group-title">{group.dishName}</div>
                <div className="group-sub">
                  {group.portions} pax
                  {group.proteinLabel ? ` · ${group.proteinLabel}` : ''}
                  {group.time ? ` · ${group.time}` : ''}
                </div>
              </div>
            </header>
            <div className="group-body">
              <div className="list">
                {group.lines.map((line) => (
                  <Row
                    key={line.key}
                    line={line}
                    done={checked.has(line.key)}
                    showDishes={false}
                    onToggle={onToggleBought}
                    onHide={onHide}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
    </>
  )
}

function Row({
  line,
  done,
  showDishes,
  onToggle,
  onHide,
}: {
  line: GroceryLine
  done: boolean
  showDishes: boolean
  onToggle: (key: string) => void
  onHide: (itemId: string) => void
}) {
  const hideable = line.kind === 'pantry' || line.kind === 'sauce-pack'
  return (
    <label className={`item${done ? ' done' : ''}`}>
      <input
        type="checkbox"
        className="check"
        checked={done}
        onChange={() => onToggle(line.key)}
      />
      <div className="item-main">
        <div className="item-name">
          {line.name} <span className="item-qty">{formatQuantity(line.quantity)}</span>
        </div>
        {showDishes && (
          <div className="item-sub">
            {line.contributions
              .map((c) => `${c.dishName} ${formatQuantity(c.quantity)}`)
              .join(' · ')}
          </div>
        )}
        {hideable && (
          <div className="item-actions">
            <button
              type="button"
              className="tiny"
              onClick={(e) => {
                e.preventDefault()
                onHide(line.itemId)
              }}
            >
              I already have this
            </button>
          </div>
        )}
      </div>
    </label>
  )
}
