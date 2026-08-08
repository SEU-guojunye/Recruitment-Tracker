import { toLocalDate } from './dates.js'
import { createApplication, createCompanyRecord } from './models.js'
import {
  findCompanyNameCandidates,
} from './selectors.js'
import {
  replaceProgressWorkflow,
  switchProgressStage,
} from './progress.js'
import {
  assertValid,
  validateApplication,
  validateCompanyRecord,
} from './validation.js'

export class CompanyNameConflictError extends Error {
  constructor(candidates) {
    super('存在规范化名称相同的公司，请确认更新已有公司或继续创建')
    this.name = 'CompanyNameConflictError'
    this.code = 'COMPANY_NAME_CONFLICT'
    this.candidates = candidates
  }
}

function nowIso(now) {
  return now().toISOString()
}

export class CompanyService {
  constructor(repository, { idFactory, now = () => new Date() } = {}) {
    this.repository = repository
    this.idFactory = idFactory
    this.now = now
  }

  async findCandidates(companyName, excludeId = null) {
    const data = await this.repository.getData()
    return findCompanyNameCandidates(data.companies, companyName, excludeId)
  }

  async create(input, { allowDuplicate = false } = {}) {
    const candidates = await this.findCandidates(input.companyName)
    if (candidates.length > 0 && !allowDuplicate) {
      throw new CompanyNameConflictError(candidates)
    }
    const company = createCompanyRecord(input, {
      idFactory: this.idFactory,
      now: this.now,
    })
    await this.repository.saveCompany(company)
    return company
  }

  async update(companyId, changes, { allowDuplicate = false } = {}) {
    const data = await this.repository.getData()
    const existing = data.companies.find((company) => company.id === companyId)
    if (!existing) throw new Error('公司记录不存在')
    const candidates = findCompanyNameCandidates(
      data.companies,
      changes.companyName ?? existing.companyName,
      companyId,
    )
    if (candidates.length > 0 && !allowDuplicate) {
      throw new CompanyNameConflictError(candidates)
    }
    const company = createCompanyRecord({
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(this.now),
    }, { idFactory: this.idFactory, now: this.now })
    assertValid(validateCompanyRecord(company))
    await this.repository.saveCompany(company)
    return company
  }

  delete(companyId) {
    return this.repository.deleteCompanyCascade(companyId)
  }
}

export class ApplicationService {
  constructor(
    repository,
    { idFactory, now = () => new Date(), today = () => toLocalDate(now()) } = {},
  ) {
    this.repository = repository
    this.idFactory = idFactory
    this.now = now
    this.today = today
  }

  async create(input) {
    const data = await this.repository.getData()
    const companyIds = new Set(data.companies.map((company) => company.id))
    const application = createApplication(input, {
      idFactory: this.idFactory,
      now: this.now,
      today: this.today(),
      companyIds,
    })
    await this.repository.saveApplication(application)
    return application
  }

  async update(applicationId, changes) {
    const data = await this.repository.getData()
    const existing = data.applications.find(
      (application) => application.id === applicationId,
    )
    if (!existing) throw new Error('投递记录不存在')
    const isReferral = changes.isReferral ?? existing.isReferral
    const application = {
      ...existing,
      ...changes,
      id: existing.id,
      companyId: changes.companyId ?? existing.companyId,
      createdAt: existing.createdAt,
      updatedAt: nowIso(this.now),
      isReferral,
      referralCode: isReferral
        ? changes.referralCode ?? existing.referralCode
        : '',
    }
    const companyIds = new Set(data.companies.map((company) => company.id))
    assertValid(validateApplication(application, {
      companyIds,
      today: this.today(),
    }))
    await this.repository.saveApplication(application)
    return application
  }

  async replaceProgress(applicationId, progressStages, currentStageId) {
    const data = await this.repository.getData()
    const existing = data.applications.find(
      (application) => application.id === applicationId,
    )
    if (!existing) throw new Error('投递记录不存在')
    const application = {
      ...replaceProgressWorkflow(existing, {
        progressStages,
        currentStageId,
        localDate: this.today(),
      }),
      updatedAt: nowIso(this.now),
    }
    await this.repository.saveApplication(application)
    return application
  }

  async switchProgress(applicationId, stageId) {
    const data = await this.repository.getData()
    const existing = data.applications.find(
      (application) => application.id === applicationId,
    )
    if (!existing) throw new Error('投递记录不存在')
    const application = {
      ...switchProgressStage(existing, stageId, this.today()),
      updatedAt: nowIso(this.now),
    }
    await this.repository.saveApplication(application)
    return application
  }

  delete(applicationId) {
    return this.repository.deleteApplication(applicationId)
  }
}
