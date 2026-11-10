import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import lighthouse from 'lighthouse'
import { launch } from 'chrome-launcher'
import { createStaticServer } from './serve-static.mjs'
const reportDir = mkdtempSync(join(tmpdir(), 'ade-comparison-lighthouse-'))
const profile = mkdtempSync(join(tmpdir(), 'ade-comparison-chrome-'))
let server, chrome
try {
  let url = process.argv[2]
  if (!url) {
    server = createStaticServer()
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${server.address().port}/`
  }
  chrome = await launch({ chromePath: process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'], userDataDir: profile, logLevel: 'silent' })
  const result = await lighthouse(url, { port: chrome.port, logLevel: 'error', onlyCategories: ['performance', 'accessibility'], output: ['html', 'json'] })
  const { lhr } = result
  writeFileSync(join(reportDir, 'report.html'), result.report[0])
  writeFileSync(join(reportDir, 'report.json'), result.report[1])
  const measured = { performance: lhr.categories.performance.score * 100, accessibility: lhr.categories.accessibility.score * 100, cls: lhr.audits['cumulative-layout-shift'].numericValue, lcpMs: lhr.audits['largest-contentful-paint'].numericValue }
  console.log(JSON.stringify({ ...measured, reportDir }, null, 2))
  assert.equal(measured.performance, 100, 'Lighthouse performance must be 100')
  assert.equal(measured.accessibility, 100, 'Lighthouse accessibility must be 100')
  assert.equal(measured.cls, 0, 'Home must not shift during load')
  assert.ok(measured.lcpMs < 800, `Largest contentful paint ${measured.lcpMs}ms must be under 800ms`)
} finally {
  if (chrome) chrome.kill()
  if (server) await new Promise(resolve => server.close(resolve))
  rmSync(profile, { recursive: true, force: true })
}
