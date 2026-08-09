import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CompanyLogo,
  DashboardView,
  PageState,
  ProgressTimeline,
  getCompanyIconUrl,
  getCompanyIconUrls,
} from '@recruitment-tracker/ui'
import { describe, expect, it, vi } from 'vitest'

const company = {
  id: 'company-a', companyName: '极光科技', normalizedCompanyName: '极光科技',
  recruitmentLink: 'https://example.com/jobs?from=test', industryType: '互联网',
  recruitmentBatch: '秋招正式批', priority: 'P0', companyNotes: '兼容备注',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z',
}
const progressStages = [
  { id: 'submitted', name: '已投递', phase: 'submitted', isTerminal: false, date: '2026-08-01', note: '' },
  { id: 'interview', name: '业务面谈', phase: 'interview', isTerminal: false, date: '2026-08-08', note: '准备案例\n会议：https://meeting.example.com/interview。' },
  { id: 'result', name: '结果', phase: 'result', isTerminal: false, date: '', note: '' },
]
const application = {
  id: 'application-a', companyId: company.id, applicationLink: 'https://example.com/apply',
  jobTitle: '前端工程师', workLocation: '上海', statusLink: '', appliedDate: '2026-08-01', progressStatus: '业务面谈',
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
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
  })

  it('uses real tabs and controlled filter events', async () => {
    const user = userEvent.setup()
    const props = renderDashboard()
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    expect(props.onActiveTabChange).toHaveBeenCalledWith('recruitment')
    await user.type(screen.getByRole('searchbox'), '极光')
    expect(props.onQueryChange).toHaveBeenCalled()
  })

  it('labels timeline states and switches one accessible stage detail panel', async () => {
    const user = userEvent.setup()
    render(<ProgressTimeline application={application} />)
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('当前')).toBeInTheDocument()
    expect(screen.getByText('未到达')).toBeInTheDocument()
    expect(screen.getByLabelText('招聘进度：当前为业务面谈')).toBeInTheDocument()
    expect(screen.getByText('业务面谈').closest('li')).toHaveAttribute('aria-current', 'step')
    const timelineLabel = document.querySelector('.rt-timeline__label')
    expect(timelineLabel?.firstElementChild).toHaveClass('rt-timeline__expand-hint')
    expect(timelineLabel?.lastElementChild).toHaveClass('rt-timeline__name')

    const interviewTrigger = screen.getByRole('button', { name: '业务面谈：当前，展开详情' })
    expect(interviewTrigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(interviewTrigger)
    expect(interviewTrigger).toHaveAttribute('aria-expanded', 'true')
    const interviewDetail = screen.getByRole('region', { name: '业务面谈节点详情' })
    expect(interviewDetail).toHaveTextContent('2026.08.08')
    expect(interviewDetail).toHaveTextContent('日期')
    expect(interviewDetail).not.toHaveTextContent('节点日期')
    expect(interviewDetail).toHaveTextContent('准备案例')
    expect(document.querySelectorAll('.rt-timeline__expand-hint')).toHaveLength(progressStages.length)
    expect(within(interviewDetail).getByRole('link', {
      name: /https:\/\/meeting\.example\.com\/interview/u,
    })).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    })

    await user.click(screen.getByRole('button', { name: '结果：未到达，展开详情' }))
    expect(screen.queryByRole('region', { name: '业务面谈节点详情' })).not.toBeInTheDocument()
    const resultDetail = screen.getByRole('region', { name: '结果节点详情' })
    expect(resultDetail).toHaveTextContent('未填写')
    expect(resultDetail).toHaveTextContent('暂无备注')

    await user.click(screen.getByRole('button', { name: '结果：未到达，收起详情' }))
    expect(screen.queryByRole('region', { name: '结果节点详情' })).not.toBeInTheDocument()
  })

  it('tries multiple external icon APIs and keeps a one-character themed fallback', () => {
    expect(getCompanyIconUrls(company.recruitmentLink, { brandfetchClientId: 'public-client-id' })).toEqual([
      'https://cdn.brandfetch.io/example.com/w/128/h/128/fallback/404/type/icon.png?c=public-client-id',
      'https://logo.tomba.io/example.com',
      'https://ico.faviconkit.net/favicon/example.com?sz=128',
    ])
    expect(getCompanyIconUrls(company.recruitmentLink)).toEqual([
      'https://logo.tomba.io/example.com',
      'https://ico.faviconkit.net/favicon/example.com?sz=128',
    ])
    expect(getCompanyIconUrl(company.recruitmentLink))
      .toBe('https://ico.faviconkit.net/favicon/example.com?sz=128')
    expect(getCompanyIconUrls('javascript:alert(1)')).toEqual([])
    expect(getCompanyIconUrl('javascript:alert(1)')).toBe('')
    const { container, unmount } = render(<CompanyLogo company={company} />)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://logo.tomba.io/example.com',
    )
    expect(container).toHaveTextContent('极')
    expect(container).not.toHaveTextContent('极光')
    fireEvent.load(container.querySelector('img'))
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://ico.faviconkit.net/favicon/example.com?sz=128',
    )
    expect(container.querySelector('.rt-company-logo')).not.toHaveClass('is-loaded')
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container).toHaveTextContent('极')
    expect(container).not.toHaveTextContent('极光')

    unmount()
    const successful = render(<CompanyLogo company={company} />)
    Object.defineProperty(successful.container.querySelector('img'), 'naturalWidth', { value: 180 })
    fireEvent.load(successful.container.querySelector('img'))
    expect(successful.container.querySelector('.rt-company-logo')).toHaveClass('is-loaded')
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
