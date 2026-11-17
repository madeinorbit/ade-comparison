// Static pair pages go to the pairs with the most typed answers on both sides, up to a fixed cap.
// The rule is the same for every product and never reads a name:
//   1. Rank pairs by shared typed answers (answered on both sides), most first, and drop any below the minimum.
//   2. Keep whole groups of pairs with the same shared count while the whole group still fits under the cap.
//   3. Fill the slots left over from the next group only, ranked by combined typed answers of both products
//      (most first), then by pair slug (the two product ids, sorted and joined) as the final tie-break.
// So a cap boundary inside a group never leaves the cap mostly empty, and the same data always gives the same pages.
export type PairCandidate = { slug: string, shared: number, total: number }

// Returns the lowest shared count whose whole group still fits, or Infinity when none fit.
export function pairCutoff(shared: number[], maximum: number, minimum: number): number {
  let kept = 0, cutoff = Infinity
  for (const value of [...new Set(shared)].sort((a, b) => b - a)) {
    const count = shared.filter(s => s === value).length
    if (value < minimum || kept + count > maximum) break
    kept += count; cutoff = value
  }
  return cutoff
}

// Returns the pairs that get a static page, ordered by shared count, combined total, then slug.
export function selectPairs<T extends PairCandidate>(candidates: T[], maximum: number, minimum: number): T[] {
  const order = (a: T, b: T) => b.shared - a.shared || b.total - a.total || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  const eligible = candidates.filter(c => c.shared >= minimum).sort(order)
  const cutoff = pairCutoff(eligible.map(c => c.shared), maximum, minimum)
  const whole = eligible.filter(c => c.shared >= cutoff)
  const rest = eligible.slice(whole.length)
  // The next group is already in total-then-slug order, so the first slots left are the ones it keeps.
  const next = rest.filter(c => c.shared === rest[0]?.shared)
  return [...whole, ...next.slice(0, Math.max(0, maximum - whole.length))]
}
