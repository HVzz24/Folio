const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function toMonthInputValue(value: string): string {
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

export function formatResumeDate(value: string): string {
  const monthValue = toMonthInputValue(value)
  if (!monthValue) return value
  const [year, month] = monthValue.split('-')
  return `${MONTHS[Number(month) - 1].slice(0, 3)} ${year}`
}
