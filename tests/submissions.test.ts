import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { absolute } from '../config.mjs'
import { submissionLinks } from '../src/lib/submissions.ts'

interface FormField {
  type: string; id?: string
  attributes: { label?: string; value?: string; options?: { label: string; required?: boolean }[] }
  validations?: { required: boolean }
}
interface IssueForm { name: string; description: string; body: FormField[] }
const templates = new URL('../.github/ISSUE_TEMPLATE/', import.meta.url)
const form = (name: string) => parse(readFileSync(new URL(name, templates), 'utf8')) as IssueForm
const repository = 'https://github.com/example/ade-comparison-test'

test('both issue forms require public evidence, a product and the requested change', () => {
  for (const [filename, action, required] of [
    ['report-wrong-data.yml', 'Report wrong data', ['product', 'wrong', 'public_url', 'exact_sentence']],
    ['suggest-missing-ade.yml', 'Suggest a missing ADE', ['product', 'website', 'reason', 'public_url', 'exact_sentence']],
  ] as const) {
    const template = form(filename)
    assert.equal(template.name, action)
    assert.ok(template.description.length > 0)
    const ids = template.body.filter(f => f.id).map(f => f.id!)
    assert.equal(new Set(ids).size, ids.length)
    for (const id of ids) assert.match(id, /^[a-z0-9_-]+$/i)
    for (const id of required) {
      const field = template.body.find(f => f.id === id)!
      assert.ok(field, `${filename} needs ${id}`)
      assert.ok(field.attributes.label)
      assert.equal(field.validations?.required, true, `${filename} must require ${id}`)
      assert.equal(field.attributes.value, undefined, 'Required answers must not be supplied by the template')
    }
    const intro = template.body.filter(f => f.type === 'markdown').map(f => f.attributes.value).join('\n')
    assert.match(intro, /Word of mouth.*not evidence/)
    assert.match(intro, /Vendors get no exception, including Podium/)
    assert.match(intro, /research catalog \(`research\/`\)/)
    assert.doesNotMatch(intro, /private catalog|private repository/)
    assert.ok(template.body.some(f => f.type === 'checkboxes' && f.attributes.options?.some(o => o.required && /source is public.*exact sentence/.test(o.label))))
  }
  assert.equal(parse(readFileSync(new URL('config.yml', templates), 'utf8')).blank_issues_enabled, false)
})

test('repository configuration is optional and accepts only GitHub repository roots', () => {
  const config = new URL('../config.mjs', import.meta.url).href
  const run = (value?: string) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ADE_COMPARISON_BASE_URL: 'https://site.example' }
    delete env.ADE_COMPARISON_PUBLIC_REPOSITORY_URL
    if (value !== undefined) env.ADE_COMPARISON_PUBLIC_REPOSITORY_URL = value
    return spawnSync(process.execPath, ['--input-type=module', '-e', `const { siteConfig } = await import(${JSON.stringify(config)}); console.log(JSON.stringify(siteConfig.publicRepositoryUrl))`], { env, encoding: 'utf8' })
  }
  for (const empty of [undefined, '', '   ']) {
    const result = run(empty)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout), null)
  }
  const valid = run(` ${repository}/ `)
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(JSON.parse(valid.stdout), repository)
  for (const invalid of ['not a URL', 'javascript:alert(1)', 'http://github.com/a/b', 'https://elsewhere.example/a/b', 'https://github.com.evil.example/a/b', 'https://user:secret@github.com/a/b', 'https://github.com:444/a/b', 'https://github.com/a', `${repository}/issues/new`, `${repository}?template=other`, `${repository}#fragment`, `${repository}?`, `${repository}#`, `${repository}.git`]) {
    const result = run(invalid)
    assert.notEqual(result.status, 0, `Accepted ${invalid}`)
    assert.match(result.stderr, /ADE_COMPARISON_PUBLIC_REPOSITORY_URL must be/)
  }
})

test('receipt links encode context and product without filling in supporting evidence', () => {
  const product = { id: 'example', name: 'A&B "ADE" / 日本語 ?#' }
  const pagePath = '/ade/example/#receipt-parallel-runs'
  const receipt = 'Parallel runs & orchestration'
  const links = submissionLinks({ product, pagePath, receipt }, repository)!
  for (const [kind, href] of Object.entries(links)) {
    const url = new URL(href)
    assert.equal(url.origin + url.pathname, `${repository}/issues/new`)
    const filename = kind === 'reportWrongData' ? 'report-wrong-data.yml' : 'suggest-missing-ade.yml'
    assert.equal(url.searchParams.get('template'), filename)
    assert.equal(url.searchParams.get('context'), `${absolute(pagePath)}\nProduct: ${product.name} (${product.id})\nReceipt: ${receipt}`)
    const fieldIds = new Set(form(filename).body.map(f => f.id))
    for (const key of url.searchParams.keys()) assert.ok(['template', 'title'].includes(key) || fieldIds.has(key), `Unknown prefill field ${key}`)
    for (const field of ['public_url', 'exact_sentence', 'wrong', 'reason', 'evidence_check']) assert.equal(url.searchParams.has(field), false, `${field} must be supplied by the contributor`)
  }
  assert.equal(new URL(links.reportWrongData).searchParams.get('product'), product.name)
  assert.equal(new URL(links.suggestMissingAde).searchParams.has('product'), false, 'The current ADE is not the missing ADE')
  assert.equal(new URL(links.suggestMissingAde).searchParams.has('title'), false, 'The form keeps its own title prefix')
  assert.equal(new URL(links.reportWrongData).searchParams.get('title'), `Data correction: ${product.name}`)
})

test('Method links allow any product, and an unset repository yields no links', () => {
  const context = { pagePath: '/method/#corrections' }
  assert.equal(submissionLinks(context, null), null)
  const links = submissionLinks(context, repository)!
  for (const href of Object.values(links)) {
    const params = new URL(href).searchParams
    assert.equal(params.has('product'), false)
    assert.equal(params.get('context'), absolute(context.pagePath))
    assert.equal(params.has('title'), false, 'The form keeps its own title prefix')
    assert.doesNotMatch(href, /undefined|null/)
  }
})
