import type { WeeksState } from './types'
import { emptyWeeksState, migrateFromV1, normalizeWeeksState } from './domain/weeks'

const WEEKS_KEY = 'preplist.weeks.v2'
// Written by the first release. Read once to migrate, then left in place so
// rolling back to an older build does not lose anything.
const PLAN_KEY = 'preplist.week.v1'
const LOGS_KEY = 'preplist.logs.v1'

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadWeeks(): WeeksState {
  const stored = normalizeWeeksState(readJson(WEEKS_KEY))
  if (stored) return stored

  const legacyPlan = readJson(PLAN_KEY)
  const legacyLogs = readJson(LOGS_KEY)
  if (legacyPlan || legacyLogs) return migrateFromV1(legacyPlan, legacyLogs)

  return emptyWeeksState()
}

export function saveWeeks(state: WeeksState) {
  try {
    localStorage.setItem(WEEKS_KEY, JSON.stringify(state))
  } catch {
    // A full or blocked storage quota should not take the app down mid-edit.
  }
}
