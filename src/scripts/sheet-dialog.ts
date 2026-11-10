import { enhanceSheet } from '../lib/sheet-client'
// An ADE opens over the Finder in a dialog with its own URL. Back closes it, reload and shared links get the
// full page, and without JavaScript the same links simply navigate there.
const cache = new Map<string, Promise<string>>()
const fragment = (id: string) => {
  if (!cache.has(id)) cache.set(id, fetch(`/ade/${id}/sheet/`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text() }))
  const p = cache.get(id)!
  p.catch(() => cache.delete(id))
  return p
}
const idOf = (href: string) => new URL(href, location.href).pathname.match(/^\/ade\/([^/]+)\/$/)?.[1]
const labels = () => (JSON.parse(document.querySelector('#finder-data')?.textContent || '{}').shortLabels || {}) as Record<string, string>

const dialog = document.createElement('dialog')
dialog.className = 'ade-dialog'
dialog.innerHTML = '<div class="sd-bar"><a class="sd-full" href="/">Open the full page</a><button type="button" class="sd-close" data-close><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3.5 3.5 9 9m0-9-9 9"/></svg>Close</button></div><div class="sd-body"></div>'
document.body.append(dialog)
const body = dialog.querySelector<HTMLElement>('.sd-body')!
const full = dialog.querySelector<HTMLAnchorElement>('.sd-full')!
let opener: HTMLElement | null = null
let pageTitle = document.title
let pushed = false

async function open(id: string, url: string, push: boolean) {
  let html: string
  try { html = await fragment(id) } catch { location.assign(url); return }
  body.innerHTML = html
  const sheet = body.querySelector<HTMLElement>('[data-sheet]')
  if (!sheet) { location.assign(url); return }
  full.href = `/ade/${id}/`
  const heading = sheet.querySelector<HTMLElement>('h1')!
  dialog.setAttribute('aria-labelledby', heading.id)
  enhanceSheet(body, new URL(url, location.href).search, labels())
  if (push) { history.pushState({ sheet: id }, '', url); pushed = true }
  document.title = `${sheet.dataset.name} | ${pageTitle.split(' | ').at(-1)}`
  document.dispatchEvent(new CustomEvent('sheet:open'))
  if (!dialog.open) dialog.showModal()
  body.scrollTop = 0
  heading.focus({ preventScroll: true })
}
function close(fromHistory = false) {
  if (!dialog.open) return
  if (!fromHistory && pushed && history.state?.sheet) { history.back(); return }
  dialog.close()
}
dialog.addEventListener('close', () => {
  pushed = false
  document.title = pageTitle
  opener?.focus({ preventScroll: true })
})
dialog.addEventListener('cancel', e => { e.preventDefault(); close() })
dialog.addEventListener('click', e => {
  if (e.target === dialog || (e.target as HTMLElement).closest('[data-close]')) close()
})
addEventListener('popstate', () => {
  const id = idOf(location.pathname)
  if (id && history.state?.sheet === id) { open(id, location.pathname + location.search, false); pushed = true }
  else if (dialog.open) close(true)
})
document.addEventListener('click', e => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-open]')
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const id = idOf(link.href)
  if (!id) return
  e.preventDefault()
  opener = link.closest('.e')?.querySelector<HTMLElement>('h3 a') || link
  pageTitle = dialog.open ? pageTitle : document.title
  open(id, link.getAttribute('href')!, true)
})
// Fetch on intent, so the sheet is usually there before the click lands.
const warm = (e: Event) => {
  const link = (e.target as HTMLElement).closest?.<HTMLAnchorElement>('a[data-open]')
  const id = link && idOf(link.href)
  if (id) fragment(id).catch(() => {})
}
document.addEventListener('pointerover', warm, { passive: true })
document.addEventListener('focusin', warm)
