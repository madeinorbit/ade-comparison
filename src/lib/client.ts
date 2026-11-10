import { checkedAge, mayBeOutdated } from './age'
// Browser helpers shared by every page and by the ADE sheet when it opens in a dialog.
export function refreshAges(root: ParentNode) {
  for (const time of root.querySelectorAll<HTMLElement>('[data-checked-at]')) {
    const date = time.dataset.checkedAt!
    time.textContent = checkedAge(date)
    let note = time.parentElement!.querySelector('[data-outdated]')
    if (mayBeOutdated(date) && !note) {
      note = document.createElement('span'); note.setAttribute('data-outdated', '')
      note.textContent = ' · may be outdated'; time.after(note)
    } else if (!mayBeOutdated(date)) note?.remove()
  }
}
export function openTargetDetails() {
  let target: HTMLElement | null = null
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))) } catch { return }
  let parent: HTMLElement | null = target
  while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
}
// The selection a visitor made on the Finder, carried in the URL to the ADE sheet and Compare.
export function wantedKeys(search: string) {
  const p = new URLSearchParams(search)
  const list = (key: string) => (p.get(key) || '').split(',').filter(Boolean)
  return { must: list('must'), nice: list('nice') }
}
// Marks every element whose data-keys name a requirement the visitor asked for.
export function markWanted(root: ParentNode, search: string) {
  const { must, nice } = wantedKeys(search)
  const wanted = new Set([...must, ...nice])
  let count = 0
  for (const el of root.querySelectorAll<HTMLElement>('[data-keys]')) {
    const hit = el.dataset.keys!.split(' ').some(k => wanted.has(k))
    el.classList.toggle('is-wanted', hit)
    if (hit) count++
  }
  return { must, nice, count }
}
