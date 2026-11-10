import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createFilter, emptyState, parseProducts, parseState, presets, promptFor, requirementsFrom, serializeState } from '../src/lib/filter.ts'
import { answersDiffer, groupLabel, resultMessage } from '../src/lib/view.ts'
import type { Index, Requirement } from '../src/lib/types.ts'
const rows = ['Alpha', 'Beta', 'Podium', 'Unresearched'].map((name, i) => ({ id: name.toLowerCase(), name, website: null, researchStatus: i === 3 ? 'not-researched' as const : 'covered' as const }))
const bits = (n: number) => Buffer.from([n]).toString('base64')
const fixture: Index = { schemaVersion: 1, generatedAt: '2026-11-07', products: rows, bitsets: { encoding: 'base64', bitOrder: 'least-significant-bit-first', rowOrder: 'products', unknown: 'neither-yes-nor-no', columns: {
  parallel: { yes: bits(0b0111), no: bits(0), crossChecked: bits(0) },
  windows: { yes: bits(0b0011), no: bits(0), crossChecked: bits(0) },
  remote: { yes: bits(0b0010), no: bits(0b0001), crossChecked: bits(0) },
} } }
const reqs: Requirement[] = Object.keys(fixture.bitsets.columns).map(key => ({ key, label: key, facetId: key, option: null, description: key }))
const engine = createFilter(fixture, reqs)
test('a majority of confirmed must-haves fits kind of, and unknown never becomes a failure', () => {
  assert.equal(engine.answer(2, 'windows'), 'unknown')
  const results = engine.run({ ...emptyState(), must: ['parallel', 'windows', 'remote'] })
  const alpha = results.find(r => r.product.id === 'alpha')!
  assert.equal(alpha.group, 'kind-of'); assert.equal(alpha.mustMet, 2)
  assert.equal(results.some(r => r.product.id === 'podium'), false)
  assert.equal(engine.answer(2, 'remote'), 'unknown')
})
test('preferences rank a shortlist without disqualifying must-have fits', () => {
  const results = engine.run({ ...emptyState(), must: ['parallel'], nice: ['remote'] })
  assert.deepEqual(results.slice(0, 3).map(r => r.product.id), ['beta', 'alpha', 'podium'])
  assert.ok(results.slice(0, 3).every(r => r.group === 'fits'))
  assert.equal(results.some(r => r.product.id === 'unresearched'), false)
})
test('publisher has no placement or extra coverage tie-break advantage', () => {
  const results = engine.run({ ...emptyState(), must: ['parallel'] })
  assert.deepEqual(results.map(r => r.product.name), ['Alpha', 'Beta', 'Podium'])
})
test('otherwise matching shutdown products always use the third group', () => {
  const filter = createFilter(fixture, reqs, ['alpha'])
  assert.equal(filter.run(emptyState()).find(r => r.product.id === 'alpha')?.group, 'shutting-down')
  assert.equal(filter.run({ ...emptyState(), query: 'alpha' })[0].group, 'shutting-down')
  assert.equal(filter.run({ ...emptyState(), must: ['remote'] }).some(r => r.product.id === 'alpha'), false)
  assert.equal(fixture.products.find(p => p.id === 'alpha')?.name, 'Alpha')
  assert.deepEqual(parseState('?include=sunset', reqs), emptyState())
})

