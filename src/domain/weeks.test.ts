import { describe, expect, it } from 'vitest'
import type { PlanLog, WeekPlan, WeeksState } from '../types'
import { emptyPlan } from './tally'
import {
  activeWeek,
  autoWeekName,
  deleteWeek,
  duplicateWeek,
  emptyWeeksState,
  migrateFromV1,
  normalizePlan,
  normalizeWeeksState,
  openWeek,
  renameWeek,
  resetProgress,
  startWeek,
  weeksForDisplay,
  withActivePlan,
} from './weeks'

const at = (iso: string) => new Date(iso)
// The name follows the reader's locale, so build the expectation the same way
// rather than hardcoding a day/month order.
const expectedName = (iso: string) =>
  `Week of ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

function planWith(dishIds: string[], checked: string[] = []): WeekPlan {
  return {
    ...emptyPlan(),
    entries: dishIds.map((dishId) => ({ dishId, portions: 2, proteinId: null })),
    checkedKeys: checked,
  }
}

function stateWith(...plans: WeekPlan[]): WeeksState {
  let state = emptyWeeksState(at('2026-01-01T00:00:00.000Z'))
  state = withActivePlan(state, plans[0], at('2026-01-01T00:00:00.000Z'))
  for (const [i, plan] of plans.slice(1).entries()) {
    const when = at(`2026-01-0${i + 2}T00:00:00.000Z`)
    state = startWeek(state, when)
    state = withActivePlan(state, plan, when)
  }
  return state
}

describe('emptyWeeksState', () => {
  it('always opens with exactly one empty week', () => {
    const state = emptyWeeksState(at('2026-09-05T00:00:00.000Z'))
    expect(state.weeks).toHaveLength(1)
    expect(state.activeWeekId).toBe(state.weeks[0].id)
    expect(activeWeek(state).plan.entries).toEqual([])
    expect(activeWeek(state).name).toBe(expectedName('2026-09-05T00:00:00.000Z'))
  })
})

describe('withActivePlan', () => {
  it('writes edits back into the open week', () => {
    const state = withActivePlan(emptyWeeksState(), planWith(['black-pepper-beef']))
    expect(activeWeek(state).plan.entries.map((e) => e.dishId)).toEqual(['black-pepper-beef'])
  })

  it('leaves the other weeks untouched', () => {
    const state = stateWith(planWith(['a']), planWith(['b']))
    const edited = withActivePlan(state, planWith(['b', 'c']))
    const first = weeksForDisplay(edited).find((w) => w.id !== edited.activeWeekId)
    expect(first?.plan.entries.map((e) => e.dishId)).toEqual(['a'])
  })

  it('bumps updatedAt so the open week sorts to the top', () => {
    const state = stateWith(planWith(['a']), planWith(['b']))
    const oldest = weeksForDisplay(state)[weeksForDisplay(state).length - 1]
    const reopened = withActivePlan(
      openWeek(state, oldest.id),
      planWith(['a', 'z']),
      at('2026-12-31T00:00:00.000Z'),
    )
    expect(weeksForDisplay(reopened)[0].id).toBe(oldest.id)
  })
})

describe('openWeek', () => {
  it('makes an existing week the open one', () => {
    const state = stateWith(planWith(['a']), planWith(['b']))
    const target = state.weeks[0]
    expect(activeWeek(openWeek(state, target.id)).id).toBe(target.id)
  })

  it('ignores an unknown id rather than leaving nothing open', () => {
    const state = emptyWeeksState()
    expect(openWeek(state, 'nope')).toEqual(state)
  })

  it('keeps the plan intact when reopened, including shopping progress', () => {
    const state = stateWith(planWith(['a'], ['chicken']), planWith(['b']))
    const first = state.weeks[0]
    const reopened = openWeek(state, first.id)
    expect(activeWeek(reopened).plan.checkedKeys).toEqual(['chicken'])
  })
})

describe('renameWeek', () => {
  it('renames the week', () => {
    const state = emptyWeeksState()
    const renamed = renameWeek(state, state.activeWeekId, '  Chinese New Year  ')
    expect(activeWeek(renamed).name).toBe('Chinese New Year')
  })

  it('falls back to a date name when cleared', () => {
    const state = emptyWeeksState(at('2026-09-05T00:00:00.000Z'))
    const renamed = renameWeek(state, state.activeWeekId, '   ')
    expect(activeWeek(renamed).name).toBe(expectedName('2026-09-05T00:00:00.000Z'))
  })
})

describe('duplicateWeek', () => {
  it('forks a week and opens the copy', () => {
    const state = withActivePlan(emptyWeeksState(), planWith(['a']))
    const forked = duplicateWeek(state, state.activeWeekId)
    expect(forked.weeks).toHaveLength(2)
    expect(activeWeek(forked).name).toMatch(/\(copy\)$/)
    expect(activeWeek(forked).plan.entries.map((e) => e.dishId)).toEqual(['a'])
  })

  it('leaves the original alone when the copy is edited', () => {
    const state = withActivePlan(emptyWeeksState(), planWith(['a']))
    const sourceId = state.activeWeekId
    const edited = withActivePlan(duplicateWeek(state, sourceId), planWith(['a', 'b']))
    const source = edited.weeks.find((w) => w.id === sourceId)
    expect(source?.plan.entries.map((e) => e.dishId)).toEqual(['a'])
  })
})

describe('deleteWeek', () => {
  it('opens another week when the open one is deleted', () => {
    const state = stateWith(planWith(['a']), planWith(['b']))
    const left = deleteWeek(state, state.activeWeekId)
    expect(left.weeks).toHaveLength(1)
    expect(left.activeWeekId).toBe(left.weeks[0].id)
  })

  it('never leaves zero weeks', () => {
    const state = emptyWeeksState()
    const left = deleteWeek(state, state.activeWeekId)
    expect(left.weeks).toHaveLength(1)
    expect(left.weeks[0].plan.entries).toEqual([])
  })
})

describe('resetProgress', () => {
  it('clears ticks and hidden items so a week can be shopped again', () => {
    let state = withActivePlan(emptyWeeksState(), {
      ...planWith(['a'], ['chicken', 'onion']),
      hiddenItemIds: ['salt'],
    })
    state = resetProgress(state, state.activeWeekId)
    expect(activeWeek(state).plan.checkedKeys).toEqual([])
    expect(activeWeek(state).plan.hiddenItemIds).toEqual([])
    expect(activeWeek(state).plan.entries).toHaveLength(1)
  })
})

describe('normalizePlan', () => {
  it('backfills lists missing from an older plan', () => {
    const plan = normalizePlan({ schemaVersion: 1, entries: [{ dishId: 'a', portions: 2 }] })
    expect(plan.hiddenItemIds).toEqual([])
    expect(plan.checkedKeys).toEqual([])
  })

  it('drops junk entries and survives rubbish input', () => {
    expect(normalizePlan({ entries: [null, { portions: 2 }, { dishId: 'a', portions: 1 }] }).entries)
      .toHaveLength(1)
    expect(normalizePlan(null).entries).toEqual([])
    expect(normalizePlan('nonsense').entries).toEqual([])
  })
})

describe('normalizeWeeksState', () => {
  it('rejects anything that is not a v2 state', () => {
    expect(normalizeWeeksState(null)).toBeNull()
    expect(normalizeWeeksState({ schemaVersion: 1, weeks: [] })).toBeNull()
    expect(normalizeWeeksState({ schemaVersion: 2, weeks: [] })).toBeNull()
  })

  it('repairs a dangling active id instead of opening nothing', () => {
    const state = normalizeWeeksState({
      schemaVersion: 2,
      activeWeekId: 'gone',
      weeks: [{ id: 'w1', name: 'One', createdAt: 'x', updatedAt: 'x', plan: emptyPlan() }],
    })
    expect(state?.activeWeekId).toBe('w1')
  })

  it('round-trips a state it wrote itself', () => {
    const state = withActivePlan(emptyWeeksState(), planWith(['a'], ['chicken']))
    expect(normalizeWeeksState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })
})

describe('migrateFromV1', () => {
  const logs: PlanLog[] = [
    {
      id: 'log-1',
      savedAt: '2026-08-01T10:00:00.000Z',
      title: 'Sat, Aug 1 · 3 dishes',
      snapshot: planWith(['a', 'b', 'c']),
    },
    {
      id: 'log-2',
      savedAt: '2026-08-20T10:00:00.000Z',
      title: 'Thu, Aug 20 · 1 dishes',
      snapshot: planWith(['d']),
    },
  ]

  it('keeps every saved log as a reopenable week', () => {
    const state = migrateFromV1(planWith(['live']), logs, at('2026-09-05T00:00:00.000Z'))
    expect(state.weeks).toHaveLength(3)
    expect(state.weeks.map((w) => w.id)).toContain('log-1')
    expect(state.weeks.map((w) => w.id)).toContain('log-2')
  })

  it('leaves the half-finished live plan open', () => {
    const state = migrateFromV1(planWith(['live']), logs, at('2026-09-05T00:00:00.000Z'))
    expect(activeWeek(state).plan.entries.map((e) => e.dishId)).toEqual(['live'])
    expect(activeWeek(state).name).toBe(expectedName('2026-09-05T00:00:00.000Z'))
  })

  it('drops the stale dish count out of migrated names', () => {
    const state = migrateFromV1(planWith([]), logs, at('2026-09-05T00:00:00.000Z'))
    const migrated = state.weeks.find((w) => w.id === 'log-1')
    expect(migrated?.name).toBe('Sat, Aug 1')
  })

  it('opens the most recent log when there was no live plan', () => {
    const state = migrateFromV1(planWith([]), logs, at('2026-09-05T00:00:00.000Z'))
    expect(state.weeks).toHaveLength(2)
    expect(activeWeek(state).id).toBe('log-2')
  })

  it('starts fresh when there is nothing at all to migrate', () => {
    const state = migrateFromV1(null, null, at('2026-09-05T00:00:00.000Z'))
    expect(state.weeks).toHaveLength(1)
    expect(activeWeek(state).plan.entries).toEqual([])
  })

  it('preserves shopping progress stored in a log', () => {
    const state = migrateFromV1(
      null,
      [{ ...logs[0], snapshot: planWith(['a'], ['chicken']) }],
      at('2026-09-05T00:00:00.000Z'),
    )
    expect(state.weeks[0].plan.checkedKeys).toEqual(['chicken'])
  })
})

describe('autoWeekName', () => {
  it('names a week after its date', () => {
    expect(autoWeekName(at('2026-09-05T00:00:00.000Z'))).toBe(
      expectedName('2026-09-05T00:00:00.000Z'),
    )
  })
})
