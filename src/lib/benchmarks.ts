// ADEMark benchmark results (https://ademark.dev/, CC BY 4.0), imported verbatim by scripts/import-ademark.mjs.
// They are third-party measurements, not catalog findings: they never set a typed filter value, never
// enter an overall score and never change Best fit. The only filter they feed is "Benchmarked by ADEMark".
import snapshot from '../../benchmarks/ademark.json'

type Measured = { median: number; min: number; max: number; runs: number; unit: string }
type Gap = { result: 'did not finish' | 'not measured'; cause: string }
type Result = Measured | Gap
interface App { id: string; name: string; version: string; tests: Record<string, Result> }
interface Snapshot {
  source: { name: string; url: string; resultsUrl: string; repository: string; rawData: string; license: string; licenseUrl: string }
  importedAt: string; measuredAt: string; mapping: Record<string, string | null>
  results: { run: string; measured: string; machine: string; model: string; rule: string; license: string; apps: App[] }
}
export const ademark = snapshot as Snapshot
export const ademarkSource = ademark.source

// The tests shown on product pages and in Compare, in ADEMark's own order. Every other test stays in the
// published JSON. `better` says which way is better; the build test counts passes, so higher is better.
export interface BenchTest { id: string; group: string; label: string; better: 'lower' | 'higher'; extra?: string }
export const benchTests: BenchTest[] = [
  { id: 'A1/cold', group: 'Speed', label: 'Cold start' },
  { id: 'A3/default-mode', group: 'Speed', label: 'New thread, ready to type' },
  { id: 'A4/total', group: 'Speed', label: 'First word on screen' },
  { id: 'A8/p95', group: 'Speed', label: 'Typing lag, 5 agents streaming' },
  { id: 'A11/open', group: 'Speed', label: 'Open a 2,000-message thread' },
  { id: 'A5/total', group: 'Weight', label: 'Memory at rest, 5 threads' },
  { id: 'A6/front', group: 'Weight', label: 'Idle CPU' },
  { id: 'A7/total-p95', group: 'Weight', label: 'Memory under load' },
  { id: 'B1/total', group: 'Tokens', label: 'Tokens to answer “hi”' },
  { id: 'B3/total', group: 'Tokens', label: 'Tokens for one real question' },
  { id: 'C1/shipped', group: 'Build', label: 'Team build: hidden tests passed', extra: 'C1/time-to-green' },
].map(t => ({ better: t.id === 'C1/shipped' ? 'higher' : 'lower', ...t }) as BenchTest)

const isMeasured = (r: Result | undefined): r is Measured => Boolean(r && 'median' in r)
const apps = ademark.results.apps
const control = apps.find(a => ademark.mapping[a.id] === null)
const ranked = apps.filter(a => ademark.mapping[a.id])
export const benchApp = (productId: string) => ranked.find(a => ademark.mapping[a.id] === productId)
export const benchmarkedIds = ranked.map(a => ademark.mapping[a.id]!)
export const ademarkCount = ranked.length

const round = (n: number, digits: number) => Number(n.toFixed(digits)).toLocaleString('en-GB', { maximumFractionDigits: digits })
export function formatValue(r: Measured, test?: Result): string {
  const { median: v, unit } = r
  if (unit === 's') return `${round(v, 2)} s`
  if (unit === 'ms') return `${round(v, 0)} ms`
  if (unit === 'MB') return v >= 1000 ? `${round(v / 1024, 2)} GB` : `${round(v, 0)} MB`
  if (unit === '% CPU') return `${round(v, 2)}%`
  if (unit === 'tokens') return v >= 1000 ? `${round(v / 1000, 1)}K tokens` : `${round(v, 0)} tokens`
  const groups = /hidden test groups of (\d+)/.exec(unit)
  if (groups) {
    const time = test && isMeasured(test) ? ` in ${round(test.median, 1)} min` : ''
    return `${round(v, 0)} of ${groups[1]}${v > 0 ? time : ''}`
  }
  return `${round(v, 2)} ${unit}`
}

export interface BenchCell { text: string; kind: 'value' | 'gap' | 'none'; rank?: number; of?: number; runs?: number; range?: string; cause?: string; control?: string }
// One cell: the median, its place among the measured apps (gaps are never ranked), the run count and range,
// and the Bare CLI control for context. A missing app is "Not benchmarked", never zero.
export function benchCell(productId: string, test: BenchTest): BenchCell {
  const app = benchApp(productId)
  if (!app) return { text: 'Not benchmarked', kind: 'none' }
  const r = app.tests[test.id]
  if (!r) return { text: 'Not measured', kind: 'gap' }
  if (!isMeasured(r)) return { text: r.result === 'did not finish' ? 'Did not finish' : 'Not measured', kind: 'gap', cause: r.cause }
  const peers = ranked.map(a => a.tests[test.id]).filter(isMeasured).map(x => x.median)
  const rank = 1 + peers.filter(v => test.better === 'lower' ? v < r.median : v > r.median).length
  const c = control?.tests[test.id]
  return {
    text: formatValue(r, test.extra ? app.tests[test.extra] : undefined), kind: 'value', rank, of: peers.length, runs: r.runs,
    range: r.runs > 1 && r.min !== r.max ? `${formatValue({ ...r, median: r.min })} to ${formatValue({ ...r, median: r.max })}` : undefined,
    control: isMeasured(c) ? formatValue(c, test.extra ? control!.tests[test.extra] : undefined) : undefined,
  }
}
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const ademarkMeasured = longDate(ademark.measuredAt)
// ADEMark marks its results stale after 60 days; the site shows the same note.
export const ademarkStale = (asOf = new Date().toISOString().slice(0, 10)) => (Date.parse(asOf) - Date.parse(ademark.measuredAt)) / 86_400_000 > 60
export const ademarkSetup = `${ademark.results.machine} · ${ademark.results.model}`
