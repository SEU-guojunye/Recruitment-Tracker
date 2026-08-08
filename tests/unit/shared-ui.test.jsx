import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardView, PageState, ProgressTimeline } from '@recruitment-tracker/ui'
import { describe, expect, it, vi } from 'vitest'

const company = {
  id: 'company-a', companyName: '极光科技', normalizedCompanyName: '极光科技',
  recruitmentLink: 'https://example.com/jobs', companyNotes: '校招',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z',
}
const progressStages = [
  { id: 'submitted', name: '已投递', phase: 'submitted', isTerminal: false, date: '2026-08-01' },
  { id: 'interview', name: '业务面谈', phase: 'interview', isTerminal: false, date: '2026-08-08' },
  { id: 'result', name: '结果', phase: 'result', isTerminal: false, date: '' },
]
const application = {
  id: 'application-a', companyId: company.id, applicationLink: 'https://example.com/apply',
  workLocation: '上海', statusLink: '', appliedDate: '2026-08-01', progressStatus: '业务面谈',
  progressPhase: 'interview', progressIsTerminal: false, progressUpdatedDate: '2026-08-08',
  isReferral: false, referralCode: '', progressStages, currentStageId: 'interview', applicationNotes: '远程岗位',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z',
}

function renderDashboard(overrides = {}) {
  const props = {
    mode: 'readonly', companies: [company], applications: [application], activeTab: 'applications',
    onActiveTabChange: vi.fn(), query: '', onQueryChange: vi.fn(), scope: 'active',
    onScopeChange: vi.fn(), phase: null, onPhaseChange: vi.fn(),
    expandedCompanyIds: new Set([company.id]), onToggleCompany: vi.fn(),
    lastSyncedAt: '2026-08-08T00:00:00.000Z', ...overrides,
  }
  render(<DashboardView {...props} />)
  return props
}

describe('shared readonly dashboard UI', () => {
  it('renders four PRD statistic cards and no business write actions', () => {
    renderDashboard()
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText('面试中')).toBeInTheDocument()
    expect(screen.getByText('手机只读模式')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新增|编辑|删除|同步/u })).not.toBeInTheDocument()
  })

  it('uses real tabs and controlled filter events', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    expect(props.onActiveTabChange).toHaveBeenCalledWith('recruitment')
    await user.type(screen.getByRole('searchbox'), '极光')
    expect(props.onQueryChange).toHaveBeenCalled()
  })

  it('labels completed, current and upcoming timeline states without relying on color', () => {
    render(<ProgressTimeline application={application} />)
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('当前')).toBeInTheDocument()
    expect(screen.getByText('未到达')).toBeInTheDocument()
    expect(screen.getByLabelText('招聘进度：当前为业务面谈')).toBeInTheDocument()
  })

  it('exposes retryable errors as alerts', async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    render(<PageState type="error" title="数据加载失败" description="网络错误" onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('网络错误')
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
