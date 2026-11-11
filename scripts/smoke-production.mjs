// After a deploy, checks the live site against the local build in dist/.
// Usage: node scripts/smoke-production.mjs https://adecomparison.com
import { readFileSync } from 'node:fs'

const origin = new URL(process.argv[2] || 'https://adecomparison.com').origin
const dist = new URL('../dist/', import.meta.url)
// Pages whose live bytes must equal the build. A stale edge or a failed upload shows up here.
const pages = ['/', '/matrix/', '/method/', '/status/', '/robots.txt', '/sitemap.xml']
const attempts = 6, waitMs = 10_000

const fetchManual = (path, init = {}) => fetch(new URL(path, origin), { redirect: 'manual', headers: { 'cache-control': 'no-cache' }, ...init })

async function check() {
  const failures = []
  for (const path of pages) {
    const res = await fetchManual(path)
    const file = path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1)
    const expected = readFileSync(new URL(file, dist), 'utf8')
    const body = await res.text()
    if (res.status !== 200) failures.push(`${path}: status ${res.status}`)
    else if (body !== expected) failures.push(`${path}: live content differs from dist/${file}`)
    if (path === '/' && !res.headers.get('content-security-policy')?.includes("script-src 'self'")) failures.push('/: Content-Security-Policy header missing')
  }
  const slash = await fetchManual('/matrix')
  if (![301, 307, 308].includes(slash.status) || new URL(slash.headers.get('location') || '', origin).pathname !== '/matrix/') failures.push(`/matrix: expected a redirect to /matrix/, got ${slash.status}`)
  const missing = await fetchManual('/no-such-page-smoke-check/')
  if (missing.status !== 404 || !(await missing.text()).includes('<html')) failures.push(`unknown path: expected the 404 page, got ${missing.status}`)
  return failures
}

for (let attempt = 1; ; attempt++) {
  const failures = await check().catch(error => [String(error)])
  if (!failures.length) { console.log(`Smoke check passed for ${origin}`); break }
  if (attempt === attempts) { console.error(`Smoke check failed for ${origin}:\n- ${failures.join('\n- ')}`); process.exit(1) }
  console.log(`Attempt ${attempt} failed (${failures.length} problem(s)); retrying in ${waitMs / 1000}s`)
  await new Promise(resolve => setTimeout(resolve, waitMs))
}
