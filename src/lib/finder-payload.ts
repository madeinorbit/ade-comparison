// The Finder's data for the browser. It is built here but never inlined in the home HTML: the page ships only the
// first rows of each group, and the browser fetches this file once after load (src/lib/finder-data-client.ts).
// That keeps the home payload independent of how many ADEs the catalog covers.
// The file lives at /finder/<hash>.json. The hash changes with its content, so the host may cache it forever.
import { createHash } from 'node:crypto'
import { clientPayload, finderRequirements, index, productById, shortDate } from './data'
import { shuffleSeed } from './filter'
import { benchApp } from './benchmarks'
import { firstSentence, noticeFor, shortLabel, shotFor, shutdownLine, summary } from './sheet'
import { siteConfig } from '../../config.mjs'

export const finderSeed = shuffleSeed()
export const finderShown = 10
export interface FinderCard {
  sum: string
  shot?: [path: string, width: number, height: number]
  when?: string
  stars?: [value: number, observed: string]
  bench?: 1
}
const rows = index.products.map(identity => {
  const product = productById.get(identity.id)!
  const covered = identity.researchStatus === 'covered'
  const notice = covered ? noticeFor(identity.id) : undefined
  const shot = covered ? shotFor(identity.id) : undefined
  const stars = covered ? product.githubStars : undefined
  const card: FinderCard | undefined = covered ? {
    sum: notice ? firstSentence(notice.note) : summary(product),
    ...(shot ? { shot: [shot.path, shot.width, shot.height] as FinderCard['shot'] } : {}),
    ...(notice ? { when: shutdownLine(notice) } : {}),
    ...(stars ? { stars: [stars.value, shortDate(stars.observedAt)] as FinderCard['stars'] } : {}),
    ...(benchApp(identity.id) ? { bench: 1 as const } : {}),
  } : undefined
  return { id: identity.id, name: identity.name, ...(identity.formerNames ? { former: identity.formerNames } : {}), ...(card ? { card } : {}) }
})
export const finderPayload = {
  ...clientPayload,
  baseUrl: siteConfig.baseUrl,
  shortLabels: Object.fromEntries(finderRequirements.map(r => [r.key, shortLabel(r.key)])),
  shown: finderShown,
  seed: finderSeed,
  products: rows,
}
export const finderJson = JSON.stringify(finderPayload)
export const finderHash = createHash('sha256').update(finderJson).digest('hex').slice(0, 12)
export const finderPath = `/finder/${finderHash}.json`
