import type { Cell, LifecycleNotice, Product } from './types.ts'
import { facets, index, notices, requirements, screenshots, shortDate } from './data'

// The filter words, grouped. Keys are requirement keys. Groups and first words follow the core features
// people compare ADEs by: the agents, a worktree per task, routines, a native app, a phone, where agents run, team work and price.
export const wordGroups: { title: string; words: [key: string, label: string][] }[] = [
  { title: 'Agents', words: [['agents:codex', 'Codex'], ['agents:claude-code', 'Claude Code'], ['agents:cursor', 'Cursor Agent'], ['agents:opencode', 'OpenCode'], ['agents:gemini-cli', 'Gemini CLI'], ['agents:antigravity', 'Antigravity'], ['byo-subscription', 'Uses my subscription']] },
  { title: 'How it works', words: [['isolation:worktree', 'Worktree per task'], ['unattended-triggers', 'Scheduled runs'], ['parallel-runs', 'Parallel agents'], ['isolation:container', 'Containers'], ['coordinator', 'Coordinator agent'], ['issue-tracking', 'Built-in issues']] },
  { title: 'Where you work', words: [['any-desktop', 'Desktop app'], ['any-phone-client', 'Phone'], ['desktop-os:macos', 'Mac app'], ['desktop-os:windows', 'Windows app'], ['desktop-os:linux', 'Linux app'], ['web-client', 'Browser'], ['cli', 'Command line']] },
  { title: 'Where it runs', words: [['execution:local', 'On your computer'], ['execution:own-server', 'On your own server'], ['execution:vendor-cloud', "In the vendor's cloud"], ['laptop-independent', 'Keeps going with laptop closed']] },
  { title: 'Team and shipping', words: [['multiplayer', 'Team sessions'], ['roles', 'Team roles'], ['sso', 'SSO'], ['pr-workflow', 'Pull requests'], ['review-ui', 'Review screen']] },
  { title: 'Ownership', words: [['open-source-license', 'Open source'], ['self-hosting', 'Self-hosting']] },
  { title: 'Price', words: [['free-tier', 'Has a free plan'], ['pricing-model:no-paid-plan', 'Entirely free'], ['pricing-model:subscription', 'Subscription'], ['pricing-model:per-seat', 'Per seat'], ['pricing-model:usage-based', 'Usage-based'], ['pricing-model:compute', 'Per machine or compute'], ['pricing-model:byok', 'Bring your own key'], ['pricing-model:one-time', 'One-time purchase'], ['paid-up-to-20', 'Paid plan up to $20/month'], ['paid-up-to-40', 'Paid plan up to $40/month']] },
]
// What each filter word means, in two short sentences at most. Shown on hover, or behind the i on touch screens.
export const wordTips: Record<string, string> = {
  'agents:codex': 'Runs OpenAI’s Codex agent inside the ADE.',
  'agents:claude-code': 'Runs Anthropic’s Claude Code agent inside the ADE.',
  'agents:cursor': 'Runs the Cursor Agent CLI inside the ADE.',
  'agents:opencode': 'Runs the open-source OpenCode agent inside the ADE.',
  'agents:gemini-cli': 'Runs Google’s Gemini CLI agent inside the ADE.',
  'agents:antigravity': 'Runs Google’s Antigravity agent inside the ADE.',
  'byo-subscription': 'Sign in with the Claude, ChatGPT or other agent plan you already pay for. An API key alone does not count.',
  'isolation:worktree': 'Each task gets its own Git worktree, so parallel agents don’t edit the same files. It separates files; it is not a security sandbox.',
  'unattended-triggers': 'A schedule or an outside event, such as a new issue, can start an agent without you.',
  'parallel-runs': 'Several agent sessions can work at the same time.',
  'isolation:container': 'Agents can run inside a container, apart from the rest of your machine.',
  'coordinator': 'A lead agent can hand work to other agents and check on them.',
  'issue-tracking': 'The ADE has its own issues or tasks with a status, not just a list of chats.',
  'any-desktop': 'A desktop app for Mac, Windows or Linux. Any one of them counts.',
  'any-phone-client': 'Use it from a phone: an iPhone or Android app, or a phone browser.',
  'desktop-os:macos': 'A released desktop app for macOS.',
  'desktop-os:windows': 'A released desktop app for Windows.',
  'desktop-os:linux': 'A released desktop app for Linux.',
  'web-client': 'Work with the ADE in a web browser.',
  'cli': 'The ADE has its own command-line tool, apart from the agent’s CLI.',
  'execution:local': 'Agents run on the computer in front of you.',
  'execution:own-server': 'Agents run on a machine you control, such as a VPS, a home server or your own cloud account.',
  'execution:vendor-cloud': 'Agents run on machines the ADE company operates.',
  'laptop-independent': 'Work carries on on a remote machine after your laptop sleeps or goes offline.',
  'multiplayer': 'Several people can send instructions to the same agent session. Read-only share links don’t count.',
  'roles': 'Named team roles with documented permissions.',
  'sso': 'Sign in through your company’s single sign-on. Often limited to team or enterprise plans.',
  'pr-workflow': 'The ADE can open or manage pull requests for you.',
  'review-ui': 'A screen that shows the agent’s code changes as a diff for you to review.',
  'open-source-license': 'The main app is under an open-source licence: Apache-2.0, MIT, GPL-3.0 or AGPL-3.0.',
  'self-hosting': 'You can run the whole ADE on infrastructure you control.',
  'free-tier': 'You can use it without paying: a free plan or a free download. Paid plans may exist too.',
  'pricing-model:no-paid-plan': 'The ADE has no paid tier at all, as with most open-source tools. Agent or model costs can still apply.',
  'pricing-model:subscription': 'Charges a recurring monthly or yearly fee.',
  'pricing-model:per-seat': 'Team pricing charged per user.',
  'pricing-model:usage-based': 'Charges for what you use: tokens, credits or runtime.',
  'pricing-model:compute': 'Charges for machines, sandboxes or compute hours.',
  'pricing-model:byok': 'You plug in your own model provider key and pay the provider directly.',
  'pricing-model:one-time': 'Pay once for a licence instead of a subscription.',
  'paid-up-to-20': 'The cheapest paid plan costs $20 a month or less, billed monthly. Agent and model costs are extra.',
  'paid-up-to-40': 'The cheapest paid plan costs $40 a month or less, billed monthly. Agent and model costs are extra.',
}
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
const RUNS = { local: 'on your computer', 'own-server': 'on your own server', 'vendor-cloud': "in the vendor's cloud" }
const PRICING = { 'no-paid-plan': 'no paid plan', 'free-plan': 'free plan', subscription: 'subscription', 'per-seat': 'per seat', 'usage-based': 'usage-based', compute: 'per machine or compute', byok: 'bring your own key', 'one-time': 'one-time purchase' }
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
  if (runs.length) parts.push(`Agents run ${or(runs)}.`)
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
  const models = yesOptions(p, 'pricing-model', PRICING), paid = enumValue(p, 'paid-from')
  const from = price ? `${price}${free === 'yes' && !/free/i.test(price) ? ', free tier' : ''}` : free === 'yes' ? 'Free tier' : null
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
    multi('Agents run', 'execution', RUNS),
    flag('Laptop closed', 'laptop-independent', 'Keeps going'),
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
    { label: 'Price from', value: from, keys: ['free-tier', ...(facetOf('starting-price')?.options || []).map(o => `starting-price:${o.id}`)] },
    { label: 'How it charges', value: models.length ? list(models) : null, keys: Object.keys(PRICING).map(o => `pricing-model:${o}`) },
    { label: 'Paid plans from', value: paid, keys: (facetOf('paid-from')?.options || []).map(o => `paid-from:${o.id}`) },
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
