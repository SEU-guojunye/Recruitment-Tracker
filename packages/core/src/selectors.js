import { APPLICATION_SCOPES } from './constants.js'
import { maxDateString, maxIsoTimestamp } from './dates.js'
import { normalizeSearchText } from './normalization.js'

export function compareApplicationsByRecentProgress(left, right) {
  return (
    right.progressUpdatedDate.localeCompare(left.progressUpdatedDate) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  )
}

export function compareCompaniesDeterministically(left, right) {
  return (
    left.normalizedCompanyName.localeCompare(right.normalizedCompanyName, 'zh-CN') ||
    left.id.localeCompare(right.id)
  )
}

export function findCompanyNameCandidates(companies, companyName, excludeId = null) {
  const normalizedName = normalizeSearchText(companyName)
  if (!normalizedName) return []
  return companies
    .filter(
      (company) =>
        company.id !== excludeId &&
        company.normalizedCompanyName === normalizedName,
    )
    .sort(compareCompaniesDeterministically)
}

export function selectApplicationStats(companies, applications) {
  const activeCompanyIds = new Set(
    applications
      .filter((application) => !application.progressIsTerminal)
      .map((application) => application.companyId),
  )
  return {
    activeCompanyCount: companies.filter((company) => activeCompanyIds.has(company.id)).length,
    applicationCount: applications.length,
    interviewApplicationCount: applications.filter(
      (application) =>
        application.progressPhase === 'interview' &&
        !application.progressIsTerminal,
    ).length,
    latestProgressUpdatedDate: maxDateString(
      applications.map((application) => application.progressUpdatedDate),
    ),
  }
}

export function selectCompanyStats(companies, applications) {
  const applicationStats = selectApplicationStats(companies, applications)
  return {
    companyCount: companies.length,
    applicationCount: applications.length,
    activeCompanyCount: applicationStats.activeCompanyCount,
    latestUpdatedAt: maxIsoTimestamp([
      ...companies.map((company) => company.updatedAt),
      ...applications.map((application) => application.updatedAt),
    ]),
  }
}

export function aggregateCompanies(companies, applications) {
  const applicationsByCompany = new Map()
  for (const application of applications) {
    const items = applicationsByCompany.get(application.companyId) || []
    items.push(application)
    applicationsByCompany.set(application.companyId, items)
  }

  return [...companies]
    .sort(compareCompaniesDeterministically)
    .map((company) => {
      const companyApplications = (applicationsByCompany.get(company.id) || [])
        .sort(compareApplicationsByRecentProgress)
      const progressCounts = companyApplications.reduce((counts, application) => {
        counts[application.progressPhase] = (counts[application.progressPhase] || 0) + 1
        return counts
      }, {})
      return {
        company,
        applications: companyApplications,
        applicationCount: companyApplications.length,
        latestApplication: companyApplications[0] || null,
        latestUpdatedAt: maxIsoTimestamp([
          company.updatedAt,
          ...companyApplications.map((application) => application.updatedAt),
        ]),
        progressCounts,
        hasActiveApplication: companyApplications.some(
          (application) => !application.progressIsTerminal,
        ),
      }
    })
}

function applicationSearchText(company, application) {
  return normalizeSearchText([
    company.companyName,
    company.recruitmentLink,
    company.companyNotes,
    application.jobTitle,
    application.applicationLink,
    application.statusLink,
    application.workLocation,
    application.applicationNotes,
  ].join(' '))
}

function companySearchText(company) {
  return normalizeSearchText([
    company.companyName,
    company.recruitmentLink,
    company.companyNotes,
  ].join(' '))
}

export function filterApplicationCompanies(
  companies,
  applications,
  { scope = APPLICATION_SCOPES.ACTIVE, phase = null, query = '' } = {},
) {
  const normalizedQuery = normalizeSearchText(query)
  return aggregateCompanies(companies, applications)
    .map((row) => {
      let visibleApplications = row.applications.filter((application) => {
        if (scope === APPLICATION_SCOPES.ACTIVE && application.progressIsTerminal) {
          return false
        }
        return !phase || application.progressPhase === phase
      })

      if (normalizedQuery) {
        const companyMatches = companySearchText(row.company).includes(normalizedQuery)
        if (!companyMatches) {
          visibleApplications = visibleApplications.filter((application) =>
            applicationSearchText(row.company, application).includes(normalizedQuery),
          )
        }
      }
      return { ...row, applications: visibleApplications }
    })
    .filter((row) => row.applications.length > 0)
}

export function filterRecruitmentCompanies(
  companies,
  applications,
  { query = '' } = {},
) {
  const normalizedQuery = normalizeSearchText(query)
  return aggregateCompanies(companies, applications).filter((row) => {
    if (!normalizedQuery) return true
    if (companySearchText(row.company).includes(normalizedQuery)) return true
    return row.applications.some((application) =>
      applicationSearchText(row.company, application).includes(normalizedQuery),
    )
  })
}
