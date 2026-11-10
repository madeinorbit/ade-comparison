import type { StatusEvent } from './types.ts'

export const statusPageSize = 20
export interface StatusDay {
  id: string
  date: string
  productId: string
  events: StatusEvent[]
  archivePath: string
}

// Use the published snapshot date so rebuilding the same data keeps the same pages.
export function planStatus(events: StatusEvent[], snapshot: string) {
  const cutoff = new Date(`${snapshot}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 29)
  const since = cutoff.toISOString().slice(0, 10)
  const days: StatusDay[] = [...Map.groupBy(events, event => `${event.date}-${event.productId}`).entries()]
    .map(([id, events]) => ({ id, date: events[0].date, productId: events[0].productId, events, archivePath: '' }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.productId.localeCompare(b.productId))
  const months = [...Map.groupBy(days, day => day.date.slice(0, 7))].map(([month, days]) => ({
    month,
    label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    days,
  }))
  const pages = months.flatMap(({ month, label, days }) =>
    Array.from({ length: Math.ceil(days.length / statusPageSize) }, (_, i) => {
      const archive = `${month}${i ? `/${i + 1}` : ''}`
      const path = `/status/${archive}/`
      const entries = days.slice(i * statusPageSize, (i + 1) * statusPageSize)
      for (const day of entries) day.archivePath = path
      return { archive, path, month, label, number: i + 1, total: Math.ceil(days.length / statusPageSize), days: entries }
    }))
  return { since, days, months, pages, recent: days.filter(day => day.date >= since && day.date <= snapshot).slice(0, statusPageSize) }
}
