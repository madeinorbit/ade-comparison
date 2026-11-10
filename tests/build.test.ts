import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { requirementsFrom } from '../src/lib/filter.ts'
import { siteConfig } from '../config.mjs'
import { planStatus, statusPageSize } from '../src/lib/status.ts'
import type { StatusEvent } from '../src/lib/types.ts'
const dist = new URL('../dist/', import.meta.url)
const text = (path: string) => readFileSync(new URL(path, dist), 'utf8')
const home = text('index.html')
const notices = JSON.parse(readFileSync(new URL('../data/lifecycle-notices.json', import.meta.url), 'utf8'))
test('home HTML and every loaded CSS/JS chunk total under 50 KB compressed', () => {
  const files = new Set(['index.html'])
  function visit(path: string) {
    if (files.has(path)) return
    files.add(path)
    const contents = text(path)
    if (path.endsWith('.js')) for (const match of contents.matchAll(/["'](\.?\.?\/[^"']+\.(?:js|css))["']/g)) {
      const child = new URL(match[1], new URL(path, dist)).pathname.slice(dist.pathname.length)
      visit(child)
    }
  }
  for (const m of home.matchAll(/(?:src|href)="(\/_astro\/[^"']+\.(?:js|css))"/g)) visit(m[1].slice(1))
  const gzip = [...files].reduce((n, f) => n + gzipSync(text(f)).length, 0)
  const brotli = [...files].reduce((n, f) => n + brotliCompressSync(text(f)).length, 0)
  assert.ok(files.size > 2, 'Must include emitted JS and CSS, not just HTML')
  assert.ok(gzip < 50_000, `Home budget ${gzip} gzip bytes`)
  assert.ok(brotli < 50_000, `Home budget ${brotli} Brotli bytes`)
  console.log(`Home: ${gzip} bytes gzip; ${brotli} bytes Brotli; ${files.size} files; images excluded.`)
})
test('structured dataset, canonical URLs and sitemap use the configurable origin', () => {
  const tag = home.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)!
  const dataset = JSON.parse(tag[1])
  assert.equal(dataset['@type'], 'Dataset'); assert.equal(dataset.creator.name, 'Podium')
  assert.match(home, /rel="canonical" href="https?:\/\//)
  assert.ok(home.includes(`rel="canonical" href="${siteConfig.baseUrl.replace(/\/$/, '')}/"`))
  const sitemap = text('sitemap.xml')
  assert.match(sitemap, /<loc>https?:\/\//); assert.match(sitemap, /\/method\//)
  assert.doesNotMatch(sitemap, /\?products|\?use=/)
})
test('all identities are rendered and plain listings have no claims', () => {
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  for (const p of index.products) {
    assert.ok(home.includes(`href="/ade/${p.id}/"`), `Missing SSR result ${p.id}`)
    const html = text(`ade/${p.id}/index.html`)
    assert.match(html, /Made by Podium, an ADE vendor/)
    const noticed = notices.some((n: { productId: string }) => n.productId === p.id)
    if (p.researchStatus === 'covered' || noticed) assert.ok(html.includes(`og/${p.id}.png`), 'Per-product sharing card')
    if (p.researchStatus === 'not-researched') {
      assert.doesNotMatch(html, /Typed filters|All public findings/)
      // Plain listings are thin by design: reachable, but not search pages.
      assert.equal(/name="robots" content="noindex/.test(html), !noticed, `Index state of ${p.id}`)
      assert.equal(text('sitemap.xml').includes(`/ade/${p.id}/<`), noticed, `Sitemap state of ${p.id}`)
    }
  }
})
test('generated pairs require enough evidence on both sides and match sitemap entries', () => {
  const root = new URL('../data/products/', import.meta.url)
  const products = readdirSync(root).map(file => JSON.parse(readFileSync(new URL(file, root), 'utf8')))
  const answers = (p: any) => Object.fromEntries(Object.entries(p.facets).filter(([key]) => key !== 'lifecycle-status').flatMap(([key, v]: [string, any]) => 'value' in v ? [[key, v.value]] : Object.entries(v).map(([o, c]: [string, any]) => [`${key}:${o}`, c.value])).filter(([, value]) => value !== 'unknown'))
  const enough = products.filter(p => p.researchStatus === 'covered' && p.sourcedClaimCount >= 20 && Object.keys(answers(p)).length > 0)
  const shared = (a: any, b: any) => Object.keys(answers(a)).filter(key => key in answers(b)).length
  const expected = new Set(enough.flatMap((a, i) => enough.slice(i + 1).filter(b => shared(a, b) >= 6).map(b => [a.id, b.id].sort().join('-vs-'))))
  const actual = readdirSync(new URL('compare/', dist), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  assert.deepEqual(new Set(actual), expected)
  for (const slug of actual) assert.ok(text('sitemap.xml').includes(`/compare/${slug}/`))
})
test('every local href, image and fragment in generated HTML resolves', () => {
  const walk = (root: URL, prefix = ''): string[] => readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(new URL(e.name + '/', root), prefix + e.name + '/') : e.name.endsWith('.html') ? [prefix + e.name] : [])
  const cache = new Map<string, string>()
  for (const file of walk(dist)) {
    const html = text(file)
    for (const m of html.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
      const href = m[1].replace(/&amp;/g, '&')
      if (!href.startsWith('/') && !href.startsWith('#')) continue
      const url = new URL(href, 'https://test.invalid/' + file)
      let path = decodeURIComponent(url.pathname).slice(1)
      if (!path || path.endsWith('/')) path += 'index.html'
      assert.ok(existsSync(new URL(path, dist)), `Broken ${file} -> ${href}`)
      if (url.hash) {
        const contents = cache.get(path) || text(path); cache.set(path, contents)
        assert.ok(contents.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Broken fragment ${file} -> ${href}`)
      }
    }
  }
})
test('a shutdown notice comes first on its ADE page and in the agent files', () => {
  assert.ok(notices.length >= 2)
  for (const notice of notices) {
    const html = text(`ade/${notice.productId}/index.html`), body = html.slice(html.indexOf('<main'))
    for (const before of ['Product website', '<figure', 'current public findings', 'Not researched yet']) {
      const at = body.indexOf(before)
      assert.ok(at === -1 || body.indexOf('id="lifecycle"') < at, `${notice.productId}: notice must precede ${before}`)
    }
    const serviceEnd = notice.serviceEndDate || 'Not specified'
    assert.ok(body.includes(serviceEnd), 'Service end date on the page')
    assert.match(html.match(/<title>[^<]+/)![0], /shutdown notice/)
    assert.match(html, /<meta name="description" content="[^"]*shutdown notice/)
    assert.equal(JSON.parse(text(`products/${notice.productId}.json`)).lifecycleNotice.serviceEndDate, notice.serviceEndDate)
    assert.ok(text(`products/${notice.productId}.md`).includes(serviceEnd))
    assert.match(text('llms.txt'), new RegExp(`/products/${notice.productId}\\.md\\): [a-z-]+; published shutdown notice`))
  }
})
test('comparisons carry a shutdown link and pair pages hold only their two products', () => {
  const pair = readdirSync(new URL('compare/', dist)).find(name => notices.some((n: { productId: string }) => name.split('-vs-').includes(n.productId)) && name.includes('-vs-'))!
  const html = text(`compare/${pair}/index.html`)
  assert.match(html, /has a published shutdown notice/)
  assert.equal(new Set([...html.matchAll(/<th scope="col" data-column-id="([^"]+)"/g)].map(m => m[1])).size, 2)
  assert.match(text('matrix/index.html'), /aria-label="Conductor shutdown notice"/)
  assert.ok(gzipSync(html).length < 12_000, 'Pair page stays small')
})
test('structured data: one Dataset on the home page, WebPage elsewhere', () => {
  const ld = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)![1])
  assert.equal(ld(home)['@type'], 'Dataset')
  const page = ld(text('ade/conductor/index.html'))
  assert.equal(page['@type'], 'WebPage'); assert.equal(page.about.name, 'Conductor'); assert.equal(page.publisher.name, 'Podium')
  assert.equal(ld(text('method/index.html'))['@type'], 'WebPage')
})
test('titles and descriptions are unique on indexed pages', () => {
  const urls = [...text('sitemap.xml').matchAll(/<loc>[^<]+?\/\/[^/]+\/([^<]*)<\/loc>/g)].map(m => m[1])
  const seen = new Map<string, string>()
  for (const url of urls) {
    const html = text(`${url}index.html`)
    for (const value of [html.match(/<title>([^<]+)/)![1], html.match(/<meta name="description" content="([^"]+)/)![1]]) {
      assert.ok(!seen.has(value), `${url} repeats ${seen.get(value)}: ${value}`); seen.set(value, url)
    }
  }
})
test('sharing cards are PNG, sized, and show text at the card positions', async () => {
  const sharp = (await import('sharp')).default
  for (const id of ['ade-comparison', 'conductor']) {
    const image = sharp(new URL(`og/${id}.png`, dist).pathname), meta = await image.metadata()
    assert.equal(meta.format, 'png'); assert.equal(meta.width, 1200); assert.equal(meta.height, 630)
    for (const top of [64, 230, 530]) {
      const { channels } = await sharp(new URL(`og/${id}.png`, dist).pathname).extract({ left: 40, top, width: 500, height: 60 }).stats()
      assert.ok(channels[0].min < 128, `Card ${id} has no text near y=${top}`)
    }
  }
  assert.match(home, /property="og:image" content="[^"]+\/og\/ade-comparison\.png"/)
})
test('sourced values display normally and cross-checks are optional badges', () => {
  const payload = JSON.parse(home.match(/<script id="finder-data"[^>]*>([\s\S]*?)<\/script>/)![1])
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  const candidates = index.products.flatMap((p: { id: string }) => {
    const product = JSON.parse(readFileSync(new URL(`../data/products/${p.id}.json`, import.meta.url), 'utf8'))
    return Object.entries(product.facets || {}).flatMap(([facet, record]: [string, any]) =>
      (record.value ? [[null, record]] : Object.entries(record)).filter(([, c]: any) => c.verificationStatus === 'sourced')
        .map(([option, c]: any) => ({ id: p.id, key: option ? `${facet}:${option}` : ['yes', 'no'].includes(c.value) ? facet : `${facet}:${c.value}` })))
  })
  // The Finder shows fit, not verification: it carries no cross-check data and never labels a value.
  assert.equal(payload.sourcedOnly, undefined)
  assert.equal(payload.crossChecked, undefined)
  const board = home.slice(home.indexOf('id="results"'), home.indexOf('id="entry-pool"'))
  assert.ok(board.length > 1000, 'Results board found')
  assert.doesNotMatch(board, /cross-checked/i)
  for (const candidate of candidates) {
    assert.doesNotMatch(text(`ade/${candidate.id}/index.html`), /sourced, not cross-checked|awaits a separate cross-check|Not cross-checked/)
  }
})
test('every requirement has a receipt anchor on every researched page', () => {
  const facets = JSON.parse(readFileSync(new URL('../data/facets.json', import.meta.url), 'utf8')).facets
  const keys = [...requirementsFrom(facets).map(r => r.key)]
  for (const p of JSON.parse(text('products/index.json')).products.filter((p: { researchStatus: string }) => p.researchStatus === 'covered')) {
    const html = text(`ade/${p.id}/index.html`)
    for (const key of keys) assert.ok(html.includes(`id="receipt-${key.replace(/[^a-z0-9-]/g, '-')}"`), `${p.id} lacks ${key}`)
  }
})
test('status landing and monthly archives keep the budget, events, anchors and discovery links', () => {
  const events: StatusEvent[] = JSON.parse(readFileSync(new URL('../data/status-log.json', import.meta.url), 'utf8'))
  const snapshot = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8')).generatedAt
  const plan = planStatus(events, snapshot)
  const landing = text('status/index.html')
  const articleIds = (contents: string) => [...contents.matchAll(/<article class="receipt" id="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(articleIds(landing), plan.recent.map(day => day.id))
  assert.ok(articleIds(landing).length <= statusPageSize)
  for (const notice of notices) assert.ok(landing.includes(`id="lifecycle-${notice.productId}"`))
  const archived = new Set<string>()
  const sitemap = text('sitemap.xml'), llms = text('llms.txt')
  for (const page of [{ path: '/status/' }, ...plan.pages]) {
    const contents = text(`${page.path.slice(1)}index.html`)
    const gzip = gzipSync(contents).length
    assert.ok(gzip < 150_000, `${page.path} weighs ${gzip} gzip bytes`)
    console.log(`${page.path}: ${gzip} bytes gzip`)
    if (page.path === '/status/') continue
    assert.ok(articleIds(contents).length <= statusPageSize)
    assert.ok(sitemap.includes(`<loc>${siteConfig.baseUrl.replace(/\/$/, '')}${page.path}</loc>`))
    assert.ok(llms.includes(`](${siteConfig.baseUrl.replace(/\/$/, '')}${page.path})`))
    for (const id of articleIds(contents)) {
      assert.ok(!archived.has(id), `Duplicate archived day ${id}`)
      archived.add(id)
    }
  }
  assert.deepEqual(archived, new Set(events.map(event => `${event.date}-${event.productId}`)))
  const recent = new Set(plan.recent.map(day => day.id))
  for (const day of plan.days) {
    assert.ok(landing.includes(`id="${day.id}"`), `Lost legacy bookmark ${day.id}`)
    if (!recent.has(day.id)) assert.ok(landing.includes(`href="${day.archivePath}#${day.id}"`))
    const contents = text(`${day.archivePath.slice(1)}index.html`)
    const article = contents.match(new RegExp(`<article class="receipt" id="${day.id}">([\\s\\S]*?)</article>`))![1]
    for (const claimId of new Set(day.events.flatMap(event => event.claimIds))) {
      assert.ok(article.includes(`href="/ade/${day.productId}/#finding-${claimId.replace(/[^a-z0-9-]/gi, '-')}"`), `Lost finding ${claimId}`)
    }
    // A monthly permalink survives when a later batch pushes its receipt to another page.
    assert.ok(text(`status/${day.date.slice(0, 7)}/index.html`).includes(`id="${day.id}"`))
  }
  for (const month of plan.months) assert.ok(landing.includes(`href="/status/${month.month}/"`))
})

test('status windows and page limits handle empty logs, boundaries and large new batches', () => {
  const event = (date: string, productId: string): StatusEvent => ({ id: `${date}:${productId}`, date, productId, type: 'freshness-recheck', claimIds: [], evidenceIds: [] })
  const empty = planStatus([], '2027-01-15')
  assert.deepEqual(empty.pages, []); assert.deepEqual(empty.recent, [])
  const boundary = planStatus([event('2026-12-16', 'old'), event('2027-01-16', 'future'), event('2026-12-17', 'cutoff'), event('2027-01-15', 'today')], '2027-01-15')
  assert.equal(boundary.since, '2026-12-17')
  assert.deepEqual(boundary.recent.map(day => day.productId), ['today', 'cutoff'])
  const batch = Array.from({ length: 401 }, (_, i) => event('2027-01-15', `ade-${String(i).padStart(3, '0')}`))
  const large = planStatus([...batch].reverse().concat(batch[0]), '2027-01-15')
  assert.equal(large.recent.length, 20)
  assert.equal(large.pages.length, 21)
  assert.equal(large.pages.at(-1)!.path, '/status/2027-01/21/')
  assert.equal(large.pages.flatMap(page => page.days).length, 401)
  assert.equal(large.days[0].events.length, 2)
  assert.ok(large.pages.every(page => page.days.length <= 20))
})

test('the disclosure stays honest', () => {
  const method = text('method/index.html')
  assert.match(method, /Podium has \d+ typed filter values in this snapshot\. The median researched product has \d+\./)
  for (const label of ['Fits', 'Fits kind of', 'Fits but shutting down']) assert.ok(home.includes(`>${label}</span>`))
  assert.doesNotMatch(home, /Not enough evidence|Fits except|Must-haves unknown|Preferences unknown|Named gaps|Include shutdown products|not researched yet/i)
  for (const path of ['matrix/index.html', 'compare/index.html', 'ade/podium/index.html']) assert.doesNotMatch(text(path), /What we could not establish|No eligible current|not enough evidence|not researched yet/i)
  assert.doesNotMatch(home.replace(/laptop-independent/gi, ''), /\bindependent\b/i)
})

test('each published receipt shows its original checked date and relative age', () => {
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  for (const identity of index.products.filter((p: any) => p.researchStatus === 'covered')) {
    const product = JSON.parse(readFileSync(new URL(`../data/products/${identity.id}.json`, import.meta.url), 'utf8'))
    const html = text(`ade/${identity.id}/index.html`)
    for (const claim of product.claims) {
      assert.ok(html.includes(`data-checked-at="${claim.checkedAt}"`))
      assert.ok(html.includes(`datetime="${claim.checkedAt}"`))
    }
    if (product.claims.length) assert.match(html, /checked (?:today|yesterday|\d+ (?:day|week|month|year)s? ago)/)
  }
})
