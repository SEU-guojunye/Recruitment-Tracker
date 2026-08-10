import { FIELD_LIMITS, isHttpUrl } from '@recruitment-tracker/core'
import {
  cleanBrandDomain,
  cleanLogoUrl,
  collectSiteAdapterCandidates,
  isRecruitmentPlatformHostname,
} from './site-adapters.js'

const GENERIC_SITE_NAMES = new Set([
  'boss直聘',
  'linkedin',
  'linkedin jobs',
  '猎聘',
  '拉勾',
  '智联招聘',
  '前程无忧',
  '51job',
  'moka',
  'moka hr',
  '飞书',
  '飞书招聘',
  '招聘',
  '职位',
  'jobs',
  'careers',
])

function cleanCompanyName(value) {
  if (typeof value !== 'string') return ''
  const plainText = [...value].map((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint <= 31 || codePoint === 127 ? ' ' : character
  }).join('')
  const cleaned = plainText
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
  if (!cleaned || cleaned.length > FIELD_LIMITS.companyName) return ''
  if (GENERIC_SITE_NAMES.has(cleaned.toLowerCase())) return ''
  return cleaned
}

function cleanUrl(value) {
  if (typeof value !== 'string') return ''
  const cleaned = value.trim().slice(0, FIELD_LIMITS.url + 1)
  return cleaned.length <= FIELD_LIMITS.url && isHttpUrl(cleaned) ? cleaned : ''
}

function logoValue(value) {
  if (Array.isArray(value)) return value.map(logoValue).find(Boolean) || ''
  if (typeof value === 'string') return cleanLogoUrl(value)
  if (value && typeof value === 'object') return cleanLogoUrl(value.url)
  return ''
}

function brandFields(object) {
  const sameAs = Array.isArray(object?.sameAs) ? object.sameAs : [object?.sameAs]
  const brandDomain = [
    object?.url,
    ...sameAs,
  ].map(cleanBrandDomain).find(Boolean) || ''
  const logoUrl = [
    logoValue(object?.logo),
    logoValue(object?.image),
  ].find(Boolean) || ''
  return {
    ...(brandDomain ? { brandDomain } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  }
}

function walkJson(value, visit, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.slice(0, 100).forEach((item) => walkJson(item, visit, depth + 1))
    return
  }
  if (typeof value !== 'object') return
  visit(value)
  Object.values(value).slice(0, 100).forEach((item) => walkJson(item, visit, depth + 1))
}

function jsonLdCandidates(raw) {
  const candidates = []
  for (const source of Array.isArray(raw.jsonLd) ? raw.jsonLd : []) {
    if (typeof source !== 'string' || source.length > 100_000) continue
    try {
      const parsed = JSON.parse(source)
      walkJson(parsed, (object) => {
        const type = Array.isArray(object['@type']) ? object['@type'] : [object['@type']]
        const hiringName = cleanCompanyName(object.hiringOrganization?.name)
        if (hiringName) {
          candidates.push({
            name: hiringName,
            confidence: 0.98,
            source: 'jsonld:hiringOrganization',
            ...brandFields(object.hiringOrganization),
          })
        }
        if (type.some((item) => ['Organization', 'Corporation'].includes(item))) {
          const name = cleanCompanyName(object.name)
          if (name) {
            candidates.push({
              name,
              confidence: 0.86,
              source: 'jsonld:organization',
              ...brandFields(object),
            })
          }
        }
      })
    } catch {
      // Invalid JSON-LD is untrusted page data; other adapters still get a chance.
    }
  }
  return candidates
}

function metaCandidates(raw) {
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {}
  return [
    ['og:site_name', 0.84],
    ['application-name', 0.78],
    ['twitter:site', 0.62],
  ].flatMap(([key, confidence]) => {
    const name = cleanCompanyName(meta[key])
    return name ? [{ name, confidence, source: `meta:${key}` }] : []
  })
}

const TITLE_DECORATION_PREFIX = /^(?:\u6b22\u8fce\s*)?(?:\u52a0\u5165\u6211\u4eec|\u6b22\u8fce\u52a0\u5165|welcome(?:\s+to)?|join\s+us(?:\s+at)?)\s*/iu
const TITLE_DECORATION_SUFFIX = /(?:\u6821\u56ed\u62db\u8058|\u6821\u62db|\u62db\u8058\u5b98\u65b9\u7f51\u7ad9|\u62db\u8058\u5b98\u7f51|\u62db\u8058|campus\s+recruitment|campus\s+careers?|campus|careers?|recruiting)\s*$/iu

