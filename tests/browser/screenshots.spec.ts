import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const shots = JSON.parse(readFileSync(new URL('../../media/index.json', import.meta.url), 'utf8'))
const products = JSON.parse(readFileSync(new URL('../../data/index.json', import.meta.url), 'utf8')).products
const listing = shots.find((shot: { productId: string }) => products.find((product: { id: string }) => product.id === shot.productId).researchStatus === 'not-researched').productId

test('listing and Unpeel screenshots load without JavaScript while listing capabilities stay hidden', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  for (const id of [listing, 'unpeel']) {
    await page.goto(`/ade/${id}/`)
    const image = page.locator('figure.shot img')
    await image.scrollIntoViewIfNeeded()
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    if (id === listing) {
      await expect(page.getByRole('heading', { name: 'Typed filters', exact: true })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'All public findings', exact: true })).toHaveCount(0)
    }
  }
  await context.close()
})
