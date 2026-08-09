import { ParserOrchestrator } from '../../apps/extension/src/parser/parser-orchestrator.js'
import { describe, expect, it } from 'vitest'

describe('ParserOrchestrator', () => {
  it('prefers JSON-LD hiring organization and returns company fields only', () => {
    const parser = new ParserOrchestrator({
      now: () => new Date('2026-08-09T09:30:00.000Z'),
    })
    const result = parser.parse({
      url: 'https://example.com/jobs/123',
      title: '高级工程师 | 招聘',
      meta: { 'og:site_name': '招聘' },
      jsonLd: [JSON.stringify({
        '@type': 'JobPosting',
        title: '高级工程师',
        hiringOrganization: { '@type': 'Organization', name: '示例科技' },
      })],
      visibleText: '投递地点 北京',
    })
    expect(result.status).toBe('matched')
    expect(result.company).toEqual({
      companyName: '示例科技',
      recruitmentLink: 'https://example.com/jobs/123',
    })
    expect(result.company).not.toHaveProperty('appliedDate')
    expect(result.company).not.toHaveProperty('applicationLink')
    expect(result.company).not.toHaveProperty('progressStatus')
    expect(result.company).not.toHaveProperty('companyNotes')
    expect(result.company).not.toHaveProperty('industryType')
    expect(result.company).not.toHaveProperty('recruitmentBatch')
    expect(result.company).not.toHaveProperty('priority')
    expect(result.parsedAt).toBe('2026-08-09T09:30:00.000Z')
  })

  it('marks a title-only guess as needing confirmation', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://example.com/careers',
      title: '平台工程师 - 星河网络',
      meta: {},
      jsonLd: [],
    })
    expect(result.status).toBe('needsConfirmation')
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('uses an ATS site adapter as a low-confidence company fallback', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://jobs.lever.co/example-labs/position-id',
      title: '',
      meta: {},
      jsonLd: [],
    })
    expect(result.status).toBe('needsConfirmation')
    expect(result.company.companyName).toBe('example labs')
    expect(result.alternatives[0].source).toBe('site:lever')
  })

  it('rejects dangerous links, generic site names and overlong candidates', () => {
    const parser = new ParserOrchestrator({
      now: () => new Date('2026-08-09T09:31:00.000Z'),
    })
    const result = parser.parse({
      url: 'javascript:alert(1)',
      title: 'x'.repeat(121),
      meta: { 'og:site_name': 'BOSS直聘' },
      jsonLd: ['not-json'],
    })
    expect(result).toMatchObject({
      status: 'unavailable',
      company: { companyName: '', recruitmentLink: '' },
      parsedAt: '2026-08-09T09:31:00.000Z',
    })
  })
})
