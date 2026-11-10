import type { Cell, LifecycleNotice, Product } from './types.ts'
import { facets, index, notices, requirements, screenshots, shortDate } from './data'

// The filter words, grouped. Keys are requirement keys. Groups and first words follow the core features
// people judge Conductor alternatives by: the agents, a worktree per task, routines, a native app, a phone, cloud runs, team work.
export const wordGroups: { title: string; words: [key: string, label: string][] }[] = [
  { title: 'Agents', words: [['agents:codex', 'Codex'], ['agents:claude-code', 'Claude Code'], ['agents:cursor', 'Cursor Agent'], ['agents:opencode', 'OpenCode'], ['agents:gemini-cli', 'Gemini CLI'], ['byo-subscription', 'Uses my subscription']] },
  { title: 'How it works', words: [['isolation:worktree', 'Worktree per task'], ['unattended-triggers', 'Scheduled runs'], ['parallel-runs', 'Parallel agents'], ['isolation:container', 'Containers'], ['coordinator', 'Coordinator agent'], ['issue-tracking', 'Built-in issues']] },
  { title: 'Where you work', words: [['any-desktop', 'Desktop app'], ['any-phone-client', 'Phone'], ['desktop-os:macos', 'Mac app'], ['desktop-os:windows', 'Windows app'], ['desktop-os:linux', 'Linux app'], ['web-client', 'Browser'], ['cli', 'Command line']] },
  { title: 'Where it runs', words: [['laptop-independent', 'Runs with laptop closed'], ['execution:vendor-cloud', 'In their cloud'], ['execution:own-server', 'On my server'], ['execution:local', 'On my machine']] },
  { title: 'Team and shipping', words: [['multiplayer', 'Team sessions'], ['roles', 'Team roles'], ['sso', 'SSO'], ['pr-workflow', 'Pull requests'], ['review-ui', 'Review screen']] },
  { title: 'Ownership', words: [['open-source-license', 'Open source'], ['self-hosting', 'Self-hosting'], ['free-tier', 'Free tier']] },
]
const shortLabels = Object.fromEntries(wordGroups.flatMap(g => g.words))
// A short label for every requirement: the word when there is one, the facet option otherwise.
export const shortLabel = (key: string) => shortLabels[key] || requirements.find(r => r.key === key)?.label.replace(/^[^:]+: /, '') || key

const facetOf = (id: string) => facets.find(f => f.id === id)
const cell = (p: Product, facet: string, option?: string): Cell | undefined => {
  const v = p.facets?.[facet] as (Cell & Record<string, Cell>) | undefined
  return option ? v?.[option] : v
}
const value = (p: Product, facet: string, option?: string) => cell(p, facet, option)?.value || 'unknown'
const list = (a: string[]) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`
const or = (a: string[]) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} or ${a.at(-1)}`
const yesOptions = (p: Product, facet: string, names: Record<string, string>) => Object.keys(names).filter(o => value(p, facet, o) === 'yes').map(o => names[o])
const OS = { macos: 'Mac', windows: 'Windows', linux: 'Linux' }
const PHONE = { ios: 'iPhone', android: 'Android', 'mobile-web': 'phone browser' }
const RUNS = { local: 'your machine', 'own-server': 'your server', 'vendor-cloud': 'their cloud' }
const OPEN = ['apache-2-0', 'mit', 'gpl-3-0', 'gpl-3-0-or-later', 'agpl-3-0', 'agpl-3-0-or-later']
const enumValue = (p: Product, facet: string) => { const v = value(p, facet); return v === 'unknown' ? null : facetOf(facet)?.options?.find(o => o.id === v)?.label || null }

// One line about what the ADE is, built only from confirmed facets: what you open and where agents run.
export function summary(p: Product): string {
  const oss = OPEN.includes(value(p, 'license')) ? 'Open-source ' : ''
  const os = yesOptions(p, 'desktop-os', OS)
  const what = os.length === 3 ? 'desktop app for Mac, Windows and Linux' : os.length ? `${list(os)} app` : value(p, 'web-client') === 'yes' ? 'browser app' : value(p, 'cli') === 'yes' ? 'command-line tool' : null
  const runs = yesOptions(p, 'execution', RUNS)
  const parts = []
  if (what) parts.push(`${(oss + what)[0].toUpperCase()}${(oss + what).slice(1)}.`)
  if (runs.length) parts.push(`Agents run on ${or(runs)}.`)
  return parts.join(' ') || 'An agent development environment.'
}

