import { markWanted, refreshAges } from './client'
const list = (a: string[]) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`
// Reads the visitor's selection against one ADE sheet: lights up the facts they asked for and says how it fits.
export function enhanceSheet(root: ParentNode, search: string, labels: Record<string, string>) {
  refreshAges(root)
  const sheet = root.querySelector<HTMLElement>('[data-sheet]')
  if (!sheet) return
  const { must, nice } = markWanted(sheet, search)
  const box = sheet.querySelector<HTMLElement>('[data-sheet-fit]')
  if (!box) return
  const answers = JSON.parse(sheet.dataset.answers || '{}') as Record<string, 'y' | 'n'>
  const keys = [...must, ...nice].filter(k => labels[k])
  box.hidden = keys.length === 0
  if (!keys.length) return
  const has = (k: string) => answers[k] === 'y'
  const mustHas = must.filter(has).length
  const fits = must.length > 0 && mustHas === must.length
  const kind = !fits && mustHas * 2 > must.length
  box.classList.toggle('is-kind', !fits || sheet.dataset.closing === 'true')
  const nicePart = nice.length ? ` and ${nice.filter(has).length} of ${nice.length} nice-to-haves` : ''
  const closing = sheet.dataset.closing === 'true'
  box.querySelector('[data-verdict]')!.textContent = closing && (fits || kind) ? `Would fit, but is shutting down: has ${mustHas} of ${must.length} must-haves${nicePart}` : !must.length ? `Has ${nice.filter(has).length} of your ${nice.length} nice-to-haves`
    : fits ? `Fits: has all ${must.length === 1 ? 'of your 1 must-have' : `${must.length} must-haves`}${nicePart}`
    : kind ? `Fits kind of: has ${mustHas} of ${must.length} must-haves${nicePart}`
    : `Has ${mustHas} of your ${must.length} must-haves${nicePart}`
  const ul = box.querySelector<HTMLElement>('[data-fit]')!
  ul.setAttribute('aria-label', `Your list against ${sheet.dataset.name}`)
  ul.replaceChildren(...keys.flatMap(k => {
    const a = answers[k], isNice = !must.includes(k)
    if (isNice && !a) return []
    const li = document.createElement('li')
    li.className = `${a === 'y' ? 'y' : a === 'n' ? 'n' : 'u'}${isNice ? ' nice' : ''}`
    const sr = document.createElement('span'); sr.className = 'vh'; sr.textContent = a === 'y' ? 'Has ' : a === 'n' ? 'Lacks ' : 'Not stated: '
    const t = document.createElement('span'); t.textContent = labels[k]
    li.append(sr, t)
    return [li]
  }))
  // Compare and back links keep the selection.
  const sel = new URLSearchParams()
  if (must.length) sel.set('must', must.join(','))
  if (nice.length) sel.set('nice', nice.join(','))
  for (const a of sheet.querySelectorAll<HTMLAnchorElement>('[data-compare-link]')) {
    const u = new URL(a.href); sel.forEach((v, k) => u.searchParams.set(k, v)); a.href = u.pathname + u.search
  }
  return { must, nice, label: list(keys.map(k => labels[k])) }
}
