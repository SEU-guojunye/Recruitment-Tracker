import { useState } from 'react'
import { APPLICATION_SCOPES } from '@recruitment-tracker/core'
import { DashboardView } from '@recruitment-tracker/ui'

const companies = [
  {
    id: 'company-aurora',
    companyName: '极光科技',
    normalizedCompanyName: '极光科技',
    recruitmentLink: 'https://example.com/aurora/careers',
    companyNotes: '关注校招与远程岗位',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-08T09:20:00.000Z',
  },
  {
    id: 'company-northstar',
    companyName: '北辰智能',
    normalizedCompanyName: '北辰智能',
    recruitmentLink: 'https://example.com/northstar/jobs',
    companyNotes: '算法与平台方向',
    createdAt: '2026-08-02T08:00:00.000Z',
    updatedAt: '2026-08-07T07:10:00.000Z',
  },
]

function stages(prefix, dates = {}) {
  return [
    { id: `${prefix}-submitted`, name: '已投递', phase: 'submitted', isTerminal: false, date: dates.submitted || '' },
    { id: `${prefix}-screening`, name: '筛选', phase: 'screening', isTerminal: false, date: dates.screening || '' },
    { id: `${prefix}-assessment`, name: '笔试', phase: 'assessment', isTerminal: false, date: dates.assessment || '' },
    { id: `${prefix}-tech`, name: '技术一面', phase: 'interview', isTerminal: false, date: dates.tech || '' },
    { id: `${prefix}-hr`, name: 'HR 面', phase: 'interview', isTerminal: false, date: dates.hr || '' },
    { id: `${prefix}-result`, name: '结果', phase: 'result', isTerminal: false, date: dates.result || '' },
  ]
}

const applicationAStages = stages('a', {
  submitted: '2026-08-02', screening: '2026-08-03', assessment: '2026-08-05', tech: '2026-08-08',
})
const applicationBStages = stages('b', { submitted: '2026-08-07' })
const applications = [
  {
    id: 'application-a', companyId: 'company-aurora', applicationLink: 'https://example.com/applications/a',
    workLocation: '上海 / 远程', statusLink: '', appliedDate: '2026-08-02', progressStatus: '技术一面',
    progressPhase: 'interview', progressIsTerminal: false, progressUpdatedDate: '2026-08-08', isReferral: true,
    referralCode: 'REF-2026', progressStages: applicationAStages, currentStageId: 'a-tech', applicationNotes: '准备系统设计',
    createdAt: '2026-08-02T08:00:00.000Z', updatedAt: '2026-08-08T09:20:00.000Z',
  },
  {
    id: 'application-b', companyId: 'company-northstar', applicationLink: 'https://example.com/applications/b',
    workLocation: '杭州', statusLink: '', appliedDate: '2026-08-07', progressStatus: '已投递',
    progressPhase: 'submitted', progressIsTerminal: false, progressUpdatedDate: '2026-08-07', isReferral: false,
    referralCode: '', progressStages: applicationBStages, currentStageId: 'b-submitted', applicationNotes: '',
    createdAt: '2026-08-07T07:00:00.000Z', updatedAt: '2026-08-07T07:10:00.000Z',
  },
]

export function WebApp() {
  const [activeTab, setActiveTab] = useState('applications')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(APPLICATION_SCOPES.ACTIVE)
  const [phase, setPhase] = useState(null)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState(
    new Set(['company-aurora']),
  )

  function toggleCompany(companyId) {
    setExpandedCompanyIds((current) => {
      const next = new Set(current)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  return (
    <DashboardView
      mode="readonly"
      companies={companies}
      applications={applications}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      query={query}
      onQueryChange={setQuery}
      scope={scope}
      onScopeChange={setScope}
      phase={phase}
      onPhaseChange={setPhase}
      expandedCompanyIds={expandedCompanyIds}
      onToggleCompany={toggleCompany}
      lastSyncedAt="2026-08-08T09:20:00.000Z"
    />
  )
}
