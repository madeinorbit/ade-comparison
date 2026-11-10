const day = 86_400_000
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

// Use calendar months, clamping month ends, so exactly six months is still current.
export function mayBeOutdated(checkedAt: string, asOf = new Date().toISOString().slice(0, 10)): boolean {
  if (!validDate(checkedAt) || !validDate(asOf)) return false
  const checked = new Date(`${checkedAt}T00:00:00Z`)
  const lastDay = new Date(Date.UTC(checked.getUTCFullYear(), checked.getUTCMonth() + 7, 0)).getUTCDate()
  const sixMonths = new Date(Date.UTC(checked.getUTCFullYear(), checked.getUTCMonth() + 6, Math.min(checked.getUTCDate(), lastDay)))
  return Date.parse(asOf) > sixMonths.getTime()
}

export function checkedAge(checkedAt: string, asOf = new Date().toISOString().slice(0, 10)): string {
  if (!validDate(checkedAt) || !validDate(asOf)) return ''
  const days = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(checkedAt)) / day))
  if (days === 0) return 'checked today'
  if (days === 1) return 'checked yesterday'
  const [amount, unit] = days < 7 ? [days, 'day'] : days < 30 ? [Math.floor(days / 7), 'week']
    : days < 365 ? [Math.floor(days / 30), 'month'] : [Math.floor(days / 365), 'year']
  return `checked ${amount} ${unit}${amount === 1 ? '' : 's'} ago`
}
