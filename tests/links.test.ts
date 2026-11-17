import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { productLinks, repositoryName } from '../src/lib/links.ts'
const dist = new URL('../dist/', import.meta.url)
const text = (path: string) => readFileSync(new URL(path, dist), 'utf8')
const products = readdirSync(new URL('../data/products/', import.meta.url)).map(f => JSON.parse(readFileSync(new URL(`../data/products/${f}`, import.meta.url), 'utf8')))
const gh = 'https://github.com/acme/tool'
const decode = (s: string) => s.replace(/&amp;/g, '&')
const headerLinks = (html: string) => [...html.matchAll(/<a [^>]*data-link="(repository|homepage)"[^>]*href="([^"]+)"|<a [^>]*href="([^"]+)"[^>]*data-link="(repository|homepage)"/g)]
  .map(m => ({ kind: m[1] || m[4], href: decode(m[2] || m[3]) }))

test('productLinks picks the repository and a homepage that differs', () => {
  assert.deepEqual(productLinks({ website: 'https://acme.dev/', repository: gh }), { repository: gh, homepage: 'https://acme.dev/' })
  assert.deepEqual(productLinks({ website: gh, repository: gh }), { repository: gh, homepage: null })
  assert.deepEqual(productLinks({ website: 'https://www.GitHub.com/acme/tool.git', repository: gh }), { repository: gh, homepage: null })
  assert.deepEqual(productLinks({ website: gh + '/', repository: gh }), { repository: gh, homepage: null })
  assert.deepEqual(productLinks({ website: 'https://acme.dev/', repository: null }), { repository: null, homepage: 'https://acme.dev/' })
  assert.deepEqual(productLinks({ website: null, repository: gh }), { repository: gh, homepage: null })
  assert.deepEqual(productLinks({ website: null, repository: null }), { repository: null, homepage: null })
})
test('a listing whose website is a GitHub repository shows it as the repository, not a homepage', () => {
  assert.deepEqual(productLinks({ website: gh }), { repository: gh, homepage: null })
  // A GitHub page that is not a repository root stays a homepage.
  assert.deepEqual(productLinks({ website: 'https://github.com/features/copilot/plans' }), { repository: null, homepage: 'https://github.com/features/copilot/plans' })
  assert.equal(repositoryName(gh + '/'), 'acme/tool')
})
test('every ADE page links its repository and homepage once, labelled, with rel noopener', () => {
  let withRepository = 0
  for (const product of products) {
    const html = text(`ade/${product.id}/index.html`), expected = productLinks(product), found = headerLinks(html)
    const hrefs = found.map(l => l.href)
    assert.equal(new Set(hrefs).size, hrefs.length, `${product.id}: the same URL is linked twice`)
    assert.deepEqual(found.find(l => l.kind === 'repository')?.href ?? null, expected.repository, `${product.id}: repository link`)
    assert.deepEqual(found.find(l => l.kind === 'homepage')?.href ?? null, expected.homepage, `${product.id}: homepage link`)
    if (expected.repository) withRepository++
    for (const m of html.matchAll(/<a [^>]*data-link="(repository|homepage)"[^>]*>/g)) {
      assert.match(m[0], /rel="noopener noreferrer"/, `${product.id}: ${m[1]} link needs rel`)
    }
    const accessible = (kind: string) => html.match(new RegExp(`<a [^>]*data-link="${kind}"[^>]*>([\\s\\S]*?)</a>`))?.[1].replace(/<[^>]+>/g, '')
    if (expected.repository) assert.ok(accessible('repository')!.startsWith(`GitHub repository for ${product.name}`), `${product.id}: GitHub link name`)
    if (expected.homepage) assert.ok(accessible('homepage')!.startsWith(`Homepage of ${product.name}`), `${product.id}: Homepage link name`)
    // The links sit in the header, before the long content.
    if (found.length) assert.ok(html.indexOf('data-link=') < (html.indexOf('id="typed-title"') + 1 || Infinity), `${product.id}: links precede the findings`)
    assert.ok(!html.includes('Product website'), `${product.id}: old label`)
  }
  assert.ok(withRepository >= 90, `Expected many repositories, found ${withRepository}`)
})
test('a researched open-source page shows the data repository', () => {
  const oss = products.find(p => p.researchStatus === 'covered' && p.repository && p.website && p.website !== p.repository)
  assert.ok(oss, 'fixture product')
  const html = text(`ade/${oss.id}/index.html`)
  assert.ok(html.includes(`href="${oss.repository}"`) && html.includes(`href="${oss.website}"`))
})
test('agent files list the repository and each address once', () => {
  for (const product of products) {
    const { repository, homepage } = productLinks(product)
    const md = text(`products/${product.id}.md`), json = JSON.parse(text(`products/${product.id}.json`))
    assert.equal(json.repository ?? null, repository, `${product.id}: JSON repository`)
    const header = md.slice(0, md.indexOf('Research:'))
    assert.equal(header.includes(`Repository: ${repository}\n`), !!repository, `${product.id}: Markdown repository`)
    assert.equal(header.includes(`Website: ${homepage}\n`), !!homepage, `${product.id}: Markdown website`)
    if (repository && !homepage) assert.ok(!header.includes('Website:'), `${product.id}: no duplicate website`)
    if (repository) {
      const ld = JSON.parse(text(`ade/${product.id}/index.html`).match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)![1])
      assert.equal(ld.about.codeRepository, repository, `${product.id}: JSON-LD codeRepository`)
    }
  }
})
