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

export function getCompanyIconUrls(recruitmentLink) {
  const domain = getCompanyDomain(recruitmentLink)
  if (!domain) return []
  const encodedDomain = encodeURIComponent(domain)
  return [
    `https://a.favicon.im/${encodedDomain}?larger=true&throw-error-on-404=true`,
    `https://ico.faviconkit.net/favicon/${encodedDomain}?sz=128`,
  ]
}

export function getCompanyIconUrl(recruitmentLink) {
  return getCompanyIconUrls(recruitmentLink).at(-1) || ''
}
