import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(join(root, 'data/recipes.raw.json'), 'utf8')) as {
  name: string
  url: string
}[]

interface ShopifyProduct {
  product?: {
    handle: string
    images?: { src: string }[]
    image?: { src: string }
  }
}

/** Shopify serves resized variants via a width suffix before the extension. */
function sized(src: string, width: number): string {
  const clean = src.split('?')[0]
  return clean.replace(/(\.(?:jpe?g|png|webp|avif))$/i, `_${width}x$1`)
}

const out: Record<string, { handle: string; image: string; thumb: string }> = {}
const missing: string[] = []

for (const row of raw) {
  const handle = row.url.split('/products/')[1]?.split(/[?#]/)[0]
  if (!handle) {
    missing.push(row.name)
    continue
  }
  try {
    const res = await fetch(`https://www.prepped.com.sg/products/${handle}.json`, {
      headers: { 'user-agent': 'preplist-image-fetch' },
    })
    if (!res.ok) throw new Error(`http ${res.status}`)
    const data = (await res.json()) as ShopifyProduct
    const src = data.product?.images?.[0]?.src ?? data.product?.image?.src
    if (!src) {
      missing.push(row.name)
      continue
    }
    out[handle] = { handle, image: sized(src, 800), thumb: sized(src, 400) }
  } catch (err) {
    missing.push(`${row.name} (${(err as Error).message})`)
  }
  await new Promise((r) => setTimeout(r, 120))
}

writeFileSync(join(root, 'src/data/images.json'), JSON.stringify(out, null, 2))
console.log(`Fetched ${Object.keys(out).length} images`)
if (missing.length) console.log(`Missing (${missing.length}):`, missing.slice(0, 20))
