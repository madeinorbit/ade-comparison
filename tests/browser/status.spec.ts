import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { planStatus } from '../../src/lib/status'
import type { StatusEvent } from '../../src/lib/types'

const events: StatusEvent[] = JSON.parse(readFileSync(new URL('../../data/status-log.json', import.meta.url), 'utf8'))
const snapshot = JSON.parse(readFileSync(new URL('../../data/index.json', import.meta.url), 'utf8')).generatedAt
const plan = planStatus(events, snapshot)

test('monthly archives paginate, pass axe and open current findings', async ({ page }) => {
  await page.goto('/status/')
  await page.getByRole('link', { name: plan.months[0].label, exact: true }).click()
  const last = plan.pages.filter(archive => archive.month === plan.months[0].month).at(-1)!
  await page.getByRole('navigation', { name: 'Archive pages' }).getByRole('link', { name: `Page ${last.number}`, exact: true }).click()
  await expect(page).toHaveURL(last.path)
  expect(await page.locator('article.receipt').count()).toBe(last.days.length)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  const article = page.locator('article.receipt').first()
  await article.locator('summary').click()
  const receipt = article.locator('a[href*="/#finding-"]').first()
  const href = await receipt.getAttribute('href')
  await receipt.click()
  await expect(page.locator(`#${href!.split('#')[1]}`)).toBeVisible()
})

test('old status and monthly bookmarks reach receipts after pagination', async ({ page }) => {
  const moved = plan.days.find(day => !plan.recent.some(recent => recent.id === day.id) && day.archivePath.split('/').length > 4)!
  expect(moved).toBeTruthy()
  for (const path of ['/status/', `/status/${moved.date.slice(0, 7)}/`]) {
    await page.goto(`${path}#${moved.id}`)
    await expect(page).toHaveURL(`${moved.archivePath}#${moved.id}`)
    await expect(page.locator(`article[id="${moved.id}"]`)).toBeInViewport()
    await expect(page.locator('h1')).toContainText('status archive')
  }
  await page.goto('/status/')
  await page.evaluate(id => { location.hash = id }, moved.id)
  await expect(page).toHaveURL(`${moved.archivePath}#${moved.id}`)
  await page.goto('/status/#%E0%A4%A')
  await expect(page.locator('h1')).toHaveText('Status and research log')
})

test('archive navigation and legacy fallback links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const moved = plan.days.find(day => !plan.recent.some(recent => recent.id === day.id))!
  await page.goto(`${test.info().project.use.baseURL}/status/#${moved.id}`)
  const fallback = page.locator(`a[href="${moved.archivePath}#${moved.id}"]`)
  if (!await fallback.isVisible()) await page.getByText('Archived event links', { exact: true }).click()
  await fallback.click()
  await expect(page.locator(`article[id="${moved.id}"]`)).toBeInViewport()
  await page.getByRole('link', { name: 'Shutdown notices, recent changes and all monthly archives' }).click()
  await expect(page.locator('h1')).toHaveText('Status and research log')
  await context.close()
})