function cleanTitleCandidate(value) {
  if (typeof value !== 'string') return ''
  return cleanCompanyName(value
    .replace(TITLE_DECORATION_PREFIX, '')
    .replace(TITLE_DECORATION_SUFFIX, ''))
}

function titleCandidates(raw) {
  if (typeof raw.title !== 'string') return []
  return raw.title
    .normalize('NFKC')
    .split(/[|｜–—_-]/u)
    .map(cleanTitleCandidate)
    .filter(Boolean)
    .slice(0, 5)
    .map((name) => ({ name, confidence: 0.45, source: 'title' }))
}

function pageBrandFields(raw) {
  let brandDomain = ''
  try {
    const url = new URL(raw.url)
    if (['http:', 'https:'].includes(url.protocol) && !isRecruitmentPlatformHostname(url.hostname)) {
      brandDomain = cleanBrandDomain(url.hostname)
    }
  } catch {
    // Invalid URLs are handled by cleanUrl; no generic brand fallback is produced.
  }

  const images = Array.isArray(raw?.brandSignals?.images) ? raw.brandSignals.images : []
  const logoUrl = images
    .filter((item) => /logo|brand|company/iu.test(`${item?.src || ''} ${item?.alt || ''} ${item?.className || ''}`))
    .map((item) => cleanLogoUrl(item?.src))
    .find(Boolean) || ''

  return { brandDomain, logoUrl }
}

export class ParserOrchestrator {
  constructor({ reliableThreshold = 0.75, now = () => new Date() } = {}) {
    this.reliableThreshold = reliableThreshold
    this.now = now
  }

  parse(raw) {
    const parsedAt = this.now().toISOString()
    if (!raw || typeof raw !== 'object') {
      return {
        status: 'unavailable',
        company: { companyName: '', recruitmentLink: '', brandDomain: '', logoUrl: '' },
        alternatives: [],
        parsedAt,
      }
    }
    const recruitmentLink = cleanUrl(raw.url)
    const merged = [
      ...jsonLdCandidates(raw),
      ...metaCandidates(raw),
      ...collectSiteAdapterCandidates(raw.url, raw).flatMap((candidate) => {
        const name = cleanCompanyName(candidate.name)
        return name ? [{ ...candidate, name }] : []
      }),
      ...titleCandidates(raw),
    ]
    const byName = new Map()
    for (const candidate of merged) {
      const key = candidate.name.toLowerCase()
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, candidate)
      } else if (candidate.confidence > existing.confidence) {
        byName.set(key, {
          ...candidate,
          brandDomain: candidate.brandDomain || existing.brandDomain,
          logoUrl: candidate.logoUrl || existing.logoUrl,
        })
      } else {
        byName.set(key, {
          ...existing,
          brandDomain: existing.brandDomain || candidate.brandDomain,
          logoUrl: existing.logoUrl || candidate.logoUrl,
        })
      }
    }
    const alternatives = [...byName.values()]
      .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, 5)
    const best = alternatives[0]
    const pageBrand = pageBrandFields(raw)
    const candidateBrand = alternatives.reduce((result, candidate) => ({
      brandDomain: result.brandDomain || candidate.brandDomain || '',
      logoUrl: result.logoUrl || candidate.logoUrl || '',
    }), { brandDomain: '', logoUrl: '' })
    const brand = best
      ? {
          brandDomain: candidateBrand.brandDomain || pageBrand.brandDomain,
          logoUrl: candidateBrand.logoUrl || pageBrand.logoUrl,
        }
      : { brandDomain: '', logoUrl: '' }
    return {
      status: best?.confidence >= this.reliableThreshold
        ? 'matched'
        : best
          ? 'needsConfirmation'
          : 'unavailable',
      company: {
        companyName: best?.name || '',
        recruitmentLink,
        ...brand,
      },
      alternatives,
      parsedAt,
    }
  }
}

export const parserOrchestrator = new ParserOrchestrator()
