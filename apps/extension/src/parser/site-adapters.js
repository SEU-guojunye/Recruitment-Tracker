import { getSpecialBrandRule } from '@recruitment-tracker/core'

const RECRUITMENT_PLATFORM_HOSTS = new Set([
  'app.mokahr.com',
  'jobs.lever.co',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
])

const RECRUITMENT_PLATFORM_SUFFIXES = new Set([
  '51job.com',
  'lagou.com',
  'linkedin.com',
  'liepin.com',
  'zhiye.com',
  'zhipin.com',
])

const MOKA_TENANT_ALIASES = Object.freeze({
  hypergryph: '鹰角网络',
  kpmg: '毕马威',
})

const FEISHU_TENANT_ALIASES = Object.freeze({
  nio: 'NIO',
  bambulab: 'Bambu Lab',
  momenta: 'Momenta',
})

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/^www\./u, '') : ''
}

export function isRecruitmentPlatformHostname(value) {
  const hostname = normalizeHostname(value)
  return RECRUITMENT_PLATFORM_HOSTS.has(hostname)
    || hostname === 'jobs.feishu.cn'
    || hostname.endsWith('.jobs.feishu.cn')
    || [...RECRUITMENT_PLATFORM_SUFFIXES].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
}

export function cleanBrandDomain(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const input = value.trim()
  let parsed
  try {
    const hasProtocol = /^https?:\/\//iu.test(input)
    if (!hasProtocol && /[/?#]/u.test(input)) return ''
    parsed = hasProtocol ? new URL(input) : new URL(`https://${input}`)
    if (parsed.username || parsed.password || parsed.port) {
      return ''
    }
  } catch {
    return ''
  }
  const hostname = normalizeHostname(parsed.hostname)
  if (!hostname || hostname.length > 253 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu.test(hostname)) {
    return ''
  }
  return isRecruitmentPlatformHostname(hostname) ? '' : hostname
}

export function cleanLogoUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const input = value.trim().slice(0, 2049)
  if (input.length > 2048) return ''
  try {
    const url = new URL(input)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function firstPathSegment(url) {
  const segment = url.pathname.split('/').filter(Boolean)[0] || ''
  try {
    return decodeURIComponent(segment).replace(/[-_]+/gu, ' ').trim()
  } catch {
    return ''
  }
}

function decodeEmbeddedText(value) {
  return String(value || '')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x2F;', '/')
    .replaceAll('&#47;', '/')
    .replaceAll('&amp;', '&')
    .replaceAll('\\/', '/')
}

function embeddedValues(raw, key) {
  const scripts = Array.isArray(raw?.brandSignals?.scripts) ? raw.brandSignals.scripts : []
  const pattern = new RegExp(`(?:["']|&quot;)?${key}(?:["']|&quot;)?\\s*:\\s*(?:["']|&quot;)(.*?)(?:["']|&quot;)(?=\\s*[,}])`, 'iu')
  return scripts.flatMap((script) => {
    const match = decodeEmbeddedText(script).match(pattern)
    return match?.[1] ? [decodeEmbeddedText(match[1])] : []
  })
}

function titleCompanyName(title) {
  if (typeof title !== 'string') return ''
  return title
    .normalize('NFKC')
    .split(/[|｜–—_-]/u)
    .map((part) => part
      .replace(/^(?:欢迎加入|加入我们|welcome(?:\s+to)?|join\s+us(?:\s+at)?)\s*/iu, '')
      .replace(/(?:校园招聘|校招|招聘官网|招聘官方网站|招聘网|campus\s+recruitment|campus\s+careers?|campus|careers?|recruiting)\s*$/iu, '')
      .trim())
    .find(Boolean) || ''
}

function tenantFromMoka(url) {
  const parts = url.pathname.split('/').filter(Boolean)
  return parts[0] === 'campus-recruitment' ? parts[1] || '' : ''
}

function tenantFromFeishu(url) {
  const suffix = '.jobs.feishu.cn'
  return url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : ''
}

function inferredTenantBrandDomain(tenant) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(tenant)) return ''
  return cleanBrandDomain(`${tenant}.com`)
}

function pageBrandAssets(raw, url) {
  const assets = {
    brandDomain: '',
    logoUrl: '',
  }
  const embeddedWebsite = embeddedValues(raw, 'navbarLogoLink')
    .map(cleanBrandDomain)
    .find(Boolean)
  const embeddedLogo = [
    ...embeddedValues(raw, 'logoUrl'),
    ...embeddedValues(raw, 'applyShareLogo'),
  ].map(cleanLogoUrl).find(Boolean)
  assets.brandDomain = embeddedWebsite || ''
  assets.logoUrl = embeddedLogo || ''

  const images = Array.isArray(raw?.brandSignals?.images) ? raw.brandSignals.images : []
  if (!assets.logoUrl) {
    assets.logoUrl = images
      .filter((item) => /logo|brand|company/iu.test(`${item?.alt || ''} ${item?.className || ''}`))
      .map((item) => cleanLogoUrl(item?.src))
      .find(Boolean) || ''
  }

  if (!assets.brandDomain) {
    const links = Array.isArray(raw?.brandSignals?.links) ? raw.brandSignals.links : []
    assets.brandDomain = links
      .filter((item) => /官网|official|website|corporate/iu.test(`${item?.text || ''} ${item?.rel || ''}`))
      .map((item) => cleanBrandDomain(item?.href))
      .find((domain) => domain && domain !== normalizeHostname(url.hostname)) || ''
  }
  return assets
}

function candidatesForAdapter({ id, names, assets }) {
  return names
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      confidence: item.confidence,
      source: `site:${id}:${item.source}`,
      ...(assets.brandDomain ? { brandDomain: assets.brandDomain } : {}),
      ...(assets.logoUrl ? { logoUrl: assets.logoUrl } : {}),
    }))
}

