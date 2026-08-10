import {
  DomainValidationError,
  aggregateCompanies,
  createApplication,
  createCompanyRecord,
  createDefaultProgressStages,
  filterApplicationCompanies,
  filterRecruitmentCompanies,
  findCompanyNameCandidates,
  getTimelineStates,
  normalizeCompanyName,
  replaceProgressWorkflow,
  selectApplicationStats,
  selectCompanyStats,
  switchProgressStage,
  validateApplication,
  validateDataset,
  validateProgressStages,
  validateVersionedData,
} from '@recruitment-tracker/core'
import { describe, expect, it } from 'vitest'

const NOW = new Date('2026-08-08T10:00:00.000Z')
const TODAY = '2026-08-08'

function idFactory(prefix = 'id') {
  let next = 0
  return () => `${prefix}-${++next}`
}

function makeCompany(overrides = {}) {
  return createCompanyRecord(
    { companyName: '示例公司', ...overrides },
    { idFactory: idFactory('company'), now: NOW },
  )
}

function makeApplication(company, overrides = {}) {
  return createApplication(
    { companyId: company.id, ...overrides },
    {
      idFactory: idFactory('item'),
      now: NOW,
      today: TODAY,
      companyIds: new Set([company.id]),
    },
  )
}

describe('core model normalization and creation', () => {
  it('normalizes Unicode width, whitespace and letter case without deleting suffixes', () => {
    expect(normalizeCompanyName('  ＡＣＭＥ   科技 有限公司  ')).toBe(
      'acme 科技 有限公司',
    )
  })

  it('creates a valid company with stable derived fields', () => {
    const company = makeCompany({
      companyName: '  Acme  集团 ',
      recruitmentLink: ' https://example.com/jobs ',
    })
    expect(company).toMatchObject({
      companyName: 'Acme  集团',
      normalizedCompanyName: 'acme 集团',
      recruitmentLink: 'https://example.com/jobs',
      industryType: '',
      recruitmentBatch: '秋招正式批',
      priority: 'P1',
      createdAt: '2026-08-08T10:00:00.000Z',
    })
  })

  it('keeps optional brand fields while rejecting recruitment platform domains', () => {
    const company = makeCompany({
      brandDomain: 'www.example.com',
      logoUrl: 'https://cdn.example.com/logo.png',
    })
    expect(company).toMatchObject({
      brandDomain: 'www.example.com',
      logoUrl: 'https://cdn.example.com/logo.png',
    })
    expect(() => makeCompany({ brandDomain: 'app.mokahr.com' }))
      .toThrow(DomainValidationError)
    expect(() => makeCompany({ brandDomain: 'momenta.jobs.feishu.cn' }))
      .toThrow(DomainValidationError)
  })

  it('validates closed company classifications and accepts custom industries', () => {
    expect(makeCompany({ industryType: '新能源', priority: 'P0' })).toMatchObject({
      industryType: '新能源',
      priority: 'P0',
    })
    expect(() => makeCompany({ recruitmentBatch: '暑期实习' }))
      .toThrow(DomainValidationError)
    expect(() => makeCompany({ priority: 'P3' })).toThrow(DomainValidationError)
  })

  it('returns normalized-name matches as candidates without silently merging', () => {
    const first = makeCompany({ id: 'company-b', companyName: 'ＡＣＭＥ 科技' })
    const second = makeCompany({ id: 'company-a', companyName: 'acme   科技' })
    expect(findCompanyNameCandidates([first, second], ' Acme 科技 '))
      .toEqual([second, first])
    expect(findCompanyNameCandidates([first, second], 'Acme 科技', second.id))
      .toEqual([first])
  })

  it('creates the PRD six-stage workflow and copies current-stage summary fields', () => {
    const company = makeCompany()
    const application = makeApplication(company)
    expect(application.progressStages.map((stage) => stage.name)).toEqual([
      '已投递',
      '筛选',
      '笔试',
      '技术一面',
      'HR 面',
      '结果',
    ])
    expect(application.progressStages[0].date).toBe(TODAY)
    expect(application.progressStages.every((stage) => stage.note === '')).toBe(true)
    expect(application).toMatchObject({
      appliedDate: TODAY,
      progressStatus: '已投递',
      progressPhase: 'submitted',
      progressIsTerminal: false,
      progressUpdatedDate: TODAY,
    })
  })

  it('clears referral code when the record is not a referral', () => {
    const company = makeCompany()
    expect(makeApplication(company, { referralCode: 'SECRET' }).referralCode).toBe('')
  })

  it('rejects dangerous links and future application dates', () => {
    const company = makeCompany()
    expect(() => makeApplication(company, { applicationLink: 'javascript:alert(1)' }))
      .toThrow(DomainValidationError)
    expect(() => makeApplication(company, { appliedDate: '2026-08-09' }))
      .toThrow('投递日期不能晚于今天')
  })
})

