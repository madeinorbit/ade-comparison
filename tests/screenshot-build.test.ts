import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Screenshot } from '../src/lib/types.ts'

const shots: Screenshot[] = JSON.parse(readFileSync(new URL('../media/index.json', import.meta.url), 'utf8'))
const products = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).products
const html = (id: string) => readFileSync(new URL(`../dist/ade/${id}/index.html`, import.meta.url), 'utf8')

test('every accepted screenshot renders on its ADE page regardless of research eligibility', () => {
  assert.ok(shots.length > 0, 'The regression requires imported screenshots')
  let listings = 0
  for (const shot of shots) {
    const page = html(shot.productId)
    assert.equal(page.split(`src="/media/${shot.path}"`).length - 1, 1, `Missing or duplicated screenshot for ${shot.productId}`)
    if (products.find((product: { id: string }) => product.id === shot.productId).researchStatus === 'not-researched') {
      listings++
      assert.doesNotMatch(page, /<h2>Typed filters<\/h2>|<h2>Filter receipts<\/h2>|<h2>All public findings<\/h2>/, `Screenshot exposed capabilities for ${shot.productId}`)
    }
  }
  assert.ok(listings > 0, 'The regression requires listing pages with accepted screenshots')
  const unpeel = shots.find(shot => shot.productId === 'unpeel')!
  assert.ok(unpeel, 'Unpeel has an accepted image in this snapshot')
  assert.ok(html('unpeel').includes(`src="/media/${unpeel.path}"`))
})
