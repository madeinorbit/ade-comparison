import { test, expect } from '@playwright/test'
import { siteConfig } from '../../config.mjs'
const origin = `http://127.0.0.1:${process.env.ADE_COMPARISON_TEST_PORT || 4329}`

test('submission actions and fallback work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const outside: string[] = []
  page.on('request', request => { if (!request.url().startsWith(origin)) outside.push(request.url()) })
  for (const path of ['/ade/podium/', '/ade/codex/', '/method/']) {
    await page.goto(origin + path)
    const actions = page.locator('[data-submission-actions]').first()
    if (siteConfig.publicRepositoryUrl) {
      const report = actions.getByRole('link', { name: 'Report wrong data', exact: true })
      const suggest = actions.getByRole('link', { name: 'Suggest a missing ADE', exact: true })
      await expect(report).toBeVisible()
      await expect(suggest).toBeVisible()
      const params = new URL((await suggest.getAttribute('href'))!).searchParams
      expect(params.has('product')).toBe(false)
      expect(new URL(params.get('context')!.split('\n')[0]).pathname).toBe(path)
      await report.focus()
      await expect(report).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(suggest).toBeFocused()
      if (path === '/ade/podium/') {
        const receipt = page.locator('details.receipt').first()
        await receipt.locator('summary').click()
        const link = receipt.getByRole('link', { name: 'Report wrong data', exact: true })
        await expect(link).toBeVisible()
        const receiptParams = new URL((await link.getAttribute('href'))!).searchParams
        const target = new URL(receiptParams.get('context')!.split('\n')[0])
        expect(target.hash).toMatch(/^#receipt-/)
        await expect(page.locator(target.hash)).toBeVisible()
      }
    } else {
      await expect(actions).toHaveText('Public correction and ADE suggestion forms are not open yet.')
      await expect(page.getByRole('link', { name: 'Report wrong data', exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Suggest a missing ADE', exact: true })).toHaveCount(0)
    }
  }
  await page.goto(origin + '/status/')
  const event = page.locator('article.receipt').first()
  if (await event.count()) {
    await event.locator('summary').click()
    const actions = event.locator('[data-submission-actions]')
    if (siteConfig.publicRepositoryUrl) {
      const report = actions.getByRole('link', { name: 'Report wrong data', exact: true })
      await expect(report).toBeVisible()
      await expect(actions.getByRole('link', { name: 'Suggest a missing ADE', exact: true })).toBeVisible()
      const params = new URL((await report.getAttribute('href'))!).searchParams
      const target = new URL(params.get('context')!.split('\n')[0])
      expect(target.pathname).toBe('/status/')
      expect(target.hash).toBe(`#${await event.getAttribute('id')}`)
    } else {
      await expect(actions).toHaveCount(0)
    }
  }
  expect(outside).toEqual([])
  await context.close()
})
