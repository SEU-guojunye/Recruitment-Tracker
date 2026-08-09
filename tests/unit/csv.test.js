import {
  CSV_HEADERS,
  ChromeLocalRepository,
  CsvImportError,
  CsvImportExportService,
  createApplication,
  createCompanyRecord,
  escapeSpreadsheetText,
  parseRecruitmentCsv,
  unescapeSpreadsheetText,
} from '@recruitment-tracker/core'
import { describe, expect, it } from 'vitest'

const NOW = new Date('2026-08-08T10:00:00.000Z')
const TODAY = '2026-08-08'

function sequence(prefix = 'id') {
  let index = 0
  return () => `${prefix}-${++index}`
}

class FakeStorageArea {
  constructor() {
    this.values = {}
    this.setCalls = 0
  }

  async get(key) {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}
  }

  async set(values) {
    this.setCalls += 1
    Object.assign(this.values, structuredClone(values))
  }
}

function createRepository({ storageArea = new FakeStorageArea(), maxDataBytes } = {}) {
  return new ChromeLocalRepository({
    storageArea,
    idFactory: sequence('device'),
    maxDataBytes,
    today: TODAY,
  })
}

function createFixture() {
  const idFactory = sequence('fixture')
  const firstCompany = createCompanyRecord({
    id: 'company-a',
    companyName: '示例,科技',
    recruitmentLink: 'https://example.com/careers',
    industryType: '=互联网',
    recruitmentBatch: '秋招提前批',
    priority: 'P0',
    companyNotes: '第一行\n包含 "引号" 与逗号,',
    createdAt: '2026-08-01T01:02:03.000Z',
    updatedAt: '2026-08-02T01:02:03.000Z',
  }, { idFactory, now: NOW })
  const emptyCompany = createCompanyRecord({
    id: 'company-empty',
    companyName: '暂无投递公司',
    industryType: '制造业',
    recruitmentBatch: '春招正式批',
    priority: 'P2',
    companyNotes: '=HYPERLINK("https://bad.example")',
    createdAt: '2026-08-03T01:02:03.000Z',
    updatedAt: '2026-08-04T01:02:03.000Z',
  }, { idFactory, now: NOW })
  const stages = [
    { id: 'stage-apply', name: '已投递', phase: 'submitted', isTerminal: false, date: '2026-08-01' },
    { id: 'stage-custom', name: '交叉面试', phase: 'interview', isTerminal: false, date: '2026-08-06' },
    { id: 'stage-offer', name: 'Offer', phase: 'result', isTerminal: true, date: '' },
  ]
  const options = {
    idFactory,
    now: NOW,
    today: TODAY,
    companyIds: new Set([firstCompany.id, emptyCompany.id]),
  }
  const firstApplication = createApplication({
    id: 'application-a',
    companyId: firstCompany.id,
    jobTitle: '前端开发工程师',
    applicationLink: 'https://example.com/jobs/1',
    workLocation: '上海',
    statusLink: 'https://example.com/status/1',
    appliedDate: '2026-08-01',
    progressStages: stages,
    currentStageId: 'stage-custom',
    progressUpdatedDate: '2026-08-06',
    isReferral: true,
    referralCode: '+86-test',
    applicationNotes: '@重点跟进\n第二行',
    createdAt: '2026-08-01T01:02:03.000Z',
    updatedAt: '2026-08-06T01:02:03.000Z',
  }, options)
  const secondApplication = createApplication({
    id: 'application-b',
    companyId: firstCompany.id,
    jobTitle: '平台工程师',
    appliedDate: '2026-08-02',
    progressUpdatedDate: '2026-08-02',
    applicationNotes: "'原始单引号",
  }, options)
  return {
    companies: [firstCompany, emptyCompany],
    applications: [firstApplication, secondApplication],
  }
}

async function seed(repository, data = createFixture()) {
  await repository.replaceAll(data)
  return data
}

function service(repository, options = {}) {
  return new CsvImportExportService(repository, {
    idFactory: sequence('import'),
    now: () => NOW,
    today: TODAY,
    ...options,
  })
}

