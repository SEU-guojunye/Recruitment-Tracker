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
      brandDomain: 'example.com',
      logoUrl: '',
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

  it('resolves Moka tenant pages to the company identity and brand assets', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://app.mokahr.com/campus-recruitment/hypergryph/26326#/jobs?page=1',
      title: '鹰角网络校园招聘',
      meta: {},
      jsonLd: [],
      brandSignals: {
        scripts: [JSON.stringify({
          displayName: '鹰角网络',
          logoUrl: 'https://public-cdn.mokahr.com/hypergryph/logo.png',
          navbarLogoLink: 'http://www.hypergryph.com',
        })],
        links: [],
        images: [],
      },
    })
    expect(result.status).toBe('matched')
    expect(result.company).toMatchObject({
      companyName: '鹰角网络',
      brandDomain: 'hypergryph.com',
      logoUrl: 'https://public-cdn.mokahr.com/hypergryph/logo.png',
    })
    expect(result.company.recruitmentLink).toContain('app.mokahr.com/campus-recruitment/hypergryph/26326')
  })

  it('infers Moka tenant domains when the page has no explicit brand assets', () => {
    const parser = new ParserOrchestrator()
    const cases = [
      ['https://app.mokahr.com/campus-recruitment/hypergryph/26326#/jobs?project%5B0%5D=100124272&page=1&anchorName=jobsList', '鹰角网络', 'hypergryph.com'],
      ['https://app.mokahr.com/campus-recruitment/kpmg/76195#/jobs?page=1&anchorName=jobsList&keyword=', '毕马威', 'kpmg.com'],
    ]

    cases.forEach(([url, companyName, brandDomain]) => {
      const result = parser.parse({
        url,
        title: '招聘官网',
        meta: {},
        jsonLd: [],
        brandSignals: { scripts: [], links: [], images: [] },
      })
      expect(result.status).toBe('matched')
      expect(result.company).toMatchObject({ companyName, brandDomain, logoUrl: '' })
    })
  })

  it('uses the special Alibaba brand domain instead of the generic Moka tenant domain', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://app.mokahr.com/campus-recruitment/alibaba/12345#/jobs',
      title: '招聘官网',
      meta: {},
      jsonLd: [],
      brandSignals: { scripts: [], links: [], images: [] },
    })

    expect(result.status).toBe('matched')
    expect(result.company).toMatchObject({ companyName: '阿里巴巴', brandDomain: 'alibaba.cn', logoUrl: '' })
  })

  it('resolves Feishu tenant domains and aliases without using the platform hostname as a brand domain', () => {
    const parser = new ParserOrchestrator()
    const cases = [
      ['https://nio.jobs.feishu.cn/campus/?keywords=&category=&location=&project=&type=&job_hot_flag=&current=1&limit=10&functionCategory=&tag=&storefront_id_list=', 'NIO', 'nio.com'],
      ['https://bambulab.jobs.feishu.cn/campus/?keywords=&category=&location=&project=&type=&job_hot_flag=&current=1&limit=10&functionCategory=&tag=&sessionid=', 'Bambu Lab', 'bambulab.com'],
      ['https://momenta.jobs.feishu.cn/campus/?keywords=&category=&location=&project=7664524042879830335&type=&job_hot_flag=&current=1&limit=10&functionCategory=&tag=', 'Momenta', 'momenta.ai'],
    ]

    cases.forEach(([url, companyName, brandDomain]) => {
      const result = parser.parse({
        url,
        title: '飞书招聘',
        meta: {},
        jsonLd: [],
        brandSignals: { scripts: [], links: [], images: [] },
      })
      expect(result.status).toBe('matched')
      expect(result.company).toMatchObject({ companyName, brandDomain, logoUrl: '' })
      expect(result.company.recruitmentLink).toBe(url)
    })
  })

  it('uses the special Momenta brand domain instead of the generic tenant domain', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://momenta.jobs.feishu.cn/campus/?project=7664524042879830335',
      title: '飞书招聘',
      meta: {},
      jsonLd: [],
      brandSignals: { scripts: [], links: [], images: [] },
    })

    expect(result.status).toBe('matched')
    expect(result.company).toMatchObject({ companyName: 'Momenta', brandDomain: 'momenta.ai', logoUrl: '' })
  })

  it('extracts Feishu company names from decorated page titles', () => {
    const parser = new ParserOrchestrator()
    const cases = [
      ['https://nio.jobs.feishu.cn/campus/', '蔚来校招', '蔚来'],
      ['https://bambulab.jobs.feishu.cn/campus/', '欢迎加入拓竹科技', '拓竹科技'],
      ['https://momenta.jobs.feishu.cn/campus/', 'Momenta Campus', 'Momenta'],
    ]

    cases.forEach(([url, title, companyName]) => {
      const result = parser.parse({
        url,
        title,
        meta: {},
        jsonLd: [],
        brandSignals: { scripts: [], links: [], images: [] },
      })
      expect(result.status).toBe('matched')
      expect(result.company.companyName).toBe(companyName)
    })
  })

  it('cleans generic recruitment title decorations and infers first-party brand fields', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://www.cxmt.com/join.html',
      title: '\u52a0\u5165\u6211\u4eec-\u957f\u946b\u5b58\u50a8 - \u957f\u946b\u5b58\u50a8',
      meta: {},
      jsonLd: [],
      brandSignals: {
        images: [{ src: 'https://www.cxmt.com/statics/logo.svg', alt: '', className: '' }],
      },
    })

    expect(result.status).toBe('needsConfirmation')
    expect(result.company).toMatchObject({
      companyName: '\u957f\u946b\u5b58\u50a8',
      brandDomain: 'cxmt.com',
      logoUrl: 'https://www.cxmt.com/statics/logo.svg',
    })
    expect(result.alternatives).toHaveLength(1)
  })

  it('does not infer recruitment platform hostnames as first-party brand domains', () => {
    const parser = new ParserOrchestrator()
    const result = parser.parse({
      url: 'https://cxmt.zhiye.com/campus/jobs',
      title: '\u957f\u946b\u5b58\u50a8\u6821\u56ed\u62db\u8058',
      meta: {},
      jsonLd: [],
      brandSignals: { images: [] },
    })

    expect(result.company).toMatchObject({
      companyName: '\u957f\u946b\u5b58\u50a8',
      brandDomain: '',
    })
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
