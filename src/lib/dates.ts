const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseIsoDate(value: string): Date | undefined {
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) return undefined

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const date = new Date(year, month - 1, day)
  return month >= 1 && month <= 12
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : undefined
}

export function toMonthInputValue(value: string): string {
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    return parseIsoDate(value) ? `${dateMatch[1]}-${dateMatch[2]}` : ''
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})$/)
  if (isoMatch && Number(isoMatch[2]) >= 1 && Number(isoMatch[2]) <= 12) return value

  const monthMatch = value.trim().match(/^([a-z]+)\s+(\d{4})$/i)
  if (!monthMatch) return ''

  const monthIndex = MONTHS.findIndex((month) => (
    month.toLowerCase() === monthMatch[1].toLowerCase()
    || month.slice(0, 3).toLowerCase() === monthMatch[1].slice(0, 3).toLowerCase()
  ))
  return monthIndex < 0 ? '' : `${monthMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function toDateFromResumeValue(value: string): Date | undefined {
  const exactDate = parseIsoDate(value)
  if (exactDate) return exactDate

  const monthValue = toMonthInputValue(value)
  if (!monthValue) return undefined

  const [year, month] = monthValue.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

export function formatResumeDate(value: string): string {
  const monthValue = toMonthInputValue(value)
  if (!monthValue) return value
  const [year, month] = monthValue.split('-')
  return `${MONTHS[Number(month) - 1].slice(0, 3)} ${year}`
}