function encodeRows(rows) {
  const quote = (value) => {
    const text = String(value ?? '')
    return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return `\uFEFF${[
    CSV_HEADERS.join(','),
    ...rows.map((row) => CSV_HEADERS.map((header) => quote(row.values[header])).join(',')),
  ].join('\r\n')}`
}

function replaceCell(csv, rowIndex, header, value) {
  const rows = parseRecruitmentCsv(csv)
  rows[rowIndex - 1].values[header] = value
  return encodeRows(rows)
}

describe('CsvImportExportService', () => {
  it('exports exact headers, all companies, independent applications and no secrets', async () => {
    const repository = createRepository()
    await seed(repository)
    const csv = await service(repository).exportCsv()
    const rows = parseRecruitmentCsv(csv)

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.slice(1).split('\r\n')[0]).toBe(CSV_HEADERS.join(','))
    expect(rows.filter((row) => row.values.recordType === 'company')).toHaveLength(2)
    expect(rows.filter((row) => row.values.recordType === 'application')).toHaveLength(2)
    expect(rows.find((row) => row.values.companyId === 'company-empty')).toBeDefined()
    expect(rows.filter((row) => row.values.companyId === 'company-a')).toHaveLength(3)
    expect(rows.find((row) => row.values.companyId === 'company-a').values).toMatchObject({
      industryType: '=互联网',
      recruitmentBatch: '秋招提前批',
      priority: 'P0',
      companyNotes: '',
    })
    expect(csv).not.toMatch(/_openid|accessToken|refreshToken|secretId|secretKey/iu)
  })

  it('round-trips classifications, application notes, custom stages and formulas losslessly', async () => {
    const source = createRepository()
    const expected = await seed(source)
    expected.companies = expected.companies.map((company) => ({
      ...company,
      companyNotes: '',
    }))
    const csv = await service(source).exportCsv()
    expect(csv).toContain("'=互联网")
    expect(csv).toContain("'+86-test")
    expect(csv).toContain("'@重点跟进")
    expect(csv).toContain("''原始单引号")

    const target = createRepository()
    const preview = await service(target).previewImport(csv)
    expect(preview).toMatchObject({
      canCommit: true,
      summary: {
        companyCreates: 2,
        applicationCreates: 2,
        errorCount: 0,
        confirmationCount: 0,
      },
    })
    await service(target).commitImport(preview)
    expect(await target.getData()).toEqual(expected)
  })

  it('imports applications before companies and applies missing timestamps at commit time', async () => {
    const source = createRepository()
    await seed(source)
    const rows = parseRecruitmentCsv(await service(source).exportCsv())
    const applicationRows = rows.filter((row) => row.values.recordType === 'application')
    const companyRows = rows.filter((row) => row.values.recordType === 'company')
    for (const row of [...applicationRows, ...companyRows]) {
      if (row.values.recordType === 'company') {
        row.values.companyCreatedAt = ''
        row.values.companyUpdatedAt = ''
      } else {
        row.values.applicationCreatedAt = ''
        row.values.applicationUpdatedAt = ''
      }
    }
    const csv = encodeRows([...applicationRows, ...companyRows])
    let clock = '2026-08-08T10:00:00.000Z'
    const target = createRepository()
    const importer = service(target, { now: () => new Date(clock) })
    const preview = await importer.previewImport(csv)
    expect(preview.canCommit).toBe(true)
    clock = '2026-08-08T11:30:00.000Z'
    await importer.commitImport(preview)

    const imported = await target.getData()
    expect(imported.companies.every((item) => item.createdAt === clock && item.updatedAt === clock))
      .toBe(true)
    expect(imported.applications.every((item) => item.createdAt === clock && item.updatedAt === clock))
      .toBe(true)
  })

  it('reversibly protects every spreadsheet formula prefix', () => {
    for (const value of [
      '=SUM(1,2)',
      '+cmd',
      '-2+3',
      '@query',
      '\tformula',
      '\rformula',
      '\nformula',
      "'literal",
    ]) {
      const escaped = escapeSpreadsheetText(value)
      expect(escaped.startsWith("'")).toBe(true)
      expect(unescapeSpreadsheetText(escaped)).toBe(value)
    }
  })

  it('reports row-specific date, boolean, JSON and duplicate-id errors without writing', async () => {
    const source = createRepository()
    await seed(source)
    const target = createRepository()
    const importer = service(target)
    const validCsv = await service(source).exportCsv()
    const cases = [
      [replaceCell(validCsv, 3, 'appliedDate', '2026-99-99'), 'appliedDate', 'invalid_date'],
      [replaceCell(validCsv, 3, 'isReferral', 'yes'), 'isReferral', 'INVALID_BOOLEAN'],
      [replaceCell(validCsv, 3, 'progressStages', '{}'), 'progressStages', 'INVALID_PROGRESS_STAGES_JSON'],
      [replaceCell(validCsv, 4, 'applicationId', 'application-a'), 'applicationId', 'DUPLICATE_ID'],
    ]
    for (const [csv, column, code] of cases) {
      const preview = await importer.previewImport(csv)
      expect(preview.canCommit).toBe(false)
      expect(preview.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: expect.any(Number), column, code }),
      ]))
    }
    expect(await target.getData()).toEqual({ companies: [], applications: [] })
    await expect(importer.commitImport(await importer.previewImport(cases[0][0])))
      .rejects.toBeInstanceOf(CsvImportError)
  })

  it('uses full-record updates, preserves unmentioned records and commits one revision', async () => {
    const repository = createRepository()
    const original = createFixture()
    await seed(repository, original)
    const before = await repository.getEnvelope()
    let csv = await service(repository).exportCsv()
    const selectedRows = parseRecruitmentCsv(csv).filter((row) =>
      row.values.companyId === 'company-a' && row.values.applicationId !== 'application-b',
    )
    csv = encodeRows(selectedRows)
    csv = replaceCell(csv, 1, 'industryType', '人工智能')
    csv = replaceCell(csv, 1, 'companyNotes', '不得导入的新备注')
    csv = replaceCell(csv, 2, 'workLocation', '')

    const preview = await service(repository).previewImport(csv)
    expect(preview.summary).toMatchObject({ companyUpdates: 1, applicationUpdates: 1 })
    await service(repository).commitImport(preview)
    const after = await repository.getEnvelope()
    expect(after.sync.localRevision).toBe(before.sync.localRevision + 1)
    expect(after.data.companies.find((item) => item.id === 'company-a')).toMatchObject({
      industryType: '人工智能',
      companyNotes: original.companies[0].companyNotes,
    })
    expect(after.data.applications.find((item) => item.id === 'application-a').workLocation).toBe('')
    expect(after.data.applications.find((item) => item.id === 'application-b')).toEqual(
      original.applications[1],
    )
  })

  it('requires confirmation before matching an id-less company by normalized name', async () => {
    const repository = createRepository()
    const existing = createCompanyRecord({
      id: 'company-existing',
      companyName: 'ＡＣＭＥ 科技',
      companyNotes: '旧备注',
    }, { now: NOW })
    await repository.saveCompany(existing)
    const source = createRepository()
    await source.saveCompany(createCompanyRecord({
      id: 'company-source',
      companyName: 'acme   科技',
      industryType: '互联网',
      priority: 'P0',
      companyNotes: '新备注',
    }, { now: NOW }))
    let csv = await service(source).exportCsv()
    csv = replaceCell(csv, 1, 'companyId', '')

    const importer = service(repository)
    const first = await importer.previewImport(csv)
    expect(first.canCommit).toBe(false)
    expect(first.confirmations[0]).toMatchObject({
      key: 'company:2',
      candidates: [{ id: 'company-existing', companyName: 'ＡＣＭＥ 科技' }],
    })
    const confirmed = await importer.previewImport(csv, {
      matches: { 'company:2': 'company-existing' },
    })
    expect(confirmed).toMatchObject({ canCommit: true, summary: { companyUpdates: 1 } })
    await importer.commitImport(confirmed)
    expect((await repository.getData()).companies).toHaveLength(1)
    expect((await repository.getData()).companies[0]).toMatchObject({
      industryType: '互联网',
      priority: 'P0',
      companyNotes: '旧备注',
    })
  })

  it('rejects unsupported recruitment batches and priorities atomically', async () => {
    const source = createRepository()
    await seed(source)
    const validCsv = await service(source).exportCsv()
    const importer = service(createRepository())
    for (const [csv, column, code] of [
      [replaceCell(validCsv, 1, 'recruitmentBatch', '暑期实习'), 'recruitmentBatch', 'invalid_recruitment_batch'],
      [replaceCell(validCsv, 1, 'priority', 'P3'), 'priority', 'invalid_priority'],
    ]) {
      const preview = await importer.previewImport(csv)
      expect(preview.canCommit).toBe(false)
      expect(preview.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ column, code }),
      ]))
    }
  })

  it('rejects stale previews and imports exceeding the configured capacity', async () => {
    const source = createRepository()
    await seed(source)
    const csv = await service(source).exportCsv()

    const repository = createRepository()
    const importer = service(repository)
    const preview = await importer.previewImport(csv)
    await repository.saveCompany(createCompanyRecord({ companyName: '并发写入' }, { now: NOW }))
    await expect(importer.commitImport(preview)).rejects.toMatchObject({
      code: 'STALE_IMPORT_PREVIEW',
    })

    const tinyRepository = createRepository()
    const tinyImporter = service(tinyRepository, { maxDataBytes: 200 })
    const oversized = await tinyImporter.previewImport(csv)
    expect(oversized.canCommit).toBe(false)
    expect(oversized.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CAPACITY_EXCEEDED' }),
    ]))
    expect(await tinyRepository.getData()).toEqual({ companies: [], applications: [] })
  })
})
