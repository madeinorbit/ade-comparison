// Product analytics: every event goes to the Google Tag Manager dataLayer as `ade_<name>`.
// GTM forwards them to GA4 (one GA4 Event tag on a Custom Event trigger matching ^ade_).
// Values are short ids, never free text a visitor typed, except the name search, which is
// what tells us which ADEs people look for and do not find.
type Params = Record<string, string | number | boolean | undefined>
declare global { interface Window { dataLayer?: unknown[] } }

export function track(name: string, params: Params = {}) {
  try { (window.dataLayer ||= []).push({ event: `ade_${name}`, ...params }) } catch { /* analytics never breaks the page */ }
}

// Fires once the value stops changing for `ms`, so typing or rapid toggling sends one event.
export function debounced<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: T) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
}

// Clicks anywhere on the site: outbound product links, GitHub actions, open-data files.
// Elements can name their own event with data-track="name" and data-track-* params.
export function trackClicks() {
  document.addEventListener('click', e => {
    const el = (e.target as Element).closest?.<HTMLElement>('[data-track], a[href]')
    if (!el) return
    const where = el.closest('header.bar') ? 'top_bar' : el.closest('footer') ? 'footer' : el.closest('dialog') ? 'dialog' : el.closest('[data-sheet]') ? 'ade_page' : location.pathname === '/' ? 'finder' : location.pathname.split('/')[1] || 'home'
    if (el.dataset.track) {
      const params: Params = { location: where }
      for (const [k, v] of Object.entries(el.dataset)) if (k.startsWith('track') && k !== 'track') params[k.slice(5).replace(/^./, c => c.toLowerCase()).replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)] = v
      track(el.dataset.track, params)
      return
    }
    const a = el as HTMLAnchorElement
    let url: URL
    try { url = new URL(a.href) } catch { return }
    const ade = a.closest<HTMLElement>('[data-sheet]')?.dataset.sheet
    if (url.origin !== location.origin) {
      if (url.hostname === 'github.com' && /\/issues\/new/.test(url.pathname)) {
        track(url.searchParams.get('template')?.startsWith('suggest') ? 'suggest_missing_click' : 'report_wrong_data_click', { location: where, ade_id: ade })
      } else track('outbound_click', { link_domain: url.hostname.replace(/^www\./, ''), ade_id: ade, location: where, link_type: a.closest('.sources, .receipt') ? 'source' : ade ? 'product_website' : 'other' })
    } else if (/^\/(products|data)\/|^\/llms\.txt$/.test(url.pathname)) {
      track('data_download', { file_path: url.pathname, location: where })
    }
  }, { capture: true })
}
