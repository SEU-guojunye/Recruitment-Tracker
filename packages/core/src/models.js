import {
  DEFAULT_COMPANY_PRIORITY,
  DEFAULT_RECRUITMENT_BATCH,
  MODEL_SCHEMA_VERSION,
} from './constants.js'
import { toLocalDate } from './dates.js'
import {
  normalizeCompanyName,
  normalizeOptionalUrl,
} from './normalization.js'
import {
  createDefaultProgressStages,
  deriveProgressSummary,
} from './progress.js'
import {
  assertValid,
  validateApplication,
  validateCompanyRecord,
} from './validation.js'

function defaultIdFactory() {
  return crypto.randomUUID()
}

function toIso(now) {
  return (typeof now === 'function' ? now() : now || new Date()).toISOString()
}

export function createCompanyRecord(
  input,
  { idFactory = defaultIdFactory, now = () => new Date() } = {},
) {
  const timestamp = toIso(now)
  const companyName = typeof input.companyName === 'string' ? input.companyName.trim() : input.companyName
  const company = {
    id: input.id || `company-${idFactory()}`,
    companyName,
    normalizedCompanyName: normalizeCompanyName(companyName),
    recruitmentLink: normalizeOptionalUrl(input.recruitmentLink),
    industryType: typeof input.industryType === 'string'
      ? input.industryType.trim()
      : '',
    recruitmentBatch: input.recruitmentBatch || DEFAULT_RECRUITMENT_BATCH,
    priority: input.priority || DEFAULT_COMPANY_PRIORITY,
    companyNotes: input.companyNotes || '',
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
  assertValid(validateCompanyRecord(company))
  return company
}

export function createApplication(
  input,
  {
    idFactory = defaultIdFactory,
    now = () => new Date(),
    today = toLocalDate(typeof now === 'function' ? now() : now),
    companyIds,
  } = {},
) {
  const timestamp = toIso(now)
  const appliedDate = input.appliedDate || today
  const progressStages = input.progressStages
    ? input.progressStages.map((stage) => ({ ...stage, name: stage.name.trim() }))
    : createDefaultProgressStages({ appliedDate, idFactory })
  const currentStageId = input.currentStageId || progressStages[0]?.id
  const summary = deriveProgressSummary(progressStages, currentStageId) || {}
  const isReferral = input.isReferral ?? false
  const application = {
    id: input.id || `application-${idFactory()}`,
    companyId: input.companyId,
    jobTitle: input.jobTitle || '',
    applicationLink: normalizeOptionalUrl(input.applicationLink),
    workLocation: input.workLocation || '',
    statusLink: normalizeOptionalUrl(input.statusLink),
    appliedDate,
    ...summary,
    progressUpdatedDate: input.progressUpdatedDate || today,
    isReferral,
    referralCode: isReferral ? input.referralCode || '' : '',
    progressStages,
    currentStageId,
    applicationNotes: input.applicationNotes || '',
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
  assertValid(validateApplication(application, { companyIds, today }))
  return application
}

export function createVersionedData(data) {
  return { schemaVersion: MODEL_SCHEMA_VERSION, data }
}
