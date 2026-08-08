export function normalizeCompanyName(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

export function normalizeSearchText(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

export function normalizeOptionalUrl(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isHttpUrl(value) {
  if (typeof value !== 'string' || value === '') return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
