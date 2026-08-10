import {
  COMPANY_PRIORITIES,
  FIELD_LIMITS,
  MODEL_SCHEMA_VERSION,
  PROGRESS_PHASE_ORDER,
  RECRUITMENT_BATCHES,
} from './constants.js'
import { isIsoUtcTimestamp, isLocalDate, toLocalDate } from './dates.js'
import {
  isCompanyBrandDomain,
  isHttpUrl,
  normalizeCompanyName,
} from './normalization.js'
import { deriveProgressSummary } from './progress.js'

export class DomainValidationError extends Error {
  constructor(errors) {
    super(errors[0]?.message || '数据校验失败')
    this.name = 'DomainValidationError'
    this.code = 'DOMAIN_VALIDATION_FAILED'
    this.errors = errors
  }
}

function addError(errors, path, code, message) {
  errors.push({ path, code, message })
}

function validateText(errors, value, path, { required = false, max }) {
  if (typeof value !== 'string') {
    addError(errors, path, 'invalid_type', `${path} 必须是字符串`)
    return
  }
  const trimmedLength = value.trim().length
  if (required && trimmedLength === 0) {
    addError(errors, path, 'required', `${path} 不能为空`)
  }
  if (value.length > max) {
    addError(errors, path, 'too_long', `${path} 不能超过 ${max} 个字符`)
  }
}

function validateId(errors, value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(errors, path, 'required', `${path} 不能为空`)
  }
}

function validateUrl(errors, value, path) {
  validateText(errors, value, path, { max: FIELD_LIMITS.url })
  if (typeof value === 'string' && value !== '' && !isHttpUrl(value)) {
    addError(errors, path, 'invalid_url', `${path} 只允许 HTTP/HTTPS URL`)
  }
}

function validateTimestamp(errors, value, path) {
  if (!isIsoUtcTimestamp(value)) {
    addError(errors, path, 'invalid_timestamp', `${path} 必须是 ISO 8601 UTC 时间`)
  }
}

export function validateCompanyRecord(company) {
  const errors = []
  if (!company || typeof company !== 'object' || Array.isArray(company)) {
    return {
      valid: false,
      errors: [{ path: 'company', code: 'invalid_type', message: '公司记录必须是对象' }],
    }
  }

  validateId(errors, company.id, 'id')
  validateText(errors, company.companyName, 'companyName', {
    required: true,
    max: FIELD_LIMITS.companyName,
  })
  if (
    typeof company.companyName === 'string' &&
    company.normalizedCompanyName !== normalizeCompanyName(company.companyName)
  ) {
    addError(
      errors,
      'normalizedCompanyName',
      'inconsistent_derived_field',
      'normalizedCompanyName 与 companyName 不一致',
    )
  }
  validateUrl(errors, company.recruitmentLink, 'recruitmentLink')
  if (company.brandDomain !== undefined) {
    validateText(errors, company.brandDomain, 'brandDomain', { max: FIELD_LIMITS.brandDomain })
    if (typeof company.brandDomain === 'string' && !isCompanyBrandDomain(company.brandDomain)) {
      addError(errors, 'brandDomain', 'invalid_brand_domain', 'brandDomain 必须是公司官方网站 hostname，且不能是招聘平台域名')
    }
  }
  if (company.logoUrl !== undefined) {
    validateUrl(errors, company.logoUrl, 'logoUrl')
  }
  validateText(errors, company.industryType, 'industryType', {
    max: FIELD_LIMITS.industryType,
  })
  if (!RECRUITMENT_BATCHES.includes(company.recruitmentBatch)) {
    addError(
      errors,
      'recruitmentBatch',
      'invalid_recruitment_batch',
      'recruitmentBatch 不在支持范围内',
    )
  }
  if (!COMPANY_PRIORITIES.includes(company.priority)) {
    addError(
      errors,
      'priority',
      'invalid_priority',
      'priority 只接受 P0、P1 或 P2',
    )
  }
  validateText(errors, company.companyNotes, 'companyNotes', {
    max: FIELD_LIMITS.notes,
  })
  validateTimestamp(errors, company.createdAt, 'createdAt')
  validateTimestamp(errors, company.updatedAt, 'updatedAt')
  return { valid: errors.length === 0, errors }
}

export function validateProgressStages(stages, currentStageId) {
  const errors = []
  if (!Array.isArray(stages)) {
    return {
      valid: false,
      errors: [{ path: 'progressStages', code: 'invalid_type', message: 'progressStages 必须是数组' }],
    }
  }
  if (stages.length < 1 || stages.length > FIELD_LIMITS.progressStages) {
    addError(
      errors,
      'progressStages',
      'invalid_count',
      `进度环节数量必须在 1～${FIELD_LIMITS.progressStages} 之间`,
    )
  }

  const stageIds = new Set()
  stages.forEach((stage, index) => {
    const prefix = `progressStages.${index}`
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      addError(errors, prefix, 'invalid_type', `${prefix} 必须是对象`)
      return
    }
    validateId(errors, stage.id, `${prefix}.id`)
    if (stageIds.has(stage.id)) {
      addError(errors, `${prefix}.id`, 'duplicate_id', '同一投递内的环节 ID 必须唯一')
    }
    stageIds.add(stage.id)
    validateText(errors, stage.name, `${prefix}.name`, {
      required: true,
      max: FIELD_LIMITS.stageName,
    })
    if (!PROGRESS_PHASE_ORDER.includes(stage.phase)) {
      addError(errors, `${prefix}.phase`, 'invalid_phase', '进度阶段代码无效')
    }
    if (typeof stage.isTerminal !== 'boolean') {
      addError(errors, `${prefix}.isTerminal`, 'invalid_type', 'isTerminal 必须是布尔值')
    }
    if (stage.phase === 'closed' && stage.isTerminal !== true) {
      addError(errors, `${prefix}.isTerminal`, 'closed_must_be_terminal', '关闭阶段必须为终态')
    }
    if (stage.date !== '' && !isLocalDate(stage.date)) {
      addError(errors, `${prefix}.date`, 'invalid_date', '环节日期必须是 YYYY-MM-DD 或空字符串')
    }
    validateText(errors, stage.note, `${prefix}.note`, {
      max: FIELD_LIMITS.notes,
    })
  })

  if (typeof currentStageId !== 'string' || !stageIds.has(currentStageId)) {
    addError(
      errors,
      'currentStageId',
      'stage_not_found',
      'currentStageId 必须指向一个进度环节',
    )
  }
  return { valid: errors.length === 0, errors }
}

