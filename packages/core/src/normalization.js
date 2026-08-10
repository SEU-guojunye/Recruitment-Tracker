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

const RECRUITMENT_PLATFORM_HOSTS = new Set([
  'app.mokahr.com',
  'jobs.lever.co',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.feishu.cn',
])

export function isRecruitmentPlatformHostname(value) {
  const hostname = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/^www\./u, '')
    : ''
  return RECRUITMENT_PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.jobs.feishu.cn')
}

export function isCompanyBrandDomain(value) {
  if (typeof value !== 'string' || value.trim() === '') return true
  const domain = value.trim().toLowerCase().replace(/^www\./u, '')
  if (domain.length > 253 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu.test(domain)) {
    return false
  }
  return !isRecruitmentPlatformHostname(domain)
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
