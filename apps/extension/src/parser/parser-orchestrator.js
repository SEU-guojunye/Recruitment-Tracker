import { FIELD_LIMITS, isHttpUrl } from '@recruitment-tracker/core'
import { collectSiteAdapterCandidates } from './site-adapters.js'

const GENERIC_SITE_NAMES = new Set([
  'boss直聘',
  'linkedin',
  'linkedin jobs',
  '猎聘',
  '拉勾',
  '智联招聘',
  '前程无忧',
  '51job',
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
          candidates.push({ name: hiringName, confidence: 0.98, source: 'jsonld:hiringOrganization' })
        }
        if (type.some((item) => ['Organization', 'Corporation'].includes(item))) {
          const name = cleanCompanyName(object.name)
          if (name) candidates.push({ name, confidence: 0.86, source: 'jsonld:organization' })
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

function titleCandidates(raw) {
  if (typeof raw.title !== 'string') return []
  return raw.title
    .normalize('NFKC')
    .split(/[|｜–—_-]/u)
    .map(cleanCompanyName)
    .filter(Boolean)
    .slice(0, 5)
    .map((name) => ({ name, confidence: 0.45, source: 'title' }))
}

export class ParserOrchestrator {
  constructor({ reliableThreshold = 0.75 } = {}) {
    this.reliableThreshold = reliableThreshold
  }

  parse(raw) {
    if (!raw || typeof raw !== 'object') {
      return {
        status: 'unavailable',
        company: { companyName: '', recruitmentLink: '' },
        alternatives: [],
      }
    }
    const recruitmentLink = cleanUrl(raw.url)
    const merged = [
      ...jsonLdCandidates(raw),
      ...metaCandidates(raw),
      ...collectSiteAdapterCandidates(raw.url).flatMap((candidate) => {
        const name = cleanCompanyName(candidate.name)
        return name ? [{ ...candidate, name }] : []
      }),
      ...titleCandidates(raw),
    ]
    const byName = new Map()
    for (const candidate of merged) {
      const key = candidate.name.toLowerCase()
      const existing = byName.get(key)
      if (!existing || candidate.confidence > existing.confidence) {
        byName.set(key, candidate)
      }
    }
    const alternatives = [...byName.values()]
      .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, 5)
    const best = alternatives[0]
    return {
      status: best?.confidence >= this.reliableThreshold
        ? 'matched'
        : best
          ? 'needsConfirmation'
          : 'unavailable',
      company: {
        companyName: best?.name || '',
        recruitmentLink,
      },
      alternatives,
    }
  }
}

export const parserOrchestrator = new ParserOrchestrator()
