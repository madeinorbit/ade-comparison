import { createFilter, emptyState, matchesProductQuery, parseProducts, parseState, presets, promptFor, serializeState } from '../lib/filter'
import { groupLabel, groupLabels } from '../lib/view'
import type { FinderState } from '../lib/filter'
import type { Index } from '../lib/types'
import { loadFinderData } from '../lib/finder-data-client'
import type { FinderData } from '../lib/finder-data-client'
import { track, debounced } from '../lib/track'

type Group = keyof typeof groupLabels
const MAX_COMPARE = 4
const BENCH = 'ademark'
const list = (a: string[]) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`

// The rows beyond the first few of each group are not in the page. They are built here from the fetched data,
// in the same markup the server renders (src/components/Entry.astro).
function node<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.append(...kids)
  return el
}
const vh = (text: string) => node('span', { class: 'vh' }, text)
function buildCard(p: FinderData['products'][number]) {
  const c = p.card!, href = `/ade/${p.id}/`
  const shot = node('a', { class: 'e-shot', href, tabindex: '-1', 'aria-hidden': 'true', 'data-open': '' },
    c.shot ? node('img', { src: `/media/${c.shot[0]}`, width: String(c.shot[1]), height: String(c.shot[2]), loading: 'lazy', decoding: 'async', alt: '' }) : node('span', { class: 'e-noshot' }, p.name))
  const text: Node[] = [node('h3', {}, node('a', { 'data-product-name': '', 'data-open': '', href }, p.name))]
  if (c.when) text.push(node('p', { class: 'e-when' }, c.when), node('p', { class: 'e-sum' }, node('span', { class: 'e-note' }, `${c.sum} `), node('a', { href: `${href}#lifecycle` }, 'Shutdown notice', vh(` for ${p.name}`))))
  else text.push(node('p', { class: 'e-sum' }, c.sum))
  if (c.stars || c.bench) text.push(node('p', { class: 'e-stars' },
    ...(c.stars ? [`${c.stars[0].toLocaleString('en-GB')} GitHub stars `, node('span', {}, `on ${c.stars[1]}`)] : []),
    ...(c.bench ? [node('a', { class: 'e-bench', href: `${href}#ademark` }, 'Benchmarked by ADEMark')] : [])))
  text.push(node('ul', { class: 'fit', 'data-fit': '', 'aria-label': `What ${p.name} has from your list`, hidden: '' }),
    node('button', { type: 'button', class: 'add needs-js', 'data-compare': p.id, 'aria-pressed': 'false' }, node('span', { class: 'add-box', 'aria-hidden': 'true' }), 'Compare', vh(` ${p.name}`)))
  return node('li', { class: 'e', 'data-product-id': p.id, ...(c.stars ? { 'data-stars': String(c.stars[0]) } : {}) }, shot, node('div', { class: 'e-txt' }, ...text))
}

