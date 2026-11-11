import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { siteConfig } from '../config.mjs'
import { planStatus } from '../src/lib/status.ts'
import type { StatusEvent } from '../src/lib/types.ts'

const dist = new URL('../dist/', import.meta.url)
const html = (path: string) => readFileSync(new URL(path, dist), 'utf8')
const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')) as { products: { id: string; name: string }[] }
const actions = (contents: string) => [...contents.matchAll(/<div\b[^>]*data-submission-actions[^>]*>([\s\S]*?)<\/div>/g)].map(m => m[1])

function checkActions(block: string, contents: string, pagePath: string, product?: { id: string; name: string }, isReceipt = false) {
  if (!siteConfig.publicRepositoryUrl) {
    assert.match(block, /Public correction and ADE suggestion forms are not open yet\./)
    assert.doesNotMatch(block, /<a\b|href=|disabled/)
    return
  }
  const links = [...block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
  assert.deepEqual(links.map(m => m[2]), ['Report wrong data', 'Suggest a missing ADE'])
  for (const [i, link] of links.entries()) {
    const url = new URL(link[1].replace(/&amp;/g, '&'))
    assert.equal(url.origin + url.pathname, `${siteConfig.publicRepositoryUrl}/issues/new`)
    assert.equal(url.searchParams.get('template'), i === 0 ? 'report-wrong-data.yml' : 'suggest-missing-ade.yml')
    assert.equal(url.searchParams.get('product'), i === 0 && product ? product.name : null)
    const context = new URL(url.searchParams.get('context')!.split('\n')[0])
    assert.equal(context.origin, new URL(siteConfig.baseUrl).origin)
    const expectedPage = new URL(pagePath, siteConfig.baseUrl)
    assert.equal(context.pathname, expectedPage.pathname)
    if (expectedPage.hash) assert.equal(context.hash, expectedPage.hash)
    if (isReceipt) {
      assert.ok(context.hash, 'Receipt actions must link to their exact receipt')
      assert.match(url.searchParams.get('context')!, /\nReceipt: .+/)
    }
    if (context.hash) assert.ok(contents.includes(`id="${context.hash.slice(1)}"`), `Missing receipt target ${context.hash}`)
    for (const field of ['public_url', 'exact_sentence', 'wrong', 'reason', 'evidence_check']) assert.equal(url.searchParams.has(field), false)
  }
}

test('every ADE page and receipt renders both configured actions or plain fallback copy', () => {
  for (const product of index.products) {
    const contents = html(`ade/${product.id}/index.html`)
    const blocks = actions(contents)
    const receipts = [...contents.matchAll(/<(?:details|section)\b[^>]*class="receipt"/g)].length
    const lifecycle = [...contents.matchAll(/<article\b[^>]*id="lifecycle-/g)].length
    // Unset, the fallback sentence appears once per page and never on a receipt.
    assert.equal(blocks.length, siteConfig.publicRepositoryUrl ? 1 + receipts + lifecycle : 1, `Wrong actions on ${product.id}`)
    // A shutdown notice renders above the page-level actions, so they follow its block.
    for (const [position, block] of blocks.entries()) checkActions(block, contents, `/ade/${product.id}/`, product, siteConfig.publicRepositoryUrl ? position !== lifecycle : false)
    assert.doesNotMatch(contents, /<script\b[^>]*src="https?:/)
  }
})

test('Method explains evidence, vendor rules and generated corrections beside its actions', () => {
  const contents = html('method/index.html')
  const blocks = actions(contents)
  assert.equal(blocks.length, 1)
  checkActions(blocks[0], contents, '/method/#corrections')
  assert.match(contents, /what is wrong or missing, a public source URL and the exact sentence/)
  if (siteConfig.publicRepositoryUrl) assert.match(contents, /Both actions open GitHub issue forms/)
  else assert.doesNotMatch(contents, /Both actions open|Anyone can report/, 'Method must not describe forms that are not open')
  assert.match(contents, /Word of mouth and private messages are not evidence/)
  assert.match(contents, /Vendors get no exception, including Podium/)
  assert.match(contents, /update the research catalog in <code>research\/<\/code>/)
  assert.match(contents, /data package is generated/)
  assert.doesNotMatch(contents, /private catalog|private repository/)
})

test('status day receipts carry the product and their day anchor', () => {
  const events = JSON.parse(readFileSync(new URL('../data/status-log.json', import.meta.url), 'utf8')) as StatusEvent[]
  const snapshot = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).generatedAt
  const plan = planStatus(events, snapshot)
  for (const page of [{ path: '/status/', days: plan.recent }, ...plan.pages]) {
    const contents = html(`${page.path.slice(1)}index.html`)
    const days = new Set(page.days.map(day => day.id))
    const articles = [...contents.matchAll(/<article\b[^>]*class="receipt"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)]
    assert.equal(articles.length, days.size)
    for (const article of articles) {
      assert.ok(days.has(article[1]), `Unknown status anchor ${article[1]}`)
      const product = index.products.find(p => article[1].endsWith(`-${p.id}`) && article[1].length === p.id.length + 11)!
      assert.ok(product)
      const blocks = actions(article[2])
      assert.equal(blocks.length, siteConfig.publicRepositoryUrl ? 1 : 0, `Wrong status receipt actions on ${article[1]}`)
      if (blocks.length) checkActions(blocks[0], contents, `${page.path}#${article[1]}`, product, true)
    }
  }
})
