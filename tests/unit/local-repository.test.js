import {
  AccountBindingError,
  ApplicationService,
  CapacityExceededError,
  ChromeLocalRepository,
  CompanyNameConflictError,
  CompanyService,
  UnsupportedSchemaVersionError,
  createApplication,
  createCompanyRecord,
  createDefaultEnvelope,
} from '@recruitment-tracker/core'
import { describe, expect, it, vi } from 'vitest'

const NOW = new Date('2026-08-08T10:00:00.000Z')
const TODAY = '2026-08-08'

function sequence(prefix = 'id') {
  let index = 0
  return () => `${prefix}-${++index}`
}

class FakeStorageArea {
  constructor(initial = {}) {
    this.values = structuredClone(initial)
    this.failNextSet = false
    this.setCalls = 0
  }

  async get(key) {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}
  }

  async set(values) {
    this.setCalls += 1
    if (this.failNextSet) {
      this.failNextSet = false
      throw new Error('storage failed')
    }
    Object.assign(this.values, structuredClone(values))
  }
}

function createRepository(options = {}) {
  return new ChromeLocalRepository({
    storageArea: options.storageArea || new FakeStorageArea(),
    idFactory: options.idFactory || sequence('device'),
    maxDataBytes: options.maxDataBytes,
    today: TODAY,
  })
}

function company(overrides = {}) {
  return createCompanyRecord(
    { companyName: '示例公司', ...overrides },
    { idFactory: sequence('company'), now: NOW },
  )
}

function application(targetCompany, overrides = {}) {
  return createApplication(
    { companyId: targetCompany.id, ...overrides },
    {
      idFactory: sequence('application'),
      now: NOW,
      today: TODAY,
      companyIds: new Set([targetCompany.id]),
    },
  )
}

describe('ChromeLocalRepository envelope and atomicity', () => {
  it('initializes one versioned envelope and preserves its device id', async () => {
    const storageArea = new FakeStorageArea()
    const repository = createRepository({ storageArea })
    const first = await repository.getEnvelope()
    const second = await repository.getEnvelope()
    expect(first).toEqual(second)
    expect(first).toMatchObject({
      schemaVersion: 1,
      settings: { activeTab: 'applications', boundUserId: null },
      sync: { localRevision: 0, dirty: false, status: 'idle' },
    })
    expect(storageArea.setCalls).toBe(1)
  })

  it('does not overwrite an unsupported envelope version', async () => {
    const key = 'recruitmentTrackerEnvelope'
    const storageArea = new FakeStorageArea({ [key]: { schemaVersion: 99 } })
    const repository = createRepository({ storageArea })
    await expect(repository.getEnvelope()).rejects.toBeInstanceOf(
      UnsupportedSchemaVersionError,
    )
    expect(storageArea.setCalls).toBe(0)
    expect(storageArea.values[key].schemaVersion).toBe(99)
  })

  it('reads legacy company records with v1.6 defaults without rewriting storage', async () => {
    const key = 'recruitmentTrackerEnvelope'
    const legacyCompany = company({ id: 'company-legacy' })
    delete legacyCompany.industryType
    delete legacyCompany.recruitmentBatch
    delete legacyCompany.priority
    delete legacyCompany.companyNotes
    const envelope = createDefaultEnvelope({ idFactory: sequence('legacy-device') })
    envelope.data.companies.push(legacyCompany)
    const storageArea = new FakeStorageArea({ [key]: envelope })
    const repository = createRepository({ storageArea })

    expect((await repository.getData()).companies[0]).toMatchObject({
      industryType: '',
      recruitmentBatch: '秋招正式批',
      priority: 'P1',
      companyNotes: '',
    })
    expect(storageArea.setCalls).toBe(0)
    expect(storageArea.values[key].data.companies[0]).not.toHaveProperty('industryType')
  })

  it('increments revision and dirty state for business writes only', async () => {
    const repository = createRepository()
    await repository.setActiveTab('recruitment')
    expect((await repository.getEnvelope()).sync.localRevision).toBe(0)

    const targetCompany = company()
    await repository.saveCompany(targetCompany)
    await repository.saveApplication(application(targetCompany))
    expect(await repository.getEnvelope()).toMatchObject({
      settings: { activeTab: 'recruitment' },
      sync: { localRevision: 2, dirty: true, status: 'dirty' },
    })
  })

  it('serializes concurrent transactions without losing either company', async () => {
    const repository = createRepository()
    await Promise.all([
      repository.saveCompany(company({ id: 'company-a', companyName: 'A' })),
      repository.saveCompany(company({ id: 'company-b', companyName: 'B' })),
    ])
    const envelope = await repository.getEnvelope()
    expect(envelope.data.companies.map((item) => item.id).sort()).toEqual([
      'company-a',
      'company-b',
    ])
    expect(envelope.sync.localRevision).toBe(2)
  })

  it('cascades company deletion and all children in one storage write', async () => {
    const storageArea = new FakeStorageArea()
    const repository = createRepository({ storageArea })
    const targetCompany = company()
    await repository.saveCompany(targetCompany)
    await repository.saveApplication(application(targetCompany, { id: 'app-a' }))
    await repository.saveApplication(application(targetCompany, { id: 'app-b' }))
    const beforeDeleteCalls = storageArea.setCalls

    const result = await repository.deleteCompanyCascade(targetCompany.id)
    expect(result.deletedApplications).toBe(2)
    expect(result.envelope.data).toEqual({ companies: [], applications: [] })
    expect(storageArea.setCalls - beforeDeleteCalls).toBe(1)
  })

  it('rejects an oversized write before storage and preserves prior data', async () => {
    const storageArea = new FakeStorageArea()
    const repository = createRepository({ storageArea, maxDataBytes: 400 })
    const targetCompany = company({ companyNotes: 'x'.repeat(300) })
    await expect(repository.saveCompany(targetCompany)).rejects.toBeInstanceOf(
      CapacityExceededError,
    )
    expect((await repository.getEnvelope()).data.companies).toEqual([])
  })

  it('preserves the previous envelope when chrome storage rejects an atomic set', async () => {
    const storageArea = new FakeStorageArea()
    const repository = createRepository({ storageArea })
    await repository.getEnvelope()
    storageArea.failNextSet = true
    await expect(repository.saveCompany(company())).rejects.toThrow('storage failed')
    expect((await repository.getEnvelope()).data.companies).toEqual([])
  })

  it('replaces a full dataset as one revision and exports snapshot metadata', async () => {
    const repository = createRepository()
    const targetCompany = company()
    const targetApplication = application(targetCompany)
    await repository.replaceAll({
      companies: [targetCompany],
      applications: [targetApplication],
    })
    expect(await repository.exportSnapshot()).toMatchObject({
      schemaVersion: 1,
      sourceRevision: 1,
      data: { companies: [targetCompany], applications: [targetApplication] },
    })
  })

  it('binds one account without changing business revision and rejects another', async () => {
    const repository = createRepository()
    await repository.bindUser('user-a')
    expect(await repository.getEnvelope()).toMatchObject({
      settings: { boundUserId: 'user-a' },
      sync: { localRevision: 0 },
    })
    await expect(repository.bindUser('user-b')).rejects.toBeInstanceOf(
      AccountBindingError,
    )
  })

  it('clears local business data and explicitly rebinds in one revision', async () => {
    const repository = createRepository()
    const targetCompany = company()
    await repository.saveCompany(targetCompany)
    await repository.bindUser('user-a')
    const envelope = await repository.clearAndRebind('user-b')
    expect(envelope.data).toEqual({ companies: [], applications: [] })
    expect(envelope.settings.boundUserId).toBe('user-b')
    expect(envelope.sync).toMatchObject({
      localRevision: 2,
      lastSyncedRevision: 0,
      dirty: true,
      status: 'dirty',
    })
  })
})

