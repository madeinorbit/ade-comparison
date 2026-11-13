// Imports the ADEMark benchmark summary (https://ademark.dev/results.json, CC BY 4.0) into
// benchmarks/ademark.json. The results are kept verbatim; this script only adds the source,
// the import date and the mapping from ADEMark app IDs to catalog product IDs.
//
//   node scripts/import-ademark.mjs            fetch the live summary
//   node scripts/import-ademark.mjs <file>     import a saved copy
//
// It refuses to write when ADEMark lists an app that has no entry in `productIds` below,
// so a new ADEMark app is never dropped or matched by guesswork.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const source = {
  name: 'ADEMark',
  url: 'https://ademark.dev/',
  resultsUrl: 'https://ademark.dev/results.json',
  repository: 'https://github.com/zqkra/ademark',
  rawData: 'https://github.com/zqkra/ademark/tree/main/data',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

// ADEMark app ID -> catalog product ID. `null` means the app is not an ADE in this catalog
// (the Bare CLI is ADEMark's unranked control). Check data/index.json before adding one.
export const productIds = {
  'bare-cli': null,
  bb: 'bb',
  capy: 'capy',
  'claude-desktop': 'claude-code',
  cloudroom: 'cloudroom',
  diri: 'diri',
  emdash: 'emdash',
  monocode: 'monocode',
  orca: 'orca',
  paseo: 'paseo',
  'super-engineering': 'super-engineering',
  superset: 'superset',
  synara: 'synara',
  t3code: 't3-code',
  traycer: 'traycer',
  zeron: 'comet',
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
// "measured up to 12 November 2026" -> "2026-11-12"
export function measuredDate(text) {
  const m = /(\d{1,2}) ([a-z]+) (\d{4})/i.exec(String(text))
  const month = m && months.indexOf(m[2].toLowerCase())
  if (!m || month < 0) throw new Error(`Cannot read the ADEMark measured date from "${text}"`)
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export function buildSnapshot(results, { importedAt = new Date().toISOString().slice(0, 10), catalogIds } = {}) {
  if (!results || !Array.isArray(results.apps) || typeof results.measured !== 'string') throw new Error('Unexpected ADEMark results shape')
  if (results.license !== source.license) throw new Error(`ADEMark data license changed to "${results.license}"; review reuse terms before importing`)
  const unmapped = results.apps.filter(a => !(a.id in productIds)).map(a => `${a.id} (${a.name})`)
  if (unmapped.length) throw new Error(`Add these ADEMark apps to productIds in scripts/import-ademark.mjs: ${unmapped.join(', ')}`)
  const mapping = Object.fromEntries(results.apps.map(a => [a.id, productIds[a.id]]))
  if (catalogIds) {
    const missing = Object.values(mapping).filter(id => id && !catalogIds.has(id))
    if (missing.length) throw new Error(`Mapped to products missing from data/index.json: ${missing.join(', ')}`)
  }
  for (const app of results.apps) for (const [test, r] of Object.entries(app.tests || {})) {
    const ok = typeof r.median === 'number' && typeof r.unit === 'string' && Number.isInteger(r.runs) || ['did not finish', 'not measured'].includes(r.result)
    if (!ok) throw new Error(`Unexpected result for ${app.id} ${test}`)
  }
  return { source, importedAt, measuredAt: measuredDate(results.measured), mapping, results }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2]
  const results = file ? JSON.parse(readFileSync(file, 'utf8')) : await (await fetch(source.resultsUrl, { headers: { accept: 'application/json' } })).json()
  const index = JSON.parse(readFileSync(new URL('../data/index.json', import.meta.url), 'utf8'))
  const snapshot = buildSnapshot(results, { catalogIds: new Set(index.products.map(p => p.id)) })
  writeFileSync(new URL('../benchmarks/ademark.json', import.meta.url), `${JSON.stringify(snapshot, null, 1)}\n`)
  console.log(`ADEMark ${snapshot.results.run}: ${results.apps.length} apps, measured ${snapshot.measuredAt}, imported ${snapshot.importedAt}`)
}
