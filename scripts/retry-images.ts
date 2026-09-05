import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(join(root, 'data/recipes.raw.json'), 'utf8')) as {
  name: string
  url: string
}[]
const imagesPath = join(root, 'src/data/images.json')
const imgs = JSON.parse(readFileSync(imagesPath, 'utf8')) as Record<
  string,
  { handle: string; image: string; thumb: string }
>

function sized(src: string, width: number): string {
  return src.split('?')[0].replace(/(\.(?:jpe?g|png|webp|avif))$/i, `_${width}x$1`)
}

for (const row of raw) {
  const handle = row.url.split('/products/')[1]?.split(/[?#]/)[0]
  if (!handle || imgs[handle]) continue
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://www.prepped.com.sg/products/${handle}.json`, {
      headers: { 'user-agent': 'preplist-image-fetch' },
    })
    if (res.ok) {
      const data = (await res.json()) as {
        product?: { images?: { src: string }[]; image?: { src: string } }
      }
      const src = data.product?.images?.[0]?.src ?? data.product?.image?.src
      if (src) {
        imgs[handle] = { handle, image: sized(src, 800), thumb: sized(src, 400) }
        console.log('ok', handle)
      }
      break
    }
    console.log('retry', handle, res.status)
    await new Promise((r) => setTimeout(r, attempt * 5000))
  }
}

writeFileSync(imagesPath, JSON.stringify(imgs, null, 2))
console.log('total', Object.keys(imgs).length)
