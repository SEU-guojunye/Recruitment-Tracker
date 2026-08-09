import {
  DEFAULT_COMPANY_PRIORITY,
  DEFAULT_RECRUITMENT_BATCH,
} from './constants.js'

function applyCompanyDefaults(company) {
  if (!company || typeof company !== 'object' || Array.isArray(company)) return company
  return {
    ...company,
    industryType: company.industryType === undefined ? '' : company.industryType,
    recruitmentBatch: company.recruitmentBatch === undefined
      ? DEFAULT_RECRUITMENT_BATCH
      : company.recruitmentBatch,
    priority: company.priority === undefined ? DEFAULT_COMPANY_PRIORITY : company.priority,
    companyNotes: company.companyNotes === undefined ? '' : company.companyNotes,
  }
}

function applyProgressStageDefaults(stage) {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return stage
  return {
    ...stage,
    note: stage.note === undefined ? '' : stage.note,
  }
}

function applyApplicationDefaults(application) {
  if (!application || typeof application !== 'object' || Array.isArray(application)) {
    return application
  }
  return {
    ...application,
    progressStages: Array.isArray(application.progressStages)
      ? application.progressStages.map(applyProgressStageDefaults)
      : application.progressStages,
  }
}

export function applyDatasetCompatibilityDefaults(dataset) {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return dataset
  if (!Array.isArray(dataset.companies)) return dataset
  return {
    ...dataset,
    companies: dataset.companies.map(applyCompanyDefaults),
    applications: Array.isArray(dataset.applications)
      ? dataset.applications.map(applyApplicationDefaults)
      : dataset.applications,
  }
}