function initializeFinder(data: FinderData) {
  const { requirements, sunsetIds, baseUrl, shortLabels, shown, seed } = data
  // Row order is the bitset row order. The first rows of each group are already in the page; the rest are built now.
  const index: Index = { ...data.index, products: data.products.map(p => ({ id: p.id, name: p.name, website: null,
    ...(p.former ? { formerNames: p.former } : {}), researchStatus: p.card ? 'covered' as const : 'not-researched' as const })) }
  const stars = Object.fromEntries(data.products.flatMap(p => p.card?.stars ? [[p.id, p.card.stars[0]]] : []))
  const filter = createFilter(index, requirements, sunsetIds, stars, seed)
  const label = (key: string) => shortLabels[key] || key
  const comparable = index.products.filter(p => p.researchStatus === 'covered')
  const nameOf = new Map(index.products.map(p => [p.id, p.name]))
  let state: FinderState = parseState(location.search, requirements)
  let compared = parseProducts(location.search, comparable)
  const all: Record<string, boolean> = {}

  const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!
  const present = new Map([...document.querySelectorAll<HTMLElement>('.e[data-product-id]')].map(el => [el.dataset.productId!, el]))
  const cards = new Map(data.products.filter(p => p.card).map(p => [p.id, present.get(p.id) || buildCard(p)]))
  const lists = Object.fromEntries((Object.keys(groupLabels) as Group[]).map(k => [k, $(`[data-group=${k}]`)])) as Record<Group, HTMLElement>
  const pool = $('#entry-pool')
  const words = [...document.querySelectorAll<HTMLButtonElement>('[data-word]')]
  const query = $<HTMLInputElement>('#find-name')
  const status = $('#finder-status')
  const tray = $('#compare-tray')
  const sort = $<HTMLFieldSetElement>('#finder-sort')
  const sortPhone = $<HTMLSelectElement>('#sort-m')
  const need = $('#finder-controls')
  const sheet = $('#need-sheet')
  const opener = $<HTMLButtonElement>('#need-open')
  const picks = $('#need-picks')
  const groupOf = new Map([...document.querySelectorAll<HTMLElement>('[data-word]')].map(w => [w.dataset.word!, w.closest('.grp')?.querySelector('dt')?.textContent || '']))
  const orderNote = $('#order-note')
  const fitOrder = orderNote.textContent!
  const starred = Number(orderNote.dataset.starred)

  function href(extra?: URLSearchParams) {
    const p = new URLSearchParams(serializeState(state))
    if (compared.length) p.set('products', compared.join(','))
    extra?.forEach((v, k) => p.set(k, v))
    return `${location.pathname}${p.size ? '?' + p : ''}`
  }
  function save(push = false) {
    // While an ADE dialog is open the address is the ADE's own. The Finder state is written back when it closes.
    if (location.pathname !== '/') return
    const url = href() + location.hash
    if (url !== location.pathname + location.search + location.hash) history[push ? 'pushState' : 'replaceState'](history.state, '', url)
  }
  // The selection travels to an ADE sheet and to Compare, so they can light up what you asked for.
  const selection = () => {
    const p = new URLSearchParams()
    if (state.must.length) p.set('must', state.must.join(','))
    if (state.nice.length) p.set('nice', state.nice.join(','))
    return p
  }

  function fitLine(el: HTMLElement, row: number, group: Group) {
    const ul = el.querySelector<HTMLElement>('[data-fit]')
    if (!ul) return
    const items: [string, string, boolean][] = []
    // In Fits every must-have is a yes, so they go in one tick; elsewhere each one is named.
    // ADEMark is shown by the card's badge, not in this list, but it still counts toward "All N must-haves".
    if (group === 'fits' && state.must.length > 1) items.push([`All ${state.must.length} must-haves`, 'yes', false])
    else for (const key of state.must) if (key !== BENCH) items.push([key, filter.answer(row, key), false])
    for (const key of state.nice) { const a = filter.answer(row, key); if (key !== BENCH && a !== 'unknown') items.push([key, a, true]) }
    benchBadge(el, row)
    ul.replaceChildren(...items.map(([key, answer, nice]) => {
      const li = document.createElement('li')
      li.className = `${answer === 'yes' ? 'y' : answer === 'no' ? 'n' : 'u'}${nice ? ' nice' : ''}`
      const sr = document.createElement('span'); sr.className = 'vh'
      sr.textContent = answer === 'yes' ? 'Has ' : answer === 'no' ? 'Lacks ' : 'Not stated: '
      const text = document.createElement('span'); text.textContent = label(key)
      li.append(sr, text)
      return li
    }))
    ul.hidden = items.length === 0
  }

  // The ADEMark badge carries the pick: filled for a must-have, ticked for a nice-to-have. An ADE ADEMark has not
  // tested gets a dashed "Not tested by ADEMark yet" only when ADEMark is a must-have: unknown, never a no.
  function benchBadge(el: HTMLElement, row: number) {
    const pick = state.must.includes(BENCH) ? 'must' : state.nice.includes(BENCH) ? 'nice' : ''
    const badge = el.querySelector<HTMLAnchorElement>('a.e-bench')
    if (badge) {
      if (pick) badge.dataset.pick = pick; else delete badge.dataset.pick
      badge.querySelector('.vh')?.remove()
      if (pick) badge.append(Object.assign(document.createElement('span'), { className: 'vh', textContent: pick === 'must' ? ', one of your must-haves' : ', one of your nice-to-haves' }))
      return
    }
    el.querySelector('[data-bench-unknown]')?.remove()
    const line = el.querySelector<HTMLElement>('.e-stars[data-bench-line]')
    if (line && !line.childElementCount) line.remove()
    if (pick !== 'must' || filter.answer(row, BENCH) !== 'unknown') return
    const unknown = Object.assign(document.createElement('span'), { className: 'e-bench', textContent: 'Not tested by ADEMark yet' })
    unknown.dataset.benchUnknown = ''
    let stars = el.querySelector<HTMLElement>('.e-stars')
    if (!stars) {
      stars = Object.assign(document.createElement('p'), { className: 'e-stars' })
      stars.dataset.benchLine = ''
      el.querySelector('[data-fit]')!.before(stars)
    }
    stars.append(unknown)
  }

  function updateCompare() {
    const full = compared.length >= MAX_COMPARE
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-compare]')) {
      const on = compared.includes(btn.dataset.compare!)
      btn.setAttribute('aria-pressed', String(on))
      if (full && !on) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled')
    }
    tray.dataset.on = String(compared.length > 0)
    $('#compare-count .tray-n').textContent = `${compared.length} of ${MAX_COMPARE}`
    $('#compare-names').textContent = compared.length ? list(compared.map(id => nameOf.get(id) || id)) : 'Pick up to 4 ADEs'
    const go = $<HTMLAnchorElement>('#compare-link')
    const p = selection(); p.set('products', compared.join(','))
    go.href = `/compare/?${p}`
    if (compared.length < 2) { go.setAttribute('aria-disabled', 'true'); go.textContent = 'Pick one more' }
    else { go.removeAttribute('aria-disabled'); go.textContent = `Compare ${compared.length}` }
  }

  function render(announce = true) {
    const result = filter.run(state)
    const counts: Record<Group, number> = { fits: 0, 'kind-of': 0, 'shutting-down': 0 }
    const last: Record<Group, Element | null> = { fits: null, 'kind-of': null, 'shutting-down': null }
    const placed = new Set<string>()
    for (const r of result) {
      counts[r.group]++
      const el = cards.get(r.product.id)!
      placed.add(r.product.id)
      // Skip the DOM write when a result already sits in the right place: reorders are the costly part.
      const target = lists[r.group]
      if (el.parentElement !== target || el.previousElementSibling !== last[r.group]) target.insertBefore(el, last[r.group] ? last[r.group]!.nextElementSibling : target.firstElementChild)
      last[r.group] = el
      fitLine(el, r.index, r.group)
    }
    for (const [id, el] of cards) if (!placed.has(id) && el.parentElement !== pool) pool.append(el)
    const picked = state.must.length + state.nice.length > 0
    for (const key of Object.keys(counts) as Group[]) {
      $(`[data-count=${key}]`).textContent = String(counts[key])
      $(`[data-group-label=${key}]`).textContent = groupLabel(key)
      $(`[data-empty=${key}]`).hidden = counts[key] > 0
      const more = $<HTMLButtonElement>(`[data-more=${key}]`)
      more.hidden = counts[key] <= shown
      more.textContent = all[key] ? 'Show fewer' : `Show ${counts[key] - shown} more`
      more.setAttribute('aria-expanded', String(Boolean(all[key])))
      lists[key].toggleAttribute('data-all', Boolean(all[key]))
    }
    $('[data-note=fits]').textContent = !state.must.length ? (picked ? 'No must-haves yet, so every ADE fits. Press a word twice to make it a nice-to-have, once for a must-have.' : 'Pick what you need above. Until then, every ADE fits.')
      : `Has all ${state.must.length === 1 ? 'of your 1 must-have' : `${state.must.length} must-haves`}.`
    for (const w of words) {
      const key = w.dataset.word!
      const v = state.must.includes(key) ? 'true' : state.nice.includes(key) ? 'mixed' : 'false'
      if (w.getAttribute('aria-pressed') !== v) w.setAttribute('aria-pressed', v)
      w.querySelector('[data-word-state]')!.textContent = v === 'true' ? ', must-have' : v === 'mixed' ? ', nice-to-have' : ''
    }
    const summary = state.must.length ? list(state.must.map(label)) + (state.nice.length ? `, plus ${state.nice.length} nice-to-have${state.nice.length === 1 ? '' : 's'}` : '') : state.nice.length ? `Nice to have: ${list(state.nice.map(label))}` : 'Nothing picked yet'
    // Phone: the situation card, the sticky bar's count and pick chips, and the sheet's button.
    const situation = presets.find(p => p.id === state.preset)
    need.dataset.picked = String(picked)
    $('#situation-kind').textContent = situation ? 'Your situation' : 'Your picks'
    $('#situation-name').textContent = situation ? situation.label : summary
    const count = $('#need-count'), n = state.must.length + state.nice.length
    count.hidden = !n; count.textContent = String(n)
    picks.hidden = !n
    picks.replaceChildren(...[...state.must.map(k => [k, false] as const), ...state.nice.map(k => [k, true] as const)].map(([key, nice]) => {
      const li = document.createElement('li'), btn = document.createElement('button')
      if (nice) li.className = 'nice'
      btn.type = 'button'; btn.dataset.unpick = key
      btn.append(label(key), vh(nice ? ', nice-to-have. Remove' : ', must-have. Remove'))
      btn.insertAdjacentHTML('beforeend', '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>')
      li.append(btn)
      return li
    }))
    $('#sheet-go').textContent = state.must.length ? `Show ${counts.fits} that fit` : `Show all ${counts.fits}`
    if (query.value !== state.query) query.value = state.query
    for (const radio of sort.querySelectorAll<HTMLInputElement>('input')) radio.checked = radio.value === state.sort
    sortPhone.value = state.sort
    orderNote.textContent = state.sort === 'stars' ? `Most must-haves first, then most GitHub stars. ${starred} of ${comparable.length} ADEs have a public count; the rest follow by fit. Stars measure attention, not quality.`
      : state.sort === 'name' ? 'A to Z within each group.' : fitOrder
    const preset = presets.find(p => p.id === state.preset)
    $('#preset-note').textContent = preset?.note ?? ''
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-preset]')) {
      if (link.dataset.preset === state.preset) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current')
    }
    const directory = $('#name-matches')
    directory.hidden = !state.query
    const matches = state.query ? index.products.filter(p => matchesProductQuery(p, state.query, sunsetIds.includes(p.id))) : []
    $('#directory-search-results').replaceChildren(...matches.map(p => {
      const item = document.createElement('li'), link = document.createElement('a')
      link.href = `/ade/${p.id}/`; link.textContent = p.name; item.append(link)
      if (sunsetIds.includes(p.id)) item.append(document.createTextNode(' · shutting down'))
      return item
    }))
    $('#name-empty').hidden = matches.length > 0
    $<HTMLTextAreaElement>('#agent-prompt').value = promptFor(state, requirements, baseUrl)
    $('#prompt-picks').textContent = [state.must.length ? `must-have ${list(state.must.map(label))}` : '', state.nice.length ? `nice-to-have ${list(state.nice.map(label))}` : ''].filter(Boolean).join('; ') || 'nothing picked yet, so it asks about every ADE'
    // ADE links carry the selection, so the sheet can light up what you asked for.
    const sel = selection().toString()
    for (const a of document.querySelectorAll<HTMLAnchorElement>('.e a[data-open]')) {
      const base = a.getAttribute('href')!.split('?')[0]
      a.setAttribute('href', sel ? `${base}?${sel}` : base)
    }
    updateCompare()
    if (announce) status.textContent = `${counts.fits} fit. ${counts['kind-of']} fit kind of. ${counts['shutting-down']} fit but shutting down.`
  }

  // One event per settled selection: which needs people combine, and how many ADEs meet them.
  const sendSelection = debounced((params: Record<string, string | number | undefined>) => track('selection', params), 2500)
  const trackSelection = () => {
    if (!state.must.length && !state.nice.length) return
    sendSelection({ must: [...state.must].sort().join(','), nice: [...state.nice].sort().join(','), must_count: state.must.length, nice_count: state.nice.length,
      preset: state.preset || undefined, fits_count: Number($('[data-count=fits]').textContent), kind_of_count: Number($('[data-count=kind-of]').textContent) })
  }
  const trackSearch = debounced(() => {
    if (state.query.trim().length < 2) return
    const n = $('#directory-search-results').childElementCount
    track('name_search', { search_term: state.query.trim().toLowerCase().slice(0, 60), results_count: n, found: n > 0 })
  }, 1500)
  const closeTips = (except?: Element) => document.querySelectorAll('.wt[data-open]').forEach(t => { if (t !== except) { t.removeAttribute('data-open'); t.querySelector('.wi')?.setAttribute('aria-expanded', 'false') } })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTips() })

  // The phone's needs sheet: a modal over the page, opened from the sticky bar.
  const sheetOpen = () => sheet.dataset.open === 'true'
  function openSheet() {
    sheet.dataset.open = 'true'
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'need-title')
    opener.setAttribute('aria-expanded', 'true')
    sheet.querySelector<HTMLElement>('.sheet-x')!.focus()
    track('needs_sheet_open')
  }
  function closeSheet(results = false) {
    sheet.dataset.open = 'false'
    for (const a of ['role', 'aria-modal', 'aria-labelledby']) sheet.removeAttribute(a)
    opener.setAttribute('aria-expanded', 'false')
    if (results) $('#results').scrollIntoView({ block: 'start' })
    opener.focus({ preventScroll: results })
  }
  document.addEventListener('keydown', e => {
    if (!sheetOpen()) return
    if (e.key === 'Escape' && !document.querySelector('.wt[data-open]')) { closeSheet(); return }
    if (e.key !== 'Tab') return
    // Keep keyboard focus inside the sheet while it is open.
    const focusable = [...sheet.querySelectorAll<HTMLElement>('button, a[href]')].filter(el => el.offsetParent !== null)
    const first = focusable[0], last = focusable.at(-1)!
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  })

  document.addEventListener('click', e => {
    const target = e.target as HTMLElement
    if (target === opener || opener.contains(target)) { openSheet(); return }
    if (sheetOpen() && target === sheet) { closeSheet(); return }
    const close = target.closest<HTMLElement>('[data-sheet-close]')
    if (close) { closeSheet(close.hasAttribute('data-sheet-go')); return }
    const unpick = target.closest<HTMLButtonElement>('[data-unpick]')
    if (unpick) {
      const key = unpick.dataset.unpick!
      state.must = state.must.filter(k => k !== key); state.nice = state.nice.filter(k => k !== key); state.preset = null
      save(); render(false)
      opener.focus()
      track('filter_toggle', { filter_key: key, filter_label: label(key), filter_group: groupOf.get(key), filter_state: 'off', picks_count: state.must.length + state.nice.length, location: 'pick_chip' })
      trackSelection()
      status.textContent = `${label(key)} removed. ${$('[data-count=fits]').textContent} fit, ${$('[data-count=kind-of]').textContent} fit kind of.`
      return
    }
    const change = target.closest<HTMLButtonElement>('#situation-change')
    if (change) { need.toggleAttribute('data-sit-open', true); change.setAttribute('aria-expanded', 'true'); $<HTMLElement>('#pre-list a').focus(); return }
    if (target.closest('#pre-more')) { const pre = $('#pre-list'); pre.toggleAttribute('data-all', true); target.closest('#pre-more')!.setAttribute('aria-expanded', 'true'); pre.querySelector<HTMLElement>('a:nth-child(7)')?.focus(); return }
    const tip = target.closest<HTMLButtonElement>('[data-tip-for]')
    closeTips(tip?.parentElement || undefined)
    if (tip) {
      const wrap = tip.parentElement!, open = !wrap.hasAttribute('data-open')
      wrap.toggleAttribute('data-open', open); tip.setAttribute('aria-expanded', String(open))
      if (open) track(tip.dataset.tipFor === 'sort' ? 'sort_info_open' : 'filter_info_open', { filter_key: tip.dataset.tipFor })
      return
    }
    const word = target.closest<HTMLButtonElement>('[data-word]')
    if (word) {
      const key = word.dataset.word!
      // One press makes a must-have, a second a nice-to-have, a third clears it.
      if (state.must.includes(key)) { state.must = state.must.filter(k => k !== key); state.nice = [...state.nice, key] }
      else if (state.nice.includes(key)) state.nice = state.nice.filter(k => k !== key)
      else state.must = [...state.must, key]
      state.preset = null
      save(); render(false)
      const now = state.must.includes(key) ? 'a must-have' : state.nice.includes(key) ? 'a nice-to-have' : 'off'
      track('filter_toggle', { filter_key: key, filter_label: label(key), filter_group: groupOf.get(key), filter_state: now === 'off' ? 'off' : now === 'a must-have' ? 'must' : 'nice', picks_count: state.must.length + state.nice.length })
      trackSelection()
      status.textContent = `${label(key)} is ${now}. ${$('[data-count=fits]').textContent} fit, ${$('[data-count=kind-of]').textContent} fit kind of.`
      return
    }
    const preset = target.closest<HTMLAnchorElement>('[data-preset]')
    if (preset && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey && !(e as MouseEvent).shiftKey && !(e as MouseEvent).altKey) {
      e.preventDefault()
      const keep = state.query
      const order = state.sort
      state = parseState(new URL(preset.href).search, requirements); state.query = keep; state.sort = order
      need.removeAttribute('data-sit-open'); $('#situation-change').setAttribute('aria-expanded', 'false')
      save(true); render()
      track('preset_select', { preset: preset.dataset.preset }); trackSelection()
      return
    }
    const add = target.closest<HTMLButtonElement>('[data-compare]')
    if (add) {
      const id = add.dataset.compare!
      if (compared.includes(id)) compared = compared.filter(x => x !== id)
      else if (compared.length >= MAX_COMPARE) { status.textContent = `You can compare ${MAX_COMPARE} at a time. Remove one first.`; return }
      else compared = [...compared, id]
      save(); updateCompare()
      track(compared.includes(id) ? 'compare_add' : 'compare_remove', { ade_id: id, compare_count: compared.length, location: add.closest('dialog') ? 'dialog' : 'finder_card' })
      return
    }
    const more = target.closest<HTMLButtonElement>('[data-more]')
    if (more) { all[more.dataset.more!] = !all[more.dataset.more!]; render(false); if (all[more.dataset.more!]) track('show_more', { group: more.dataset.more }); return }
    const go = target.closest<HTMLAnchorElement>('#compare-link')
    if (go && compared.length > 1) track('compare_start', { ade_ids: [...compared].sort().join(','), compare_count: compared.length, location: 'tray' })
    const open = target.closest<HTMLAnchorElement>('a[data-open]')
    if (open) {
      const card = open.closest<HTMLElement>('.e'), list = card?.parentElement
      if (card && list) track('detail_open', { ade_id: card.dataset.productId, group: list.dataset.group, position: [...list.children].indexOf(card) + 1, sort: state.sort, has_picks: state.must.length + state.nice.length > 0 })
    }
    if (target.closest('#compare-clear')) { compared = []; save(); updateCompare(); status.textContent = 'Compare cleared.'; return }
    if (target.closest('#reset-finder, [data-reset]')) { need.removeAttribute('data-sit-open'); state = { ...emptyState(), query: state.query, sort: state.sort }; save(true); render(); track('filters_reset'); return }
  })
  // A sheet opened over the Finder shows the same compare state as the list.
  document.addEventListener('sheet:open', updateCompare)
  sort.addEventListener('change', e => {
    const v = (e.target as HTMLInputElement).value
    state.sort = v === 'stars' || v === 'name' ? v : 'fit'; save(); render()
    track('sort_change', { sort: state.sort, has_picks: state.must.length + state.nice.length > 0 })
  })
  sortPhone.addEventListener('change', () => {
    const v = sortPhone.value
    state.sort = v === 'stars' || v === 'name' ? v : 'fit'; save(); render()
    track('sort_change', { sort: state.sort, has_picks: state.must.length + state.nice.length > 0 })
  })
  query.form!.addEventListener('submit', e => { e.preventDefault(); state.query = query.value; save(); render(); trackSearch() })
  query.addEventListener('input', () => { state.query = query.value; save(); render(); trackSearch() })
  addEventListener('popstate', () => {
    if (location.pathname !== '/') return
    state = parseState(location.search, requirements)
    // Compare picks are not history entries (they replace the address), so Back keeps them,
    // including Back out of an ADE dialog where they were picked.
    render(); save()
  })
  // Most of the rows are built just now, so place every card even when the first paint was already right.
  render(false)
  delete document.documentElement.dataset.statePending
}

