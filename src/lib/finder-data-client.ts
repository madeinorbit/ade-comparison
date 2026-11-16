import type { FinderCard } from './finder-payload'
import type { FilterRequirement } from './filter'
import type { Index } from './types'
export interface FinderData {
  index: Index; requirements: FilterRequirement[]; sunsetIds: string[]; baseUrl: string; shortLabels: Record<string, string>
  shown: number; seed: string
  products: { id: string; name: string; former?: string[]; card?: FinderCard }[]
}
// The Finder's data is not in the page. It is fetched once, after load or on the first interaction, and cached.
let pending: Promise<FinderData> | undefined
export function loadFinderData(): Promise<FinderData> {
  const src = document.querySelector<HTMLElement>('[data-finder-src]')!.dataset.finderSrc!
  pending ||= fetch(src).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<FinderData> })
  pending.catch(() => { pending = undefined })
  return pending
}