test('a sourced former name finds the current product without changing its identity or rank', () => {
  const index: Index = { ...fixture, products: [{ ...rows[0], name: 'Paradev', formerNames: ['Superset'] }, ...rows.slice(1)] }
  const filter = createFilter(index, reqs)
  const results = filter.run({ ...emptyState(), query: 'sUpErSeT' })
  assert.deepEqual(results.map(result => result.product.name), ['Paradev'])
  assert.equal(results[0].product.id, rows[0].id)
  assert.deepEqual(filter.run(emptyState()).map(result => result.product.name), ['Beta', 'Paradev', 'Podium'])
})
test('URL round trips preserve priorities and reject invalid keys', () => {
  const state = { must: ['parallel'], nice: ['windows'], query: '<x> & q', preset: null }
  assert.deepEqual(parseState('?' + serializeState(state), reqs), state)
  assert.deepEqual(parseState('?must=parallel,parallel,invalid&nice=parallel,windows', reqs).nice, ['windows'])
  assert.deepEqual(parseState('?use=nonexistent', reqs), emptyState())
  assert.deepEqual(parseProducts('?products=alpha,alpha,beta,unresearched,podium,invalid', rows), ['alpha', 'beta', 'unresearched', 'podium'])
})
test('leaving Conductor produces ranked fits with the shipped public package', () => {
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  const facets = JSON.parse(readFileSync(new URL('../data/facets.json', import.meta.url), 'utf8')).facets
  const requirements = requirementsFrom(facets)
  const state = parseState('?use=leaving-conductor', requirements)
  assert.deepEqual(state.must, ['parallel-runs']); assert.ok(state.nice.length > 1)
  const results = createFilter(index, requirements).run(state)
  assert.ok(results.some(r => r.group === 'fits'))
  assert.ok(!results.some(r => r.product.id === 'conductor'))
  const prompt = promptFor(state, requirements, 'https://ade-comparison.example')
  assert.match(prompt, /Must have: Parallel runs/); assert.match(prompt, /Check source age and lifecycle dates/)
  for (const p of presets) for (const k of [...p.must, ...p.nice]) assert.ok(requirements.some(r => r.key === k), k)
})
test('packed bitsets stay below one frame for 300 products', () => {
  const index = structuredClone(fixture)
  index.products = Array.from({ length: 300 }, (_, i) => ({ ...rows[i % 3], id: `product-${i}`, name: `Product ${String(i).padStart(3, '0')}` }))
  for (const c of Object.values(index.bitsets.columns)) { c.yes = Buffer.alloc(38, 0b01010101).toString('base64'); c.no = Buffer.alloc(38, 0b10101010).toString('base64') }
  const filter = createFilter(index, reqs), state = { ...emptyState(), must: ['parallel'], nice: ['remote', 'windows'] }
  filter.run(state)
  const timings: number[] = []
  for (let i = 0; i < 30; i++) { const start = performance.now(); filter.run(state); timings.push(performance.now() - start) }
  timings.sort((a, b) => a - b)
  assert.ok(timings[28] < 16, `p95 filter time: ${timings[28]}ms`)
})
test('unknown and sourced no have the same effect on confirmed-match counts', () => {
  const columns = { a: { yes: bits(1), no: bits(0), crossChecked: bits(0) }, b: { yes: bits(1), no: bits(0), crossChecked: bits(0) }, c: { yes: bits(0), no: bits(0), crossChecked: bits(0) }, d: { yes: bits(0), no: bits(1), crossChecked: bits(0) } }
  const index = { ...fixture, products: rows.slice(0, 1), bitsets: { ...fixture.bitsets, columns } }
  const keys = Object.keys(columns).map(key => ({ key, label: key }))
  const unknown = createFilter(index, keys).run({ ...emptyState(), must: ['a', 'b', 'c'] })[0]
  assert.equal(unknown.group, 'kind-of'); assert.equal(unknown.mustMet, 2)
  const gap = createFilter(index, keys).run({ ...emptyState(), must: ['a', 'b', 'd'] })[0]
  assert.equal(gap.group, 'kind-of'); assert.equal(gap.mustMet, 2)
  assert.equal(createFilter(index, keys).run({ ...emptyState(), must: ['a', 'c'] }).length, 0, 'Half is not a majority')
})
test('the finder always uses the three requested group names', () => {
  assert.equal(groupLabel('fits'), 'Fits')
  assert.equal(groupLabel('kind-of'), 'Fits kind of')
  assert.equal(groupLabel('shutting-down'), 'Fits but shutting down')
  const nice = engine.run({ ...emptyState(), nice: ['remote'] }).find(r => r.product.id === 'beta')!
  assert.equal(resultMessage(nice, { ...emptyState(), nice: ['remote'] }), '1 of 1 preferences confirmed.')
})
test('an any-of requirement is yes on one yes, no on all no, otherwise unknown', () => {
  const columns = { x: { yes: bits(0b001), no: bits(0b110), crossChecked: bits(0) }, y: { yes: bits(0), no: bits(0b011), crossChecked: bits(0) } }
  const index = { ...fixture, products: rows.slice(0, 3), bitsets: { ...fixture.bitsets, columns } }
  const filter = createFilter(index, [{ key: 'x', label: 'x' }, { key: 'y', label: 'y' }, { key: 'any', label: 'any', anyOf: ['x', 'y'] }])
  assert.deepEqual([0, 1, 2].map(row => filter.answer(row, 'any')), ['yes', 'no', 'unknown'])
})
test('the phone preset accepts every phone client, so one vendor surface cannot decide it', () => {
  const facets = JSON.parse(readFileSync(new URL('../data/facets.json', import.meta.url), 'utf8')).facets
  const requirements = requirementsFrom(facets), any = requirements.find(r => r.key === 'any-phone-client')!
  assert.deepEqual(any.anyOf, facets.find((f: { id: string }) => f.id === 'phone-client').options.map((o: { id: string }) => `phone-client:${o.id}`))
  assert.deepEqual(presets.find(p => p.id === 'phone')!.must, ['any-phone-client'])
})
test('the open-source preset accepts each listed open-source license and keeps exclusions and unknown distinct', () => {
  const facets = JSON.parse(readFileSync(new URL('../data/facets.json', import.meta.url), 'utf8')).facets
  const requirements = requirementsFrom(facets)
  const open = requirements.find(r => r.key === 'open-source-license')!
  const accepted = ['apache-2-0', 'mit', 'gpl-3-0', 'gpl-3-0-or-later', 'agpl-3-0', 'agpl-3-0-or-later']
  assert.deepEqual(open.anyOf, accepted.map(id => `license:${id}`))
  assert.equal(open.label, 'Open-source license')
  const options: string[] = facets.find((f: { id: string }) => f.id === 'license').options.map((o: { id: string }) => o.id)
  const values = [...options, 'unknown']
  const encoded = (predicate: (value: string) => boolean) => {
    const bytes = Buffer.alloc(Math.ceil(values.length / 8))
    values.forEach((value, row) => { if (predicate(value)) bytes[row >> 3] |= 1 << (row & 7) })
    return bytes.toString('base64')
  }
  const index: Index = { ...fixture, products: values.map(value => ({ id: value, name: value, website: null, researchStatus: 'covered' })),
    bitsets: { ...fixture.bitsets, columns: Object.fromEntries(options.map(option => [`license:${option}`, {
      yes: encoded(value => value === option), no: encoded(value => value !== 'unknown' && value !== option), crossChecked: encoded(() => false),
    }])) } }
  const filter = createFilter(index, requirements)
  for (const [row, value] of values.entries()) assert.equal(filter.answer(row, open.key),
    value === 'unknown' ? 'unknown' : accepted.includes(value) ? 'yes' : 'no', value)
  const state = parseState('?use=open-source', requirements)
  assert.deepEqual(state.must, ['open-source-license'])
  assert.deepEqual(filter.run(state).map(result => result.product.id).sort(), [...accepted].sort())
})