describe('progress workflow rules', () => {
  it('requires unique stage ids, a valid current stage and a terminal closed phase', () => {
    const result = validateProgressStages([
      { id: 'same', name: 'A', phase: 'submitted', isTerminal: false, date: '', note: '' },
      { id: 'same', name: 'B', phase: 'closed', isTerminal: false, date: '', note: '' },
    ], 'missing')
    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['duplicate_id', 'closed_must_be_terminal', 'stage_not_found']),
    )
  })

  it('quick switching fills only a missing target date and refreshes all summary fields', () => {
    const company = makeCompany()
    const application = makeApplication(company)
    const target = application.progressStages[3]
    const switched = switchProgressStage(application, target.id, '2026-08-09')
    expect(switched.progressStages[3].date).toBe('2026-08-09')
    expect(switched).toMatchObject({
      progressStatus: '技术一面',
      progressPhase: 'interview',
      progressIsTerminal: false,
      progressUpdatedDate: '2026-08-09',
    })

    const switchedAgain = switchProgressStage(switched, application.currentStageId, '2026-08-10')
    expect(switchedAgain.progressStages[0].date).toBe(TODAY)
  })

  it('workflow replacement keeps custom names while deriving the stable phase', () => {
    const company = makeCompany()
    const application = makeApplication(company)
    const stages = application.progressStages.map((stage) => ({ ...stage }))
    stages[3].name = '业务终面'
    const changed = replaceProgressWorkflow(application, {
      progressStages: stages,
      currentStageId: stages[3].id,
      localDate: TODAY,
    })
    expect(changed.progressStatus).toBe('业务终面')
    expect(changed.progressPhase).toBe('interview')
  })

  it('validates stage note type and length while preserving notes through workflow changes', () => {
    const company = makeCompany()
    const application = makeApplication(company)
    const stages = application.progressStages.map((stage, index) => ({
      ...stage,
      note: index === 3 ? '会议：https://meeting.example.com/round-1' : '',
    }))
    const changed = replaceProgressWorkflow(application, {
      progressStages: stages,
      currentStageId: stages[3].id,
      localDate: TODAY,
    })
    expect(changed.progressStages[3].note).toBe('会议：https://meeting.example.com/round-1')

    const invalidType = validateProgressStages([
      { ...stages[0], note: null },
    ], stages[0].id)
    expect(invalidType.errors).toContainEqual(expect.objectContaining({
      path: 'progressStages.0.note',
      code: 'invalid_type',
    }))

    const tooLong = validateProgressStages([
      { ...stages[0], note: '备'.repeat(5001) },
    ], stages[0].id)
    expect(tooLong.errors).toContainEqual(expect.objectContaining({
      path: 'progressStages.0.note',
      code: 'too_long',
    }))
  })

  it('derives timeline display state from order, never from dates', () => {
    const stages = createDefaultProgressStages({
      appliedDate: TODAY,
      idFactory: idFactory('stage'),
    }).map((stage) => ({ ...stage, date: '' }))
    const states = getTimelineStates({ progressStages: stages, currentStageId: stages[2].id })
    expect(states.map((stage) => stage.state)).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
  })

  it('rejects summary fields that drift from the current stage', () => {
    const company = makeCompany()
    const application = { ...makeApplication(company), progressPhase: 'interview' }
    expect(validateApplication(application, { today: TODAY }).errors)
      .toContainEqual(expect.objectContaining({
        path: 'progressPhase',
        code: 'inconsistent_derived_field',
      }))
  })
})

