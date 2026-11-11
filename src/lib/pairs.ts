// Static pair pages go to the pairs with the most typed answers on both sides. Pairs with the same count
// are kept or dropped together, so the cut never depends on names. The rule is the same for every product.
// Returns the lowest shared count that still gets a static page, or Infinity when none fit.
export function pairCutoff(shared: number[], maximum: number, minimum: number): number {
  let kept = 0, cutoff = Infinity
  for (const value of [...new Set(shared)].sort((a, b) => b - a)) {
    const count = shared.filter(s => s === value).length
    if (value < minimum || kept + count > maximum) break
    kept += count; cutoff = value
  }
  return cutoff
}