test('the open-source preset finds all newly sourced copyleft applications in the public package', () => {
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  const facets = JSON.parse(readFileSync(new URL('../data/facets.json', import.meta.url), 'utf8')).facets
  const requirements = requirementsFrom(facets), state = parseState('?use=open-source', requirements)
  const matches = new Set(createFilter(index, requirements).run(state).map(result => result.product.id))
  for (const id of ['proliferate', 'xum', 'claude-squad', 'cmux', 'maestro', 'zed', 'warp']) assert.ok(matches.has(id), id)
})
test('no preset names the publisher, and order ignores coverage beyond confirmed requirements', () => {
  for (const preset of presets) assert.doesNotMatch(JSON.stringify(preset), /podium/i)
  assert.ok(!presets.some(p => p.baseline === 'podium'))
})
test('an empty prompt URL has no stray query mark', () => {
  assert.match(promptFor(emptyState(), reqs, 'https://ade-comparison.example'), /Finder: https:\/\/ade-comparison\.example\/\n/)
})

test('differences-only needs two recorded answers that conflict', () => {
  assert.equal(answersDiffer(['yes', 'no']), true)
  assert.equal(answersDiffer(['mit', 'apache-2-0', 'unknown']), true)
  assert.equal(answersDiffer(['yes', 'unknown']), false)
  assert.equal(answersDiffer(['unknown', 'unknown']), false)
  assert.equal(answersDiffer(['yes', 'yes']), false)
})

test('must-have matches outrank preferences, with name breaking equal match counts', () => {
  const columns = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(key => [key, { yes: bits(key === 'd' || key === 'e' ? 0b010 : key === 'c' ? 0b101 : 0b111), no: bits(0), crossChecked: bits(0) }]))
  const index = { ...fixture, products: rows.slice(0, 3), bitsets: { ...fixture.bitsets, columns } }
  const keys = Object.keys(columns).map(key => ({ key, label: key }))
  const results = createFilter(index, keys, ['alpha', 'beta', 'podium']).run({ ...emptyState(), must: ['a', 'b', 'c'], nice: ['d', 'e'] })
  assert.deepEqual(results.map(r => r.product.id), ['alpha', 'podium', 'beta'])
  assert.ok(results.every(r => r.group === 'shutting-down'))
  assert.deepEqual(results.map(r => r.mustMet), [3, 3, 2])
})
