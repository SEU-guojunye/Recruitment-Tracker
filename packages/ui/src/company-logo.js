export function getCompanyIconUrl(recruitmentLink) {
  if (!recruitmentLink) return ''
  try {
    const url = new URL(recruitmentLink)
    const domain = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) return ''
    return `https://ico.faviconkit.net/favicon/${encodeURIComponent(domain)}?sz=64`
  } catch {
    return ''
  }
}
