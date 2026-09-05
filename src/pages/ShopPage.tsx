import { AISLE_LABEL } from '../domain/normalize'
import { componentKey, formatQuantity } from '../domain/tally'
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
                  checkedKeys={checked}
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
                    checkedKeys={checked}
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
  checkedKeys,
  showDishes,
  onToggle,
  onHide,
}: {
  line: GroceryLine
  done: boolean
  checkedKeys: Set<string>
  showDishes: boolean
  onToggle: (key: string) => void
  onHide: (itemId: string) => void
}) {
  const hideable = line.kind === 'pantry' || line.kind === 'sauce-pack'
  const parts = line.kind === 'sauce-pack' ? (line.components ?? []) : []
  const showQty = line.kind !== 'sauce-pack' || line.quantity.amount != null

  return (
    <div className={`item${done ? ' done' : ''}${parts.length > 0 ? ' item-sauce' : ''}`}>
      <label className="item-row">
        <input
          type="checkbox"
          className="check"
          checked={done}
          onChange={() => onToggle(line.key)}
        />
        <div className="item-main">
          <div className="item-name">
            {line.name}
            {showQty && (
              <>
                {' '}
                <span className="item-qty">{formatQuantity(line.quantity)}</span>
              </>
            )}
          </div>
          {showDishes && (
            <div className="item-sub">
              {line.contributions
                .map((c) => `${c.dishName} ${formatQuantity(c.quantity)}`)
                .join(' · ')}
            </div>
          )}
          {hideable && parts.length === 0 && (
            <div className="item-actions">
              <HideButton onHide={() => onHide(line.itemId)} />
            </div>
          )}
        </div>
      </label>

      {parts.length > 0 && (
        <div className="sauce-breakdown">
          <div className="sauce-breakdown-label">Buy these if you are making it</div>
          {parts.map((part) => {
            const key = componentKey(part.itemId)
            const partDone = checkedKeys.has(key)
            return (
              <div key={part.itemId} className={`sauce-part${partDone ? ' done' : ''}`}>
                <label className="sauce-part-row">
                  <input
                    type="checkbox"
                    className="check"
                    checked={partDone}
                    onChange={() => onToggle(key)}
                  />
                  <span className="sauce-part-name">{part.name}</span>
                </label>
                <HideButton onHide={() => onHide(part.itemId)} />
              </div>
            )
          })}
          <div className="item-actions">
            <HideButton label="I already have this pack" onHide={() => onHide(line.itemId)} />
          </div>
        </div>
      )}
    </div>
  )
}

function HideButton({
  onHide,
  label = 'I already have this',
}: {
  onHide: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="tiny"
      onClick={(e) => {
        e.preventDefault()
        onHide()
      }}
    >
      {label}
    </button>
  )
}