export function validateApplication(application, { companyIds, today = toLocalDate() } = {}) {
  const errors = []
  if (!application || typeof application !== 'object' || Array.isArray(application)) {
    return {
      valid: false,
      errors: [{ path: 'application', code: 'invalid_type', message: '投递记录必须是对象' }],
    }
  }

  validateId(errors, application.id, 'id')
  validateId(errors, application.companyId, 'companyId')
  if (companyIds && !companyIds.has(application.companyId)) {
    addError(errors, 'companyId', 'company_not_found', '投递关联的公司不存在')
  }
  validateText(errors, application.jobTitle ?? '', 'jobTitle', {
    max: FIELD_LIMITS.jobTitle,
  })
  validateUrl(errors, application.applicationLink, 'applicationLink')
  validateUrl(errors, application.statusLink, 'statusLink')
  validateText(errors, application.workLocation, 'workLocation', {
    max: FIELD_LIMITS.workLocation,
  })
  validateText(errors, application.referralCode, 'referralCode', {
    max: FIELD_LIMITS.referralCode,
  })
  validateText(errors, application.applicationNotes, 'applicationNotes', {
    max: FIELD_LIMITS.notes,
  })

  if (!isLocalDate(application.appliedDate)) {
    addError(errors, 'appliedDate', 'invalid_date', '投递日期必须是 YYYY-MM-DD')
  } else if (application.appliedDate > today) {
    addError(errors, 'appliedDate', 'future_date', '投递日期不能晚于今天')
  }
  if (!isLocalDate(application.progressUpdatedDate)) {
    addError(errors, 'progressUpdatedDate', 'invalid_date', '进度更新时间必须是 YYYY-MM-DD')
  }
  if (typeof application.isReferral !== 'boolean') {
    addError(errors, 'isReferral', 'invalid_type', 'isReferral 必须是布尔值')
  }
  if (application.isReferral === false && application.referralCode !== '') {
    addError(errors, 'referralCode', 'must_be_empty', '非内推记录的内推码必须为空')
  }

  const stageResult = validateProgressStages(
    application.progressStages,
    application.currentStageId,
  )
  errors.push(...stageResult.errors)
  if (stageResult.valid) {
    const expected = deriveProgressSummary(
      application.progressStages,
      application.currentStageId,
    )
    for (const field of [
      'progressStatus',
      'progressPhase',
      'progressIsTerminal',
    ]) {
      if (application[field] !== expected[field]) {
        addError(
          errors,
          field,
          'inconsistent_derived_field',
          `${field} 与当前环节不一致`,
        )
      }
    }
  }

  validateTimestamp(errors, application.createdAt, 'createdAt')
  validateTimestamp(errors, application.updatedAt, 'updatedAt')
  return { valid: errors.length === 0, errors }
}

function prefixErrors(errors, prefix) {
  return errors.map((error) => ({ ...error, path: `${prefix}.${error.path}` }))
}

export function validateDataset(dataset, options = {}) {
  const errors = []
  if (!dataset || !Array.isArray(dataset.companies) || !Array.isArray(dataset.applications)) {
    return {
      valid: false,
      errors: [{ path: 'data', code: 'invalid_shape', message: '数据必须包含 companies 和 applications 数组' }],
    }
  }

  const companyIds = new Set()
  dataset.companies.forEach((company, index) => {
    if (companyIds.has(company?.id)) {
      addError(errors, `companies.${index}.id`, 'duplicate_id', '公司 ID 必须唯一')
    }
    companyIds.add(company?.id)
    errors.push(
      ...prefixErrors(validateCompanyRecord(company).errors, `companies.${index}`),
    )
  })

  const applicationIds = new Set()
  dataset.applications.forEach((application, index) => {
    if (applicationIds.has(application?.id)) {
      addError(errors, `applications.${index}.id`, 'duplicate_id', '投递 ID 必须唯一')
    }
    applicationIds.add(application?.id)
    errors.push(
      ...prefixErrors(
        validateApplication(application, { ...options, companyIds }).errors,
        `applications.${index}`,
      ),
    )
  })
  return { valid: errors.length === 0, errors }
}

export function validateVersionedData(value, options = {}) {
  if (value?.schemaVersion !== MODEL_SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [{
        path: 'schemaVersion',
        code: 'unsupported_schema_version',
        message: `仅支持 schemaVersion=${MODEL_SCHEMA_VERSION}`,
      }],
    }
  }
  return validateDataset(value.data, options)
}

export function assertValid(result) {
  if (!result.valid) throw new DomainValidationError(result.errors)
}
