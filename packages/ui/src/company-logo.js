import {
  getBrandDomainCandidates,
  isCompanyBrandDomain,
  isRecruitmentPlatformHostname,
} from '@recruitment-tracker/core'

function getCompanyDomain(recruitmentLink) {
  if (!recruitmentLink) return ''
  try {
    const url = new URL(recruitmentLink)
    const domain = url.hostname.toLowerCase().replace(/^www\./u, '')
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) return ''
    return isRecruitmentPlatformHostname(domain) ? '' : domain
  } catch {
    return ''
  }
}

function getBrandDomain(company) {
  if (typeof company?.brandDomain !== 'string') return ''
  const domain = company.brandDomain.trim().toLowerCase().replace(/^www\./u, '')
  return isCompanyBrandDomain(domain) ? domain : ''
}

function getRecruitmentPlatformTenant(recruitmentLink) {
  if (typeof recruitmentLink !== 'string' || recruitmentLink.trim() === '') return null
  try {
    const url = new URL(recruitmentLink)
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'app.mokahr.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      return parts[0] === 'campus-recruitment' && parts[1]
        ? { platform: 'moka', tenant: parts[1] }
        : null
    }
    if (hostname.endsWith('.jobs.feishu.cn') && url.pathname.startsWith('/campus')) {
      return { platform: 'feishu', tenant: hostname.slice(0, -'.jobs.feishu.cn'.length) }
    }
    return null
  } catch {
    return null
  }
}

function getBrandDomains(company) {
  const storedDomain = getBrandDomain(company)
  const platformTenant = getRecruitmentPlatformTenant(company.recruitmentLink)
  const inferredDomains = platformTenant
    ? getBrandDomainCandidates(platformTenant.platform, platformTenant.tenant)
    : []
  return [...new Set([storedDomain, ...inferredDomains].filter(Boolean))]
}

function getLogoUrl(company) {
  if (typeof company?.logoUrl !== 'string' || company.logoUrl.trim() === '') return ''
  const value = company.logoUrl.trim()
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

const configuredBrandfetchClientId = typeof import.meta.env?.VITE_BRANDFETCH_CLIENT_ID === 'string'
  ? import.meta.env.VITE_BRANDFETCH_CLIENT_ID.trim()
  : ''

export function getCompanyIconUrls(companyOrRecruitmentLink, options = {}) {
  const company = typeof companyOrRecruitmentLink === 'string'
    ? { recruitmentLink: companyOrRecruitmentLink }
    : companyOrRecruitmentLink || {}
  const directLogoUrl = getLogoUrl(company)
  const urls = directLogoUrl ? [directLogoUrl] : []
  const brandfetchClientId = typeof options.brandfetchClientId === 'string'
    ? options.brandfetchClientId.trim()
    : configuredBrandfetchClientId
  const domains = getBrandDomains(company)
  if (domains.length === 0) {
    const fallbackDomain = getCompanyDomain(company.recruitmentLink)
    if (fallbackDomain) domains.push(fallbackDomain)
  }
  return domains.reduce((result, domain) => {
    const encodedDomain = encodeURIComponent(domain)
    result.push(
      `https://ico.faviconkit.net/favicon/${encodedDomain}?sz=128`,
      `https://logo.tomba.io/${encodedDomain}`,
    )
    if (brandfetchClientId) {
      result.push(`https://cdn.brandfetch.io/${encodedDomain}/w/128/h/128/fallback/404/type/icon.png?c=${encodeURIComponent(brandfetchClientId)}`)
    }
    return result
  }, urls)
}

export function getCompanyIconUrl(companyOrRecruitmentLink) {
  return getCompanyIconUrls(companyOrRecruitmentLink)[0] || ''
}
