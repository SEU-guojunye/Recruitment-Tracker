function getCompanyDomain(recruitmentLink) {
  if (!recruitmentLink) return ''
  try {
    const url = new URL(recruitmentLink)
    const domain = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) return ''
    return domain
  } catch {
    return ''
  }
}

const configuredBrandfetchClientId = typeof import.meta.env?.VITE_BRANDFETCH_CLIENT_ID === 'string'
  ? import.meta.env.VITE_BRANDFETCH_CLIENT_ID.trim()
  : ''

export function getCompanyIconUrls(recruitmentLink, options = {}) {
  const domain = getCompanyDomain(recruitmentLink)
  if (!domain) return []
  const encodedDomain = encodeURIComponent(domain)
  const brandfetchClientId = typeof options.brandfetchClientId === 'string'
    ? options.brandfetchClientId.trim()
    : configuredBrandfetchClientId
  const urls = []
  if (brandfetchClientId) {
    urls.push(
      `https://cdn.brandfetch.io/${encodedDomain}/w/128/h/128/fallback/404/type/icon.png?c=${encodeURIComponent(brandfetchClientId)}`,
    )
  }
  urls.push(
    `https://logo.tomba.io/${encodedDomain}`,
    `https://ico.faviconkit.net/favicon/${encodedDomain}?sz=128`,
  )
  return urls
}

export function getCompanyIconUrl(recruitmentLink) {
  return getCompanyIconUrls(recruitmentLink).at(-1) || ''
}
