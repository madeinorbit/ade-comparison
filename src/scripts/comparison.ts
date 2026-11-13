import { answersDiffer } from '../lib/view'
import { markWanted, refreshAges } from '../lib/client'
import { track } from '../lib/track'
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
// A pair page has no product picker; its two names come from the column headings.
const nameOf = new Map(inputs.length ? inputs.map(el => [el.dataset.tableProduct!, el.parentElement!.textContent!.trim()])
  : [...root.querySelectorAll<HTMLElement>('thead [data-column-id]')].map(el => [el.dataset.columnId!, el.querySelector('.cmp-name')!.textContent!.trim()]))
// The add pickers are searchable comboboxes: type part of a name, pick with the arrow keys and Enter.
// They work on any catalog size and need no library, so this page stays as light as the rest.
const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const catalog = [...nameOf].map(([id, name]) => ({ id, name, key: fold(name) })).sort((a, b) => a.name.localeCompare(b.name, 'en'))
function picker(box: HTMLElement) {
  const input = box.querySelector('input')!, list = box.querySelector('ul')!
  let items: typeof catalog = [], active = -1
  const place = () => {
    // Fixed, so the scrolling table never clips the list.
    const r = input.getBoundingClientRect()
    const below = innerHeight - r.bottom
    list.style.position = 'fixed'; list.style.left = `${Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 256) - 8))}px`
    list.style.width = `${Math.max(r.width, 256)}px`
    if (below < 240 && r.top > below) { list.style.top = 'auto'; list.style.bottom = `${innerHeight - r.top + 4}px` } else { list.style.bottom = 'auto'; list.style.top = `${r.bottom + 4}px` }
    list.style.maxHeight = `${Math.max(160, Math.min(352, (list.style.top === 'auto' ? r.top : below) - 16))}px`
  }
  const highlight = (name: string, q: string) => {
    const li = document.createElement('span'), i = q ? fold(name).indexOf(q) : -1
    if (i < 0) { li.textContent = name; return li }
    const m = document.createElement('mark'); m.textContent = name.slice(i, i + q.length)
    li.append(name.slice(0, i), m, name.slice(i + q.length)); return li
  }
  const setActive = (n: number) => {
    active = n
    list.querySelectorAll<HTMLElement>('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === n)))
    const li = list.children[n] as HTMLElement | undefined
    if (li?.id) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }) } else input.removeAttribute('aria-activedescendant')
  }
  const fill = () => {
    const q = fold(input.value.trim())
    // Names that start with the query come first, then names that contain it.
    items = q ? [...catalog.filter(c => c.key.startsWith(q)), ...catalog.filter(c => !c.key.startsWith(q) && c.key.includes(q))] : catalog
    list.replaceChildren(...items.slice(0, 80).map((c, i) => {
      const li = document.createElement('li'); li.id = `${list.id}-${i}`; li.setAttribute('role', 'option'); li.dataset.id = c.id
      if (selected.includes(c.id)) { li.setAttribute('aria-disabled', 'true'); li.append(highlight(c.name, q), ' · added') } else li.append(highlight(c.name, q))
      return li
    }))
    if (!items.length) { const li = document.createElement('li'); li.className = 'cbx-empty'; li.textContent = 'No researched ADE by that name'; list.append(li) }
    setActive(items.findIndex(c => !selected.includes(c.id)))
  }
  const open = () => { fill(); list.hidden = false; input.setAttribute('aria-expanded', 'true'); place() }
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant') }
  const choose = (id: string | undefined) => {
    if (!id || selected.includes(id)) return
    const query = input.value.trim()
    input.value = ''; close()
    track('compare_add', { ade_id: id, compare_count: selected.length + 1, location: 'compare_picker', searched: query.length > 0 })
    set([...selected.filter(x => x !== id), id]).then(() => {
      if (!pairPage) root.querySelector<HTMLElement>(`thead [data-column-id="${CSS.escape(id)}"] .cmp-name`)?.focus()
    })
  }
  input.addEventListener('focus', open)
  input.addEventListener('click', () => { if (list.hidden) open() })
  input.addEventListener('input', () => { if (list.hidden) open(); else { fill(); place() } })
  input.addEventListener('blur', () => setTimeout(close, 120))
  input.addEventListener('keydown', e => {
    const step = (d: number) => { if (list.hidden) open(); let n = active; do { n = (n + d + items.length) % items.length } while (items.length && selected.includes(items[n].id) && n !== active); setActive(n) }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]?.id) }
    else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close() } else input.value = '' }
  })
  // pointerdown, so the choice lands before the input blurs.
  list.addEventListener('pointerdown', e => { e.preventDefault(); choose((e.target as HTMLElement).closest<HTMLElement>('[role=option]')?.dataset.id) })
  addEventListener('resize', () => { if (!list.hidden) place() })
  addEventListener('scroll', () => { if (!list.hidden) place() }, { capture: true, passive: true })
}
root.querySelectorAll<HTMLElement>('[data-add]').forEach(picker)
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
// Compare renders its starting columns. Any other researched ADE is fetched when someone adds it.
interface Column { id: string; name: string; closing: boolean; shot: { src: string; width: number; height: number } | null; cells: Record<string, [string, string, string, string]> }
const loaded = new Set([...root.querySelectorAll<HTMLElement>('thead [data-column-id]')].map(el => el.dataset.columnId!))
const pending = new Map<string, Promise<void>>()
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}
const beforeSlots = (row: Element) => row.querySelector(':scope > [data-slot]')
function addColumn(c: Column) {
  if (loaded.has(c.id)) return
  loaded.add(c.id)
  const head = table.tHead!.rows[0]
  const th = el('th', { scope: 'col', hidden: true }, el('a', { className: 'cmp-name', href: `/ade/${c.id}/`, textContent: c.name }))
  th.dataset.columnId = c.id
  if (c.closing) { const notice = el('a', { className: 'cmp-closing', href: `/ade/${c.id}/#lifecycle`, textContent: 'Shutdown notice' }); notice.setAttribute('aria-label', `${c.name} shutdown notice`); th.append(notice) }
  const remove = el('button', { type: 'button', className: 'cmp-remove needs-js' }, 'Remove', el('span', { className: 'vh', textContent: ` ${c.name}` }))
  remove.dataset.remove = c.id
  th.append(remove)
  head.insertBefore(th, beforeSlots(head))
  const shots = root.querySelector('.cmp-shots tr')
  if (shots) {
    const td = el('td', { hidden: true }, c.shot ? el('img', { src: c.shot.src, width: c.shot.width, height: c.shot.height, loading: 'lazy', decoding: 'async', alt: `${c.name} product interface` }) : el('span', { className: 'no-shot', textContent: 'No screenshot yet' }))
    td.dataset.columnId = c.id
    shots.insertBefore(td, beforeSlots(shots))
  }
  root.querySelectorAll<HTMLElement>('[data-requirement-row]').forEach(row => {
    const [raw, text, kind, href] = c.cells[row.dataset.requirementRow!] || ['unknown', 'Not listed', 'u', `/ade/${c.id}/`]
    const label = row.querySelector('th[scope=row]')!.textContent!.trim()
    // ADEMark rows have no receipt, so they are plain text; every other value links to its finding.
    const link = href ? el('a', { className: 'receipt-link', href, textContent: text }) : text
    if (typeof link !== 'string') link.setAttribute('aria-label', `${c.name}, ${label}: ${text}. Open finding.`)
    const td = el('td', { className: `v-${kind}`, hidden: true }, link)
    td.dataset.columnId = c.id
    row.insertBefore(td, beforeSlots(row))
    row.dataset.values = JSON.stringify({ ...JSON.parse(row.dataset.values!), [c.id]: raw })
  })
}
function load(id: string) {
  if (!pending.has(id)) pending.set(id, fetch(`/compare/columns/${encodeURIComponent(id)}.json`)
    .then(response => { if (!response.ok) throw new Error(`${response.status}`); return response.json() as Promise<Column> })
    .then(addColumn).finally(() => pending.delete(id)))
  return pending.get(id)!
}
// Render now when every chosen column is here; otherwise fetch the missing ones first.
function show(announce = true): Promise<void> {
  const missing = selected.filter(id => !loaded.has(id))
  if (!missing.length) { render(announce); return Promise.resolve() }
  status.textContent = `Loading ${missing.map(id => nameOf.get(id) || id).join(', ')}.`
  return Promise.all(missing.map(load)).then(() => render(announce), () => {
    selected = selected.filter(id => loaded.has(id))
    render(false)
    status.textContent = 'Could not load an ADE you chose. Check your connection and try again.'
  })
}
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
function set(next: string[]) { selected = next.slice(0, max); save(); return show() }
root.querySelector('#table-controls')!.addEventListener('change', e => {
  if ((e.target as HTMLElement).closest('[data-add]')) return
  if (differences !== diffControl.checked) track('differences_toggle', { on: diffControl.checked, compare_count: selected.length })
  differences = diffControl.checked
  set(inputs.length ? inputs.filter(el => el.checked).map(el => el.dataset.tableProduct!) : selected)
})
root.querySelector('#table-controls')!.addEventListener('submit', e => { e.preventDefault(); save(); show() })
root.addEventListener('click', e => {
  const remove = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]')
  if (!remove) return
  track('compare_remove', { ade_id: remove.dataset.remove, compare_count: selected.length - 1, location: 'compare_table' })
  set(selected.filter(x => x !== remove.dataset.remove))
  if (!pairPage) root.querySelector<HTMLInputElement>('[data-slot]:not([hidden]) [data-add] input')?.focus()
})
addEventListener('popstate', () => { read(); show() })
const marked = markWanted(root, location.search)
refreshAges(root)
const ready = () => { delete document.documentElement.dataset.statePending }
if (location.search) { read(); show(marked.count > 0 || false).then(ready) } else { render(false); ready() }
// Which sets of ADEs people put side by side: the core signal of who competes with whom.
if (pairPage || (compare && new URLSearchParams(location.search).has('products'))) track('compare_view', { ade_ids: [...selected].sort().join(','), compare_count: selected.length, page_type: pairPage ? 'pair' : mode })
