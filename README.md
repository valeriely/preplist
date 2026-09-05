# PrepList

Phone-first meal planner for [Prepped](https://www.prepped.com.sg) meal kits: pick a week of dishes, get one tallied grocery list, then work through prep and cooking dish by dish.

## Run

Requires Node 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev
```

Open the URL Vite prints, by default `http://localhost:5174`. The layout is phone-first, so a narrow window or device emulation looks best.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Vitest unit tests |
| `npm run build` | Typecheck, then production build |
| `npm run preview` | Serve the production build |
| `npm run parse` | Regenerate `src/data/dishes.json` from the scraped sources |

`npm run parse` is only needed if you change the parser; the generated data is committed.

## What it does

**Plan** — all 144 scraped dishes as a photo grid, searchable and filterable by protein and calorie band. Unlabelled kits are treated as 1 pax and every dish has a portion stepper defaulting to 2. Where a kit offers a choice of meat, chicken is the default.

**Shop** — one grocery list with quantities summed across every selected dish, so 200g of chicken in one dish and 150g in another becomes a single 350g line. Viewable by aisle or by dish. Sauce packs stay on one line with their components listed, and anything already in the cupboard can be crossed off.

**Prep** — the post-shopping split, by ingredient or by dish, so every portion is labelled with the dish it belongs to.

**Cook** — a method per dish, inferred from the kit's equipment, timing and ingredients and matched to how the dish is conventionally cooked, plus space for your own notes. Prepped ships a printed card with the official steps; these are a reminder, not a replacement.

**Weeks** — weeks behave like documents. One is open at a time and every edit (dishes, portions, ticked-off groceries, cooking notes) saves back into it. Weeks can be named, renamed, duplicated to fork without touching the original, and reset so a week can be shopped again.

Everything is stored in the browser's `localStorage`, so a week does not follow you to another device. There is no backend.

## Layout

```
src/domain/    ingredient parsing, quantity tallying, cook-plan generation, week state
src/pages/     one component per tab
src/data/      generated dish catalogue and image URLs
scripts/       one-off scrapers and the data parser
data/          raw scraped sources
```

Data sources: `data/recipes.raw.json` (from the Prepped spreadsheet) and `data/Prepped_Recipes.md`. Dish photos are hotlinked from Prepped's CDN.