function mokaCandidates(url, raw) {
  const tenant = tenantFromMoka(url).toLowerCase()
  if (!tenant) return []
  const pageAssets = pageBrandAssets(raw, url)
  const specialRule = getSpecialBrandRule('moka', tenant)
  const assets = {
    ...pageAssets,
    brandDomain: specialRule?.brandDomain || pageAssets.brandDomain || inferredTenantBrandDomain(tenant),
  }
  const names = []
  const titleName = titleCompanyName(raw.title)
  if (titleName) names.push({ name: titleName, confidence: 0.9, source: 'title' })
  if (specialRule?.companyName) {
    names.push({ name: specialRule.companyName, confidence: 0.9, source: 'special-rule' })
  }
  if (MOKA_TENANT_ALIASES[tenant]) {
    names.push({ name: MOKA_TENANT_ALIASES[tenant], confidence: 0.88, source: 'tenant-alias' })
  }
  names.push({ name: tenant.replace(/[-_]+/gu, ' '), confidence: 0.4, source: 'tenant' })
  return candidatesForAdapter({ id: 'moka', names, assets })
}

function feishuCandidates(url, raw) {
  const tenant = tenantFromFeishu(url).toLowerCase()
  if (!tenant) return []
  const pageAssets = pageBrandAssets(raw, url)
  const specialRule = getSpecialBrandRule('feishu', tenant)
  const assets = {
    ...pageAssets,
    brandDomain: specialRule?.brandDomain || pageAssets.brandDomain || inferredTenantBrandDomain(tenant),
  }
  const names = []
  const titleName = titleCompanyName(raw.title)
  if (titleName && titleName.toLowerCase() !== '飞书招聘') {
    names.push({ name: titleName, confidence: 0.88, source: 'title' })
  }
  if (specialRule?.companyName) {
    names.push({ name: specialRule.companyName, confidence: 0.9, source: 'special-rule' })
  }
  if (FEISHU_TENANT_ALIASES[tenant]) {
    names.push({ name: FEISHU_TENANT_ALIASES[tenant], confidence: 0.86, source: 'tenant-alias' })
  }
  names.push({ name: tenant.replace(/[-_]+/gu, ' '), confidence: 0.4, source: 'tenant' })
  return candidatesForAdapter({ id: 'feishu', names, assets })
}

export const SITE_ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'moka',
    matches: (url) => url.hostname === 'app.mokahr.com' && url.pathname.startsWith('/campus-recruitment/'),
    collect: mokaCandidates,
  }),
  Object.freeze({
    id: 'feishu',
    matches: (url) => url.hostname.endsWith('.jobs.feishu.cn') && url.pathname.startsWith('/campus'),
    collect: feishuCandidates,
  }),
  Object.freeze({
    id: 'lever',
    matches: (url) => url.hostname === 'jobs.lever.co',
    collect: (url) => {
      const name = firstPathSegment(url)
      return name ? [{ name, confidence: 0.58, source: 'site:lever' }] : []
    },
  }),
  Object.freeze({
    id: 'greenhouse',
    matches: (url) => ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname),
    collect: (url) => {
      const name = firstPathSegment(url)
      return name ? [{ name, confidence: 0.58, source: 'site:greenhouse' }] : []
    },
  }),
])

export function collectSiteAdapterCandidates(rawUrl, raw = {}) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return []
  }
  const adapter = SITE_ADAPTERS.find((item) => item.matches(url))
  return adapter ? adapter.collect(url, raw) : []
}
