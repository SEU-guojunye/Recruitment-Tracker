const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

export function toLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isLocalDate(value) {
  if (typeof value !== 'string') return false
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) return false

  const [, year, month, day] = match
  const candidate = new Date(Number(year), Number(month) - 1, Number(day))
  return (
    candidate.getFullYear() === Number(year) &&
    candidate.getMonth() === Number(month) - 1 &&
    candidate.getDate() === Number(day)
  )
}

export function isIsoUtcTimestamp(value) {
  return (
    typeof value === 'string' &&
    ISO_UTC_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

export function maxDateString(values) {
  return values.filter(isLocalDate).sort().at(-1) || null
}

export function maxIsoTimestamp(values) {
  return values.filter(isIsoUtcTimestamp).sort().at(-1) || null
}