describe('dataset integrity, statistics and deterministic filtering', () => {
  it('rejects duplicate business ids and orphan applications', () => {
    const company = makeCompany()
    const application = makeApplication(company)
    const result = validateDataset({
      companies: [company, { ...company }],
      applications: [application, { ...application, companyId: 'missing' }],
    }, { today: TODAY })
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['duplicate_id', 'company_not_found']),
    )
  })

  it('rejects unsupported versioned data', () => {
    expect(validateVersionedData({ schemaVersion: 2, data: {} }).errors[0].code)
      .toBe('unsupported_schema_version')
  })

  it('calculates the two PRD statistic card sets', () => {
    const companyA = makeCompany({ id: 'company-a', companyName: 'A', priority: 'P0' })
    const companyB = makeCompany({ id: 'company-b', companyName: 'B' })
    const submitted = makeApplication(companyA, {
      id: 'application-a',
      progressUpdatedDate: '2026-08-06',
    })
    const interviewStages = makeApplication(companyA).progressStages
    const interview = replaceProgressWorkflow(makeApplication(companyA, {
      id: 'application-b',
    }), {
      progressStages: interviewStages,
      currentStageId: interviewStages[3].id,
      localDate: '2026-08-08',
    })
    const closedStage = [{
      id: 'closed', name: '已拒绝', phase: 'result', isTerminal: true, date: TODAY,
    }]
    const closed = makeApplication(companyB, {
      id: 'application-c',
      progressStages: closedStage,
      currentStageId: 'closed',
    })
    const applications = [submitted, interview, closed]

    expect(selectApplicationStats([companyA, companyB], applications)).toEqual({
      activeCompanyCount: 1,
      applicationCount: 3,
      interviewApplicationCount: 1,
      latestProgressUpdatedDate: TODAY,
    })
    expect(selectCompanyStats([companyA, companyB], applications)).toMatchObject({
      companyCount: 2,
      applicationCount: 3,
      p0CompanyCount: 1,
      latestUpdatedAt: '2026-08-08T10:00:00.000Z',
    })
  })

  it('uses progress date, updated timestamp and id as deterministic recency keys', () => {
    const company = makeCompany()
    const common = { progressUpdatedDate: TODAY }
    const first = makeApplication(company, {
      id: 'application-b',
      ...common,
      updatedAt: '2026-08-08T11:00:00.000Z',
    })
    const second = makeApplication(company, {
      id: 'application-a',
      ...common,
      updatedAt: '2026-08-08T11:00:00.000Z',
    })
    expect(aggregateCompanies([company], [first, second])[0].latestApplication.id)
      .toBe('application-a')
    expect(aggregateCompanies([company], [first, second])[0].latestUpdatedAt)
      .toBe('2026-08-08T11:00:00.000Z')
  })

  it('defaults to active applications and filters by stable phase, not custom names', () => {
    const company = makeCompany()
    const base = makeApplication(company)
    const stages = base.progressStages.map((stage) => ({ ...stage }))
    stages[3].name = '自定义面谈'
    const interview = replaceProgressWorkflow(base, {
      progressStages: stages,
      currentStageId: stages[3].id,
      localDate: TODAY,
    })
    const terminal = makeApplication(company, {
      id: 'terminal',
      progressStages: [{
        id: 'done', name: '结束', phase: 'result', isTerminal: true, date: TODAY,
      }],
      currentStageId: 'done',
    })

    const rows = filterApplicationCompanies([company], [interview, terminal], {
      phase: 'interview',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].applications).toEqual([interview])
  })

  it('searches v1.6 fields and combines recruitment filters with AND semantics', () => {
    const company = makeCompany({
      industryType: '新能源',
      recruitmentBatch: '春招正式批',
      priority: 'P0',
    })
    const first = makeApplication(company, { workLocation: '上海' })
    const second = makeApplication(company, { applicationNotes: '远程岗位' })
    expect(filterApplicationCompanies([company], [first, second], { query: '新能源' })[0].applications)
      .toHaveLength(2)
    expect(filterApplicationCompanies([company], [first, second], { query: '远程' })[0].applications)
      .toEqual([second])
    expect(filterRecruitmentCompanies([company], [first, second], {
      query: '春招',
      priority: 'P0',
      industryType: '新能源',
    }))
      .toHaveLength(1)
    expect(filterRecruitmentCompanies([company], [first, second], {
      query: '春招',
      priority: 'P1',
      industryType: '新能源',
    })).toHaveLength(0)
    expect(filterRecruitmentCompanies([company], [first, second], { query: '上海' }))
      .toHaveLength(0)
  })
})
