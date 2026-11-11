import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inlineScriptHashes } from '../scripts/headers.mjs'
const dist = new URL('../dist/', import.meta.url)
test('the Cloudflare _headers policy allows exactly the built inline scripts', () => {
  const headers = readFileSync(new URL('_headers', dist), 'utf8')
  const csp = headers.match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1]
  assert.ok(csp, 'Content-Security-Policy is missing')
  const scriptSrc = csp.match(/script-src ([^;]+)/)![1].split(' ')
  assert.ok(!scriptSrc.some(source => source.startsWith("'unsafe-")), 'script-src must not allow unsafe sources')
  assert.deepEqual(scriptSrc.filter(source => source.startsWith("'sha256-")).sort(), inlineScriptHashes(fileURLToPath(dist)))
  for (const header of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Strict-Transport-Security:']) assert.ok(headers.includes(header), header)
  assert.match(headers, /^\/ade\/:id\/sheet\/\n {2}X-Robots-Tag: noindex$/m, 'sheet fragments must be noindex')
  for (const line of headers.split('\n')) assert.ok(line.length <= 2000, 'Cloudflare limits _headers lines to 2,000 characters')
})
// Until the adecomparison.com zone exists the Worker is served on workers.dev only;
// once the custom_domain route is restored, workers.dev must be switched off.
test('wrangler.jsonc serves dist as static assets on one public origin', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
  assert.equal(config.main, undefined)
  assert.equal(config.preview_urls, false)
  if (config.routes) {
    assert.deepEqual(config.routes, [{ pattern: 'adecomparison.com', custom_domain: true }])
    assert.equal(config.workers_dev, false)
  } else assert.equal(config.workers_dev, true)
  assert.deepEqual(config.assets, { directory: './dist', html_handling: 'force-trailing-slash', not_found_handling: '404-page' })
})
