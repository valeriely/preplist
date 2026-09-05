import { useEffect, useRef, useState } from 'react'
import type { Dish, SavedWeek } from '../types'

interface Props {
  weeks: SavedWeek[]
  activeWeekId: string
  dishes: Dish[]
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onReset: (id: string) => void
  onStartNew: () => void
}

function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WeeksPage({
  weeks,
  activeWeekId,
  dishes,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onReset,
  onStartNew,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const dishName = new Map(dishes.map((d) => [d.id, d.name]))

  return (
    <>
      <div className="section-head">
        <h2>My weeks</h2>
        <button type="button" className="btn" onClick={onStartNew}>
          New week
        </button>
      </div>
      <p className="item-sub" style={{ marginBottom: 16 }}>
        Tap a week to open it. Whatever you change afterwards — dishes, portions, ticked-off
        groceries, cooking notes — saves straight back into that week.
      </p>

      <div className="list">
        {weeks.map((week) => {
          const isOpen = week.id === activeWeekId
          const names = week.plan.entries
            .map((e) => dishName.get(e.dishId))
            .filter((n): n is string => !!n)
          const ticked = week.plan.checkedKeys.length

          return (
            <article key={week.id} className={`item week${isOpen ? ' week-open' : ''}`}>
              <div className="item-main">
                {renamingId === week.id ? (
                  <RenameField
                    value={week.name}
                    onDone={(name) => {
                      onRename(week.id, name)
                      setRenamingId(null)
                    }}
                  />
                ) : (
                  <div className="week-head">
                    <button
                      type="button"
                      className="week-name"
                      onClick={() => onOpen(week.id)}
                      aria-current={isOpen}
                    >
                      {week.name}
                    </button>
                    {isOpen && <span className="week-badge">Open</span>}
                  </div>
                )}

                <div className="item-sub">
                  {week.plan.entries.length === 0
                    ? 'No dishes yet'
                    : `${week.plan.entries.length} dish${week.plan.entries.length === 1 ? '' : 'es'}`}
                  {ticked > 0 && ` · ${ticked} ticked off`}
                  {` · edited ${when(week.updatedAt)}`}
                </div>

                {names.length > 0 && <div className="week-dishes">{names.join(', ')}</div>}

                <div className="item-actions">
                  {!isOpen && (
                    <button type="button" className="tiny" onClick={() => onOpen(week.id)}>
                      Open
                    </button>
                  )}
                  <button type="button" className="tiny" onClick={() => setRenamingId(week.id)}>
                    Rename
                  </button>
                  <button type="button" className="tiny" onClick={() => onDuplicate(week.id)}>
                    Duplicate
                  </button>
                  {ticked > 0 && (
                    <button type="button" className="tiny" onClick={() => onReset(week.id)}>
                      Clear ticks
                    </button>
                  )}
                  <button type="button" className="tiny" onClick={() => onDelete(week.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <p className="disclaimer" style={{ marginTop: 18 }}>
        Weeks are stored in this browser only, so they will not appear on another device. Duplicate a
        week before editing it if you want to keep the original as a record.
      </p>
    </>
  )
}

function RenameField({ value, onDone }: { value: string; onDone: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.select()
  }, [])

  return (
    <form
      className="week-rename"
      onSubmit={(e) => {
        e.preventDefault()
        onDone(draft)
      }}
    >
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onDone(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone(value)
        }}
        aria-label="Week name"
        placeholder="Name this week"
      />
      <button type="submit" className="tiny">
        Done
      </button>
    </form>
  )
}