// The data loads after the page does, so the first paint never waits for it. A shared URL needs it at once.
// An interaction that arrives before the data is held, then replayed once the Finder is ready.
const region = document.querySelector<HTMLElement>('[data-url-state]')!
const events = ['focusin', 'pointerdown', 'keydown', 'click', 'input', 'change']
let started = false
function start(first?: Event) {
  if (started) return
  started = true
  events.forEach(type => region.removeEventListener(type, onFirst, true))
  const target = first?.target as HTMLElement | undefined
  // A click is stopped and replayed. Typing and radio changes already took effect natively; they are re-sent.
  if (first?.type === 'click') { first.preventDefault(); first.stopImmediatePropagation() }
  loadFinderData().then(data => {
    initializeFinder(data)
    if (!first || !target?.isConnected) return
    if (first.type === 'click') target.click()
    else if (first.type === 'input' || first.type === 'change') target.dispatchEvent(new Event(first.type, { bubbles: true }))
  }, () => { delete document.documentElement.dataset.statePending; started = false; events.forEach(type => region.addEventListener(type, onFirst, { capture: true })) })
}
function onFirst(e: Event) { start(e) }
if (location.search) start()
else {
  events.forEach(type => region.addEventListener(type, onFirst, { capture: true }))
  // Fetch in idle time after load, so the controls are usually ready before the first press.
  addEventListener('load', () => (window.requestIdleCallback || setTimeout)(() => loadFinderData().catch(() => {})), { once: true })
}
