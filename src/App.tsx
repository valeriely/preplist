import { useEffect, useMemo, useState } from 'react'
import dishesJson from './data/dishes.json'
import { groceryByAisle, groupByDish, splitByIngredient, tallyGrocery } from './domain/tally'
import { defaultProteinId } from './domain/normalize'
import PlanPage, { type CalorieBand } from './pages/PlanPage'
import ShopPage, { type ShopView } from './pages/ShopPage'
import SplitPage, { type SplitView } from './pages/SplitPage'
import CookPage from './pages/CookPage'
import WeeksPage from './pages/WeeksPage'
import {
  CartIcon,
  CookIcon,
  LogIcon,
  MoonIcon,
  PlanIcon,
  SplitIcon,
  SunIcon,
} from './components/icons'
import { loadWeeks, saveWeeks } from './storage'
import {
  activeWeek,
  deleteWeek,
  duplicateWeek,
  openWeek,
  renameWeek,
  resetProgress,
  startWeek,
  weeksForDisplay,
  withActivePlan,
} from './domain/weeks'
import { useTheme } from './theme'
import type { Dish, ProteinTag, WeekPlan, WeeksState } from './types'

const dishes = dishesJson as Dish[]

type NavTab = 'plan' | 'shop' | 'split' | 'cook' | 'weeks'

const TABS: { id: NavTab; label: string; icon: (props: { size?: number }) => React.ReactElement }[] = [
  { id: 'plan', label: 'Plan', icon: PlanIcon },
  { id: 'shop', label: 'Shop', icon: CartIcon },
  { id: 'split', label: 'Prep', icon: SplitIcon },
  { id: 'cook', label: 'Cook', icon: CookIcon },
  { id: 'weeks', label: 'Weeks', icon: LogIcon },
]

export default function App() {
  const [tab, setTab] = useState<NavTab>('plan')
  const [weeks, setWeeks] = useState<WeeksState>(() => loadWeeks())
  const [query, setQuery] = useState('')
  const [proteins, setProteins] = useState<ProteinTag[]>([])
  const [calories, setCalories] = useState<CalorieBand>('all')
  const [shopView, setShopView] = useState<ShopView>('aisle')
  const [splitView, setSplitView] = useState<SplitView>('meal')
  const [openCookId, setOpenCookId] = useState<string | null>(null)
  const { resolved, toggle } = useTheme()

  useEffect(() => saveWeeks(weeks), [weeks])

  const week = activeWeek(weeks)
  const plan = week.plan

  // Every edit lands on the open week, so there is nothing to save by hand.
  const setPlan = (next: WeekPlan) => setWeeks((state) => withActivePlan(state, next))

  // A shorter tab can otherwise open scrolled past its own content.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, openCookId])

  const grocery = useMemo(() => tallyGrocery(dishes, plan), [plan])
  const aisleGroups = useMemo(() => groceryByAisle(grocery), [grocery])
  const shopDishGroups = useMemo(() => groupByDish(dishes, plan), [plan])
  const splits = useMemo(() => splitByIngredient(dishes, plan), [plan])

  const itemCount = grocery.length
  const bought = plan.checkedKeys.length

  function toggleProtein(tag: ProteinTag) {
    setProteins((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function addDish(dish: Dish) {
    if (plan.entries.some((e) => e.dishId === dish.id)) return
    setPlan({
      ...plan,
      entries: [
        ...plan.entries,
        { dishId: dish.id, portions: 2, proteinId: defaultProteinId(dish.proteinOptions) },
      ],
    })
  }

  function removeDish(dishId: string) {
    setPlan({ ...plan, entries: plan.entries.filter((e) => e.dishId !== dishId) })
  }

  function setPortions(dishId: string, portions: number) {
    setPlan({
      ...plan,
      entries: plan.entries.map((e) => (e.dishId === dishId ? { ...e, portions } : e)),
    })
  }

  function setProtein(dishId: string, proteinId: string) {
    setPlan({
      ...plan,
      entries: plan.entries.map((e) => (e.dishId === dishId ? { ...e, proteinId } : e)),
    })
  }

  function toggleBought(key: string) {
    const next = plan.checkedKeys.includes(key)
      ? plan.checkedKeys.filter((k) => k !== key)
      : [...plan.checkedKeys, key]
    setPlan({ ...plan, checkedKeys: next })
  }

  function setNote(dishId: string, note: string) {
    setPlan({ ...plan, notes: { ...(plan.notes ?? {}), [dishId]: note } })
  }

  function hideItem(itemId: string) {
    if (plan.hiddenItemIds.includes(itemId)) return
    setPlan({ ...plan, hiddenItemIds: [...plan.hiddenItemIds, itemId] })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            P
          </div>
          <div>
            <h1>PrepList</h1>
            <button type="button" className="brand-week" onClick={() => setTab('weeks')}>
              {week.name}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <div className="summary">
        <span className="summary-stat">
          <strong>{plan.entries.length}</strong> dishes
        </span>
        <span className="summary-stat">
          <strong>{itemCount}</strong> items
        </span>
        {bought > 0 && (
          <span className="summary-stat">
            <strong>{bought}</strong> bought
          </span>
        )}
        <span className="spacer" />
        {plan.hiddenItemIds.length > 0 && (
          <button
            type="button"
            className="tiny"
            onClick={() => setPlan({ ...plan, hiddenItemIds: [] })}
          >
            Show hidden
          </button>
        )}
        {plan.entries.length > 0 && (
          <button
            type="button"
            className="tiny"
            onClick={() => setPlan({ ...plan, entries: [], checkedKeys: [] })}
          >
            Empty this week
          </button>
        )}
      </div>

      {tab === 'plan' && (
        <PlanPage
          dishes={dishes}
          entries={plan.entries}
          query={query}
          proteins={proteins}
          calories={calories}
          onQuery={setQuery}
          onToggleProtein={toggleProtein}
          onCalories={setCalories}
          onAdd={addDish}
          onRemove={removeDish}
          onPortions={setPortions}
          onProtein={setProtein}
        />
      )}
      {tab === 'shop' && (
        <ShopPage
          view={shopView}
          onView={setShopView}
          groups={aisleGroups}
          dishGroups={shopDishGroups}
          checkedKeys={plan.checkedKeys}
          onToggleBought={toggleBought}
          onHide={hideItem}
        />
      )}
      {tab === 'split' && (
        <SplitPage
          view={splitView}
          onView={setSplitView}
          groups={splits}
          dishes={dishes}
          entries={plan.entries}
        />
      )}
      {tab === 'cook' && (
        <CookPage
          dishes={dishes}
          entries={plan.entries}
          openDishId={openCookId}
          notes={plan.notes ?? {}}
          onOpen={setOpenCookId}
          onNote={setNote}
        />
      )}
      {tab === 'weeks' && (
        <WeeksPage
          weeks={weeksForDisplay(weeks)}
          activeWeekId={weeks.activeWeekId}
          dishes={dishes}
          onOpen={(id) => {
            setWeeks((state) => openWeek(state, id))
            setTab('plan')
          }}
          onRename={(id, name) => setWeeks((state) => renameWeek(state, id, name))}
          onDuplicate={(id) => setWeeks((state) => duplicateWeek(state, id))}
          onDelete={(id) => setWeeks((state) => deleteWeek(state, id))}
          onReset={(id) => setWeeks((state) => resetProgress(state, id))}
          onStartNew={() => {
            setWeeks((state) => startWeek(state))
            setTab('plan')
          }}
        />
      )}

      <nav className="nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id)
              if (id !== 'cook') setOpenCookId(null)
            }}
            aria-current={tab === id}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
