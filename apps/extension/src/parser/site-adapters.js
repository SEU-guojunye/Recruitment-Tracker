function firstPathSegment(url) {
  const segment = url.pathname.split('/').filter(Boolean)[0] || ''
  try {
    return decodeURIComponent(segment).replace(/[-_]+/gu, ' ').trim()
  } catch {
    return ''
  }
}

export const SITE_ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'lever',
    matches: (url) => url.hostname === 'jobs.lever.co',
    companyName: firstPathSegment,
    confidence: 0.58,
  }),
  Object.freeze({
    id: 'greenhouse',
    matches: (url) => ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname),
    companyName: firstPathSegment,
    confidence: 0.58,
  }),
])

export function collectSiteAdapterCandidates(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return []
  }
  return SITE_ADAPTERS.flatMap((adapter) => {
    if (!adapter.matches(url)) return []
    const name = adapter.companyName(url)
    return name
      ? [{ name, confidence: adapter.confidence, source: `site:${adapter.id}` }]
      : []
  })
}
