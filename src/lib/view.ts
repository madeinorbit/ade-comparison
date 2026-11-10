import type { FinderState, Result } from './filter.ts'
export const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const groupLabels = { fits: 'Fits', 'kind-of': 'Fits kind of', 'shutting-down': 'Fits but shutting down' }
export const groupLabel = (group: keyof typeof groupLabels) => groupLabels[group]
// Unknown is not a difference and not a match: a row differs only on conflicting recorded answers.
export const answersDiffer = (answers: string[]) => new Set(answers.filter(a => a !== 'unknown')).size > 1
export function resultMessage(result: Result, state: FinderState): string {
  if (!state.must.length && !state.nice.length) return 'Choose must-haves to check fit.'
  const parts = [state.must.length ? `${result.mustMet} of ${state.must.length} must-haves confirmed.` : '', state.nice.length ? `${result.met - result.mustMet} of ${state.nice.length} preferences confirmed.` : ''].filter(Boolean)
  return parts.join(' ')
}