export interface Fact { label: string; value: string | null; no?: boolean; keys: string[] }
// Facts for the ADE sheet and Compare. Each lists the requirement keys it answers, so a selection can light it up.
export function facts(p: Product): Fact[] {
  const multi = (label: string, facet: string, names: Record<string, string>, extra: string[] = []): Fact => {
    const yes = yesOptions(p, facet, names)
    const allNo = Object.keys(names).every(o => value(p, facet, o) === 'no')
    return { label, value: yes.length ? list(yes) : allNo ? 'No' : null, no: !yes.length && allNo, keys: [...Object.keys(names).map(o => `${facet}:${o}`), ...extra] }
  }
  const flag = (label: string, facet: string, yes = 'Yes'): Fact => {
    const v = value(p, facet)
    return { label, value: v === 'yes' ? yes : v === 'no' ? 'No' : null, no: v === 'no', keys: [facet] }
  }
  const agents = Object.fromEntries((facetOf('agents')?.options || []).map(o => [o.id, o.label]))
  const isolation = Object.fromEntries((facetOf('isolation')?.options || []).map(o => [o.id, o.id === 'vm' ? 'VM' : o.label.replace(/^Git /, '')]))
  const licence = enumValue(p, 'license'), price = enumValue(p, 'starting-price'), free = value(p, 'free-tier')
  const team = [['multiplayer', 'shared sessions'], ['roles', 'roles'], ['sso', 'SSO']].filter(([f]) => value(p, f) === 'yes').map(([, l]) => l)
  const teamNo = ['multiplayer', 'roles', 'sso'].every(f => value(p, f) === 'no')
  const cap = (f: Fact): Fact => f.value ? { ...f, value: f.value[0].toUpperCase() + f.value.slice(1) } : f
  return [
    multi('Desktop app', 'desktop-os', OS, ['any-desktop']),
    flag('Browser', 'web-client'),
    multi('Phone', 'phone-client', PHONE, ['any-phone-client']),
    flag('Command line', 'cli'),
    multi('Agents', 'agents', agents),
    flag('Your subscription', 'byo-subscription', 'Works with your own plan'),
    multi('Agents run on', 'execution', RUNS),
    flag('Laptop closed', 'laptop-independent', 'Keeps running'),
    multi('Isolation', 'isolation', isolation),
    flag('Parallel agents', 'parallel-runs'),
    flag('Scheduled runs', 'unattended-triggers'),
    flag('Coordinator agent', 'coordinator'),
    flag('Built-in issues', 'issue-tracking'),
    flag('Pull requests', 'pr-workflow'),
    flag('Review screen', 'review-ui'),
    { label: 'Team', value: team.length ? list(team).replace(/^./, c => c.toUpperCase()) : teamNo ? 'No' : null, no: !team.length && teamNo, keys: ['multiplayer', 'roles', 'sso'] },
    flag('Self-hosting', 'self-hosting'),
    { label: 'Licence', value: licence, keys: ['open-source-license', ...(facetOf('license')?.options || []).map(o => `license:${o.id}`)] },
    { label: 'Price from', value: price ? `${price}${free === 'yes' && !/free/i.test(price) ? ', free tier' : ''}` : free === 'yes' ? 'Free tier' : null, keys: ['free-tier', ...(facetOf('starting-price')?.options || []).map(o => `starting-price:${o.id}`)] },
  ].map(cap)
}

export const shotFor = (id: string) => screenshots.find(s => s.productId === id)
export const noticeFor = (id: string) => notices.find(n => n.productId === id)
// The shutdown state in one line: what happens, and when.
export function shutdownLine(n: LifecycleNotice): string {
  const end = n.serviceEndDate as string | null | undefined
  if (end && end <= index.generatedAt) return `Closed ${shortDate(end)}`
  if (end) return `Shuts down ${shortDate(end)}`
  return `Announced ${shortDate(String(n.announcementDate))}, no end date yet`
}
export const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0]
export const hostname = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
