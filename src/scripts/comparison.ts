import { answersDiffer } from '../lib/view'
import { markWanted, refreshAges } from '../lib/client'
const root = document.querySelector<HTMLElement>('#comparison')!
const mode = root.dataset.mode!
const compare = mode === 'compare'
const slots = Number(root.dataset.slots || 0)
const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-table-product]')]
const initial = JSON.parse(root.dataset.initial!) as string[]
const pairPage = root.dataset.pair === 'true'
const max = compare ? 4 : inputs.length
let selected = initial
let differences = false
const status = root.querySelector<HTMLElement>('#table-status')!
const diffControl = root.querySelector<HTMLInputElement>('#differences')!
const scroller = root.querySelector<HTMLElement>('#comparison-scroll')!
const table = scroller.querySelector('table')!
const nameOf = new Map(inputs.map(el => [el.dataset.tableProduct!, el.parentElement!.textContent!.trim()]))
// The add menus are filled here: they only work with JavaScript, and pair pages stay small without them.
for (const select of root.querySelectorAll<HTMLSelectElement>('[data-add]')) for (const [id, name] of nameOf) select.add(new Option(name, id))
// Keyboard focus must not stay under the sticky headers, whose size depends on the content.
// The browser scrolls after this event, so correct on the next frame.
scroller.addEventListener('focusin', e => {
  const target = e.target as HTMLElement
  if (!target.closest('tbody td') || compare) return
  requestAnimationFrame(() => {
    const focus = target.getBoundingClientRect(), corner = scroller.querySelector('thead th')!.getBoundingClientRect()
    const bounds = scroller.getBoundingClientRect()
    const right = Math.min(bounds.left + scroller.clientLeft + scroller.clientWidth, innerWidth) - 6
    const bottom = Math.min(bounds.top + scroller.clientTop + scroller.clientHeight, innerHeight) - 6
    scroller.scrollBy({
      left: focus.left < corner.right + 6 ? focus.left - corner.right - 6 : Math.max(0, focus.right - right),
      top: focus.top < corner.bottom + 6 ? focus.top - corner.bottom - 6 : Math.max(0, focus.bottom - bottom),
    })
  })
})
function read() {
  const params = new URLSearchParams(location.search)
  selected = params.has('products') && !pairPage ? [...new Set(params.get('products')!.split(','))].filter(id => inputs.some(el => el.dataset.tableProduct === id)).slice(0, max) : initial
  differences = params.get('diff') === '1'
}
function render(announce = true) {
  const enough = selected.length >= (compare ? 2 : 1)
  inputs.forEach(input => {
    input.checked = selected.includes(input.dataset.tableProduct!)
    input.disabled = compare && selected.length === max && !input.checked
  })
  diffControl.checked = differences
  // Columns keep their place: a chosen ADE fills a column, the rest stay as empty slots, so nothing reflows.
  root.querySelectorAll<HTMLElement>('[data-column-id]').forEach(el => { el.hidden = !selected.includes(el.dataset.columnId!) })
  root.querySelectorAll<HTMLElement>('[data-slot]').forEach(el => { el.hidden = Number(el.dataset.slot) >= slots - selected.length })
  for (const select of root.querySelectorAll<HTMLSelectElement>('[data-add]')) {
    for (const option of select.options) option.disabled = Boolean(option.value) && selected.includes(option.value)
    select.value = ''
  }
  table.style.setProperty('--n', String(selected.length))
  let shown = 0
  root.querySelectorAll<HTMLElement>('[data-requirement-row]').forEach(row => {
    const values = JSON.parse(row.dataset.values!) as Record<string, string>
    const differ = answersDiffer(selected.map(id => values[id]))
    row.classList.toggle('is-diff', differ && selected.length > 1)
    row.hidden = differences && !differ
    if (!row.hidden) shown++
  })
  root.querySelectorAll<HTMLElement>('tbody[data-section]').forEach(section => { section.hidden = !section.querySelector('[data-requirement-row]:not([hidden])') })
  ;(root.querySelector('#same-answers') as HTMLElement).hidden = !enough || shown > 0
  const names = selected.map(id => nameOf.get(id) || id)
  if (announce || !enough) status.textContent = !enough ? (compare ? 'Choose at least 2 products to compare.' : 'Choose at least one product.')
    : compare ? `${names.join(', ')}. ${shown} rows${differences ? ' that differ' : ''}.` : `${selected.length} products. ${shown} requirements shown.`
}
function save() {
  const params = new URLSearchParams(location.search)
  params.set('products', selected.join(','))
  if (differences) params.set('diff', '1'); else params.delete('diff')
  const samePair = pairPage && selected.length === initial.length && selected.every(id => initial.includes(id))
  const url = (samePair ? location.pathname : compare ? '/compare/' : '/matrix/') + '?' + params
  // A pair page holds only its own columns, so another selection loads the full table.
  if (pairPage && !samePair) location.assign(url)
  else history.pushState(null, '', url)
}
function set(next: string[]) { selected = next.slice(0, max); save(); render() }
root.querySelector('#table-controls')!.addEventListener('change', e => {
  if ((e.target as HTMLElement).closest('[data-add]')) return
  differences = diffControl.checked
  set(inputs.filter(el => el.checked).map(el => el.dataset.tableProduct!))
})
root.querySelector('#table-controls')!.addEventListener('submit', e => { e.preventDefault(); save(); render() })
root.addEventListener('change', e => {
  const select = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-add]')
  if (!select || !select.value) return
  const id = select.value
  set([...selected.filter(x => x !== id), id])
  // Focus moves to the new column's name, so keyboard users land on what they added.
  if (!pairPage) root.querySelector<HTMLElement>(`thead [data-column-id="${CSS.escape(id)}"] .cmp-name`)?.focus()
})
root.addEventListener('click', e => {
  const remove = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]')
  if (!remove) return
  set(selected.filter(x => x !== remove.dataset.remove))
  if (!pairPage) root.querySelector<HTMLSelectElement>('[data-slot]:not([hidden]) [data-add]')?.focus()
})
addEventListener('popstate', () => { read(); render() })
const marked = markWanted(root, location.search)
refreshAges(root)
if (location.search) { read(); render(marked.count > 0 || false) } else render(false)

delete document.documentElement.dataset.statePending
