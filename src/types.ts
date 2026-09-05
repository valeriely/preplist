export type Aisle = 'meat' | 'seafood' | 'produce' | 'dairy' | 'bakery' | 'pantry'
export type ItemKind = 'fresh' | 'pantry' | 'sauce-pack'
export type DishSource = 'kit' | 'festive' | 'other'
export type ProteinTag = 'chicken' | 'pork' | 'beef' | 'seafood' | 'veggie'
export type CookMethod =
  | 'pan'
  | 'pot'
  | 'oven'
  | 'steamer'
  | 'pan-pot'
  | 'oven-pan'
  | 'steamer-pan'
  | 'air-fryer'
  | 'blender'

export interface CookStep {
  title: string
  detail: string
  minutes: number | null
}

export interface ProteinOption {
  id: string
  label: string
}

export interface Quantity {
  amount: number | null
  unit: string | null
  raw: string
  min?: number
  max?: number
}

export interface DishIngredient {
  itemId: string
  name: string
  recipeText: string
  quantity: Quantity
  aisle: Aisle
  kind: ItemKind
  isProteinSlot?: boolean
  sauceId?: string
}

export interface SaucePack {
  id: string
  label: string
  quantity: Quantity
  components: { itemId: string; name: string }[]
}

export interface Dish {
  id: string
  name: string
  source: DishSource
  servingsBase: number
  time: string
  timeMinutes: number | null
  calories: string
  caloriesKcal: number | null
  equipment: string
  method: CookMethod
  effortHats: number | null
  spice: string
  chillis: number | null
  allergy: string
  url: string
  image: string | null
  thumb: string | null
  proteinTag: ProteinTag
  description: string
  proteinOptions: ProteinOption[]
  defaultProteinId: string | null
  ingredients: DishIngredient[]
  sauces: SaucePack[]
}

export interface PlanEntry {
  dishId: string
  portions: number
  proteinId: string | null
}

export interface WeekPlan {
  schemaVersion: 1
  entries: PlanEntry[]
  hiddenItemIds: string[]
  checkedKeys: string[]
  notes?: Record<string, string>
}

/** A week you can reopen. Edits to the open week save back into it. */
export interface SavedWeek {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  plan: WeekPlan
}

export interface WeeksState {
  schemaVersion: 2
  weeks: SavedWeek[]
  activeWeekId: string
}

/** Shape written by the first release, still read when migrating. */
export interface PlanLog {
  id: string
  savedAt: string
  title: string
  snapshot: WeekPlan
}

export interface Contribution {
  dishId: string
  dishName: string
  quantity: Quantity
}

export interface GroceryComponent {
  itemId: string
  name: string
}

export interface GroceryLine {
  key: string
  itemId: string
  name: string
  aisle: Aisle
  kind: ItemKind
  quantity: Quantity
  contributions: Contribution[]
  /** Sauce-pack breakdown so Shop can show what to buy, not just "Sauce". */
  components?: GroceryComponent[]
}

export interface DishGroup {
  dishId: string
  dishName: string
  portions: number
  time: string
  calories: string
  thumb: string | null
  proteinLabel: string | null
  lines: GroceryLine[]
  sauces: SaucePack[]
}

export interface SplitGroup {
  itemId: string
  name: string
  aisle: Aisle
  kind: ItemKind
  total: Quantity
  allocations: Contribution[]
}