describe('CompanyService and ApplicationService', () => {
  it('requires explicit confirmation for normalized duplicate companies', async () => {
    const repository = createRepository()
    const service = new CompanyService(repository, {
      idFactory: sequence('company'),
      now: () => NOW,
    })
    await service.create({ companyName: 'ＡＣＭＥ 科技' })
    await expect(service.create({ companyName: 'acme   科技' }))
      .rejects.toBeInstanceOf(CompanyNameConflictError)
    await expect(service.create(
      { companyName: 'acme   科技' },
      { allowDuplicate: true },
    )).resolves.toBeDefined()
  })

  it('preserves ids and isolates application updates', async () => {
    const repository = createRepository()
    const companyService = new CompanyService(repository, {
      idFactory: sequence('company'),
      now: () => NOW,
    })
    const applicationService = new ApplicationService(repository, {
      idFactory: sequence('application'),
      now: () => NOW,
      today: () => TODAY,
    })
    const targetCompany = await companyService.create({ companyName: '示例公司' })
    const first = await applicationService.create({ companyId: targetCompany.id })
    const second = await applicationService.create({ companyId: targetCompany.id })
    const updated = await applicationService.update(first.id, { workLocation: '北京' })
    const data = await repository.getData()
    expect(updated.id).toBe(first.id)
    expect(data.applications.find((item) => item.id === second.id)).toEqual(second)
  })

  it('delegates one cascade operation and returns the child count', async () => {
    const repository = {
      deleteCompanyCascade: vi.fn().mockResolvedValue({ deletedApplications: 3 }),
    }
    const service = new CompanyService(repository)
    await expect(service.delete('company-a')).resolves.toEqual({ deletedApplications: 3 })
    expect(repository.deleteCompanyCascade).toHaveBeenCalledOnce()
  })
})
