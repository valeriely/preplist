import type { PlanLog, SavedWeek, WeekPlan, WeeksState } from '../types'
import { emptyPlan } from './tally'

/**
 * Weeks behave like documents: one is open at a time, and editing the plan
 * writes straight back into it. There is always at least one week, so the app
 * never has to cope with "no plan open".
 */

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `w-${Math.random().toString(36).slice(2, 10)}`
}

export function autoWeekName(now = new Date()): string {
  const date = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `Week of ${date}`
}

export function emptyWeek(name?: string, now = new Date()): SavedWeek {
  const stamp = now.toISOString()
  return {
    id: newId(),
    name: name ?? autoWeekName(now),
    createdAt: stamp,
    updatedAt: stamp,
    plan: emptyPlan(),
  }
}

export function emptyWeeksState(now = new Date()): WeeksState {
  const week = emptyWeek(undefined, now)
  return { schemaVersion: 2, weeks: [week], activeWeekId: week.id }
}

export function activeWeek(state: WeeksState): SavedWeek {
  return state.weeks.find((w) => w.id === state.activeWeekId) ?? state.weeks[0]
}

/** Most recently touched first, which keeps the open week near the top. */
export function weeksForDisplay(state: WeeksState): SavedWeek[] {
  return [...state.weeks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function withActivePlan(state: WeeksState, plan: WeekPlan, now = new Date()): WeeksState {
  const id = activeWeek(state).id
  return {
    ...state,
    weeks: state.weeks.map((w) =>
      w.id === id ? { ...w, plan, updatedAt: now.toISOString() } : w,
    ),
  }
}

export function openWeek(state: WeeksState, id: string): WeeksState {
  if (!state.weeks.some((w) => w.id === id)) return state
  return { ...state, activeWeekId: id }
}

export function renameWeek(state: WeeksState, id: string, name: string): WeeksState {
  const trimmed = name.trim()
  return {
    ...state,
    weeks: state.weeks.map((w) =>
      w.id === id ? { ...w, name: trimmed || autoWeekName(new Date(w.createdAt)) } : w,
    ),
  }
}

export function startWeek(state: WeeksState, now = new Date()): WeeksState {
  const week = emptyWeek(undefined, now)
  return { ...state, weeks: [...state.weeks, week], activeWeekId: week.id }
}

/**
 * Forks a week so an old one can be reused without editing the original,
 * which is the only way to keep history intact under open-in-place.
 */
export function duplicateWeek(state: WeeksState, id: string, now = new Date()): WeeksState {
  const source = state.weeks.find((w) => w.id === id)
  if (!source) return state
  const copy: SavedWeek = {
    id: newId(),
    name: `${source.name} (copy)`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    plan: structuredClone(source.plan),
  }
  return { ...state, weeks: [...state.weeks, copy], activeWeekId: copy.id }
}

export function deleteWeek(state: WeeksState, id: string, now = new Date()): WeeksState {
  const weeks = state.weeks.filter((w) => w.id !== id)
  if (weeks.length === 0) return emptyWeeksState(now)
  const activeWeekId =
    state.activeWeekId === id
      ? weeksForDisplay({ ...state, weeks })[0].id
      : state.activeWeekId
  return { ...state, weeks, activeWeekId }
}

/** Clears the shopping ticks so a reopened week can be shopped again. */
export function resetProgress(state: WeeksState, id: string, now = new Date()): WeeksState {
  return {
    ...state,
    weeks: state.weeks.map((w) =>
      w.id === id
        ? { ...w, plan: { ...w.plan, checkedKeys: [], hiddenItemIds: [] }, updatedAt: now.toISOString() }
        : w,
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Reading stored data
 * ------------------------------------------------------------------ */

/**
 * A plan written by an older build can be missing a list. Backfill rather than
 * hand back a half-built object, which crashes the app on render and leaves no
 * way to clear the bad value.
 */
function numberRecord(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out[key] = Math.round(value)
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function normalizePlan(raw: unknown): WeekPlan {
  const plan = (raw ?? {}) as Partial<WeekPlan>
  if (!Array.isArray(plan.entries)) return emptyPlan()
  return {
    ...emptyPlan(),
    ...plan,
    schemaVersion: 1,
    entries: plan.entries.filter(
      (e): e is WeekPlan['entries'][number] => !!e && typeof e.dishId === 'string',
    ),
    hiddenItemIds: Array.isArray(plan.hiddenItemIds) ? plan.hiddenItemIds : [],
    checkedKeys: Array.isArray(plan.checkedKeys) ? plan.checkedKeys : [],
    cookedGrams: numberRecord(plan.cookedGrams),
  }
}

function normalizeWeek(raw: unknown, now: Date): SavedWeek | null {
  const week = (raw ?? {}) as Partial<SavedWeek>
  if (typeof week.id !== 'string' || !week.id) return null
  const stamp = now.toISOString()
  return {
    id: week.id,
    name: typeof week.name === 'string' && week.name.trim() ? week.name : autoWeekName(now),
    createdAt: typeof week.createdAt === 'string' ? week.createdAt : stamp,
    updatedAt: typeof week.updatedAt === 'string' ? week.updatedAt : stamp,
    plan: normalizePlan(week.plan),
  }
}

export function normalizeWeeksState(raw: unknown, now = new Date()): WeeksState | null {
  const state = (raw ?? {}) as Partial<WeeksState>
  if (state.schemaVersion !== 2 || !Array.isArray(state.weeks)) return null
  const weeks = state.weeks
    .map((w) => normalizeWeek(w, now))
    .filter((w): w is SavedWeek => w !== null)
  if (weeks.length === 0) return null
  const activeWeekId = weeks.some((w) => w.id === state.activeWeekId)
    ? (state.activeWeekId as string)
    : weeksForDisplay({ schemaVersion: 2, weeks, activeWeekId: weeks[0].id })[0].id
  return { schemaVersion: 2, weeks, activeWeekId }
}

/** Log titles embedded a dish count that goes stale once the week is edited. */
function nameFromLogTitle(title: string, now: Date): string {
  const stripped = title.replace(/\s*·\s*\d+\s+dishes?\s*$/i, '').trim()
  return stripped || autoWeekName(now)
}

/**
 * Turns the first release's single live plan plus its frozen logs into named
 * weeks. The live plan stays open so nobody loses the week they were mid-way
 * through, and every log becomes a week that can be reopened.
 */
export function migrateFromV1(
  rawPlan: unknown,
  rawLogs: unknown,
  now = new Date(),
): WeeksState {
  const logs = (Array.isArray(rawLogs) ? rawLogs : []) as PlanLog[]
  const weeks: SavedWeek[] = []

  for (const log of logs) {
    if (!log || typeof log.id !== 'string') continue
    const savedAt = typeof log.savedAt === 'string' ? log.savedAt : now.toISOString()
    weeks.push({
      id: log.id,
      name: nameFromLogTitle(typeof log.title === 'string' ? log.title : '', new Date(savedAt)),
      createdAt: savedAt,
      updatedAt: savedAt,
      plan: normalizePlan(log.snapshot),
    })
  }

  const live = normalizePlan(rawPlan)
  const hasLivePlan = live.entries.length > 0
  if (hasLivePlan || weeks.length === 0) {
    const current = emptyWeek(autoWeekName(now), now)
    current.plan = live
    weeks.push(current)
    return { schemaVersion: 2, weeks, activeWeekId: current.id }
  }

  const state = { schemaVersion: 2 as const, weeks, activeWeekId: weeks[0].id }
  return { ...state, activeWeekId: weeksForDisplay(state)[0].id }
}
