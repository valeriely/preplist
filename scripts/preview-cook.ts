import dishesJson from '../src/data/dishes.json'
import { cookSteps } from '../src/domain/cookPlan.ts'
import { resolveDish } from '../src/domain/tally.ts'
import type { Dish } from '../src/types.ts'

const dishes = dishesJson as Dish[]
const names = process.argv.slice(2)
const picks = names.length
  ? names.map((n) => dishes.find((d) => d.name.toLowerCase().includes(n.toLowerCase()))!)
  : dishes.slice(0, 3)

for (const d of picks) {
  const r = resolveDish(d, { dishId: d.id, portions: 2, proteinId: d.defaultProteinId })
  console.log(`\n=== ${d.name} [${d.equipment} -> ${d.method}, ${d.time}] ===`)
  cookSteps(r).forEach((s, i) =>
    console.log(`${i + 1}. ${s.title}${s.minutes != null ? ` (~${s.minutes}m)` : ''}: ${s.detail}`),
  )
}
