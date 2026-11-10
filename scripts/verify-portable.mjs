import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { installLifecycleFixture } from './lifecycle-fixture.mjs'
const source = fileURLToPath(new URL('../', import.meta.url))
const target = mkdtempSync(join(tmpdir(), 'ade-comparison-portable-'))
const skip = new Set(['node_modules', 'dist', '.astro', 'test-results', 'playwright-report'])
try {
  cpSync(source, target, { recursive: true, filter: path => !path.slice(source.length).split('/').some(part => skip.has(part)) })
  const run = async (args, overrides = {}) => {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('npm', args, { cwd: target, stdio: 'inherit', env: { ...process.env, ADE_COMPARISON_BASE_URL: 'https://standalone.invalid', ADE_COMPARISON_PUBLIC_REPOSITORY_URL: '', ...overrides } })
      child.on('error', reject); child.on('close', resolve)
    })
    assert.equal(result, 0, `Isolated npm ${args.join(' ')} failed`)
  }
  await run(['ci', '--cache', join(tmpdir(), 'ade-comparison-npm-cache'), '--no-audit', '--no-fund'])
  await run(['run', 'build'])
  await run(['test'])
  await run(['run', 'check'])
  const home = readFileSync(join(target, 'dist/index.html'), 'utf8')
  assert.ok(home.includes('rel="canonical" href="https://standalone.invalid/"'))
  const agents = readFileSync(join(target, 'dist/llms.txt'), 'utf8')
  assert.ok(agents.includes('https://standalone.invalid/data/lifecycle-notices.json'))
  const fixture = installLifecycleFixture(target)
  const submissionConfig = { ADE_COMPARISON_PUBLIC_REPOSITORY_URL: 'https://github.com/ade-comparison-test/portable-fixture' }
  await run(['run', 'build'], submissionConfig)
  await run(['test'], submissionConfig)
  const fixtureHome = readFileSync(join(target, 'dist/index.html'), 'utf8')
  for (const id of fixture.productIds) {
    assert.match(fixtureHome, new RegExp(`<li[^>]*data-index-row=\"${fixture.rows[id]}\"`), `Listed ${id} must keep its SSR identity`)
    const page = readFileSync(join(target, `dist/ade/${id}/index.html`), 'utf8')
    assert.ok(page.includes(fixture.serviceEndDate), 'Shutdown date must survive the build')
    assert.ok(page.includes('Cloud service only'), 'Scoped notice must survive the build')
    assert.ok(page.includes('Service dates'), 'Notice locator must be published')
  }
  console.log('Synthetic lifecycle build passed for covered and plain-listing products: SSR identities, dates, scope and receipt locators.')
  console.log('Portable build passed in an isolated directory: npm ci, build, tests, typecheck, configured canonical and agent URLs, and submissions with both unset and configured repositories. No monorepo files were copied.')
} finally { rmSync(target, { recursive: true, force: true }) }
