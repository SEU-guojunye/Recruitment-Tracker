import { useId, useState } from 'react'
import {
  APPLICATION_SCOPES,
  COMPANY_PRIORITIES,
  INDUSTRY_TYPE_PRESETS,
  PROGRESS_PHASES,
  PROGRESS_PHASE_ORDER,
  filterApplicationCompanies,
  filterRecruitmentCompanies,
  getTimelineStates,
  selectApplicationStats,
  selectCompanyStats,
} from '@recruitment-tracker/core'
import { getCompanyIconUrl } from './company-logo.js'

function formatLocalDate(value) {
  return value ? value.replaceAll('-', '.') : '未填写'
}

function formatTimestamp(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatDateOnly(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '暂无'
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('.')
}

function Icon({ name, className = '' }) {
  const common = {
    className: `rt-icon ${className}`.trim(),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (name === 'building') {
    return <svg {...common}><path d="M4 20h16M6 20V6.5L12 4l6 2.5V20M9 9h1M14 9h1M9 13h1M14 13h1M11 20v-3h2v3" /></svg>
  }
  if (name === 'briefcase') {
    return <svg {...common}><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12h16M10 12v2h4v-2" /></svg>
  }
  if (name === 'chart') {
    return <svg {...common}><path d="M4 18V5M4 18h16M8 15v-3M12 15V8M16 15v-6M20 15v-9" /></svg>
  }
  if (name === 'message') {
    return <svg {...common}><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></svg>
  }
  if (name === 'clock') {
    return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>
  }
  if (name === 'search') {
    return <svg {...common}><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
  }
  if (name === 'chevron') {
    return <svg {...common}><path d="m9 5 7 7-7 7" /></svg>
  }
  if (name === 'arrow') {
    return <svg {...common}><path d="M7 17 17 7M8 7h9v9" /></svg>
  }
  if (name === 'check') {
    return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
  }
  if (name === 'warning') {
    return <svg {...common}><path d="M12 4 3.5 20h17L12 4Z" /><path d="M12 9v5M12 17h.01" /></svg>
  }
  return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
}

export function ExternalLink({ href, children, className = '' }) {
  if (!href) return <span className={className}>未填写</span>
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      <span>{children}</span><Icon name="arrow" className="rt-icon--small" />
    </a>
  )
}

export function PageState({ type, title, description, actionLabel = '重试', onRetry }) {
  const isError = type === 'error'
  return (
    <section
      className={`rt-page-state rt-page-state--${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="rt-page-state__icon">
        <Icon name={isError ? 'warning' : type === 'empty' ? 'search' : 'circle'} />
      </span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {isError && onRetry ? (
        <button className="rt-button rt-button--secondary" type="button" onClick={onRetry}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}

export function CompanyLogo({ company }) {
  const iconUrl = getCompanyIconUrl(company.recruitmentLink)
  const [loadedUrl, setLoadedUrl] = useState('')
  const loaded = Boolean(iconUrl) && loadedUrl === iconUrl
  const fallback = company.companyName.trim().slice(0, 2) || '公司'
  return (
    <span className={`rt-company-logo ${loaded ? 'is-loaded' : ''}`} aria-hidden="true">
      <span>{fallback}</span>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          width="64"
          height="64"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            setLoadedUrl(event.currentTarget.naturalWidth > 0 ? iconUrl : '')
          }}
          onError={() => setLoadedUrl('')}
        />
      ) : null}
    </span>
  )
}

export function ProgressTimeline({ application, action = null }) {
  const states = getTimelineStates(application)
  const stateLabels = {
    completed: '已完成',
    current: '当前',
    upcoming: '未到达',
  }
  return (
    <section className="rt-timeline-wrap">
      <div className="rt-timeline__head">
        <span>招聘进度</span>
        {action}
      </div>
      <ol
        className="rt-timeline"
        style={{ '--rt-step-count': states.length }}
        aria-label={`招聘进度：当前为${application.progressStatus}`}
      >
        {states.map((stage) => (
          <li
            className={`rt-timeline__step is-${stage.state}`}
            key={stage.id}
            aria-current={stage.state === 'current' ? 'step' : undefined}
          >
            <span className="rt-timeline__marker">
              {stage.state === 'completed' ? <Icon name="check" /> : null}
            </span>
            <span className="rt-timeline__name" title={stage.name}>{stage.name}</span>
            <span className="rt-sr-only">{stateLabels[stage.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StatCards({ items, activeTab }) {
  return (
    <section className={`rt-stats rt-stats--${activeTab}`} aria-label="数据概览">
      {items.map((item) => (
        <article className="rt-stat" key={item.label}>
          <div className="rt-stat__label">
            <span>{item.label}</span>
            <span className="rt-stat__icon"><Icon name={item.icon} /></span>
          </div>
          <div className="rt-stat__value">
            {item.value}{item.unit ? <small>{item.unit}</small> : null}
          </div>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  )
}

function ApplicationCard({
  application,
  index,
  mode,
  renderActions,
  renderProgressAction,
}) {
  const recordLabel = `投递记录 ${String(index + 1).padStart(2, '0')}`
  const jobTitle = typeof application.jobTitle === 'string' ? application.jobTitle.trim() : ''
  return (
    <article className="rt-application-card">
      <div className="rt-application-info-grid">
        <div className="rt-application-cell rt-application-cell--title">
          <span>投递岗位名称</span>
          <strong title={jobTitle || recordLabel}>{jobTitle || recordLabel}</strong>
        </div>
        <div className="rt-application-cell">
          <span>岗位链接</span>
          <ExternalLink className="rt-application-link" href={application.applicationLink}>查看岗位</ExternalLink>
        </div>
        <div className="rt-application-cell">
          <span>岗位工作地点</span>
          <strong>{application.workLocation || '未填写'}</strong>
        </div>
        <div className="rt-application-cell">
          <span>投递日期</span>
          <strong>{formatLocalDate(application.appliedDate)}</strong>
        </div>
        <div className="rt-application-cell">
          <span>最新更新日期</span>
          <strong>{formatDateOnly(application.updatedAt)}</strong>
        </div>
      </div>
      {mode === 'editable' && renderActions ? (
        <div className="rt-application-actions">{renderActions(application)}</div>
      ) : null}
      <ProgressTimeline
        application={application}
        action={mode === 'editable' && renderProgressAction
          ? renderProgressAction(application)
          : null}
      />
    </article>
  )
}

function ApplicationCompanyList({
  rows,
  expandedCompanyIds,
  onToggleCompany,
  mode,
  renderCompanyActions,
  renderApplicationActions,
  renderProgressAction,
}) {
  return (
    <div className="rt-company-list">
      <div className="rt-company-list__head" aria-hidden="true">
        <span /><span>公司</span><span>投递链接</span><span>投递岗位数</span><span>已投递岗位</span><span>操作</span>
      </div>
      {rows.map((row) => {
        const expanded = expandedCompanyIds.has(row.company.id)
        const panelId = `rt-company-${row.company.id}`
        const visibleJobTitles = row.applications.map((application, index) => (
          application.jobTitle?.trim() || `投递记录 ${String(index + 1).padStart(2, '0')}`
        ))
        return (
          <article className={`rt-company-card ${expanded ? 'is-open' : ''}`} key={row.company.id}>
            <div className="rt-company-card__head">
              <button
                className="rt-expand-button"
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={`${expanded ? '收起' : '展开'}${row.company.companyName}`}
                onClick={() => onToggleCompany(row.company.id)}
              >
                <Icon name="chevron" />
              </button>
              <div className="rt-company-identity">
                <CompanyLogo company={row.company} />
                <strong title={row.company.companyName}>{row.company.companyName}</strong>
              </div>
              <div className="rt-company-summary-cell" data-label="投递链接">
                <ExternalLink className="rt-company-link" href={row.company.recruitmentLink}>投递链接</ExternalLink>
              </div>
              <div className="rt-company-summary-cell rt-company-summary-count" data-label="投递岗位数">
                {row.applications.length}
              </div>
              <div className="rt-company-summary-cell rt-applied-jobs" data-label="已投递岗位" title={visibleJobTitles.join('、')}>
                {visibleJobTitles.length ? visibleJobTitles.join('、') : '暂无岗位'}
              </div>
              {mode === 'editable' && renderCompanyActions ? (
                <div className="rt-row-actions">{renderCompanyActions(row.company)}</div>
              ) : <span />}
            </div>
            {expanded ? (
              <div className="rt-company-card__details" id={panelId}>
                <p className="rt-detail-caption">岗位投递明细 · {row.applications.length} 条</p>
                <div className="rt-application-list">
                  {row.applications.map((application, index) => (
                    <ApplicationCard
                      application={application}
                      index={index}
                      key={application.id}
                      mode={mode}
                      renderActions={renderApplicationActions}
                      renderProgressAction={renderProgressAction}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function RecruitmentCompanyList({ rows, mode, renderCompanyActions, renderCompanyField }) {
  const fieldValue = (company, field, fallback = '未填写') => {
    const value = company[field] || fallback
    return mode === 'editable' && renderCompanyField
      ? renderCompanyField(company, field, value)
      : <span className="rt-recruitment-value">{value}</span>
  }
  return (
    <div className="rt-recruitment-list">
      <div className="rt-recruitment-list__head" aria-hidden="true">
        <span>公司</span><span>行业类型</span><span>招聘批次</span><span>优先度</span>
        <span>招聘链接</span><span>投递岗位数</span><span>最近更新</span><span>操作</span>
      </div>
      {rows.map((row) => (
        <article className="rt-recruitment-row" key={row.company.id}>
          <div className="rt-company-identity">
            <CompanyLogo company={row.company} />
            <strong title={row.company.companyName}>{row.company.companyName}</strong>
          </div>
          <div className="rt-recruitment-cell" data-label="行业类型">{fieldValue(row.company, 'industryType')}</div>
          <div className="rt-recruitment-cell" data-label="招聘批次">{fieldValue(row.company, 'recruitmentBatch')}</div>
          <div className="rt-recruitment-cell" data-label="优先度">{fieldValue(row.company, 'priority')}</div>
          <div className="rt-recruitment-cell rt-recruitment-cell--link" data-label="招聘链接">
            <ExternalLink className="rt-company-link" href={row.company.recruitmentLink}>招聘链接</ExternalLink>
          </div>
          <div className="rt-recruitment-cell rt-tabular" data-label="投递岗位数">{row.applicationCount}</div>
          <div className="rt-recruitment-cell rt-tabular" data-label="最近更新">{formatDateOnly(row.latestUpdatedAt)}</div>
          {mode === 'editable' && renderCompanyActions ? (
            <div className="rt-row-actions">{renderCompanyActions(row.company)}</div>
          ) : <span />}
        </article>
      ))}
    </div>
  )
}

function DashboardToolbar({
  activeTab,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  phase,
  onPhaseChange,
  priority,
  onPriorityChange,
  industryType,
  onIndustryTypeChange,
  industries,
  status,
}) {
  const searchId = useId()
  return (
    <header className="rt-panel-head">
      <div className="rt-panel-controls">
        <label className="rt-search" htmlFor={searchId}>
          <span className="rt-sr-only">搜索</span>
          <Icon name="search" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={activeTab === 'applications'
              ? '搜索公司、已投递岗位或地点'
              : '搜索公司、行业、批次或优先度'}
          />
        </label>
        <div className="rt-toolbar__filters">
          {activeTab === 'applications' ? (
            <>
              <label>
                <span className="rt-sr-only">投递范围</span>
                <select value={scope} onChange={(event) => onScopeChange(event.target.value)}>
                  <option value={APPLICATION_SCOPES.ACTIVE}>进行中的投递</option>
                  <option value={APPLICATION_SCOPES.ALL}>全部投递</option>
                </select>
              </label>
              <label>
                <span className="rt-sr-only">招聘阶段</span>
                <select value={phase || ''} onChange={(event) => onPhaseChange(event.target.value || null)}>
                  <option value="">全部阶段</option>
                  {PROGRESS_PHASE_ORDER.map((value) => (
                    <option value={value} key={value}>{PROGRESS_PHASES[value].label}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <span className="rt-sr-only">筛选优先度</span>
                <select value={priority || ''} onChange={(event) => onPriorityChange?.(event.target.value || null)}>
                  <option value="">全部优先度</option>
                  {COMPANY_PRIORITIES.map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span className="rt-sr-only">筛选行业</span>
                <select value={industryType || ''} onChange={(event) => onIndustryTypeChange?.(event.target.value || null)}>
                  <option value="">全部行业</option>
                  {industries.map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      </div>
      <span className="rt-panel-status"><span />{status}</span>
    </header>
  )
}

function getStats(activeTab, companies, applications) {
  if (activeTab === 'applications') {
    const stats = selectApplicationStats(companies, applications)
    return [
      { label: '进行中的公司', value: stats.activeCompanyCount, unit: '家公司', note: '至少一条非终态投递', icon: 'chart' },
      { label: '已投递岗位', value: stats.applicationCount, unit: '个岗位', note: '全部岗位投递记录', icon: 'briefcase' },
      { label: '面试中', value: stats.interviewApplicationCount, unit: '个岗位', note: '当前处于面试阶段', icon: 'message' },
      { label: '最近更新', value: formatLocalDate(stats.latestProgressUpdatedDate), note: '按进度更新时间', icon: 'clock' },
    ]
  }
  const stats = selectCompanyStats(companies, applications)
  return [
    { label: '招聘公司', value: stats.companyCount, unit: '家公司', note: '全部已保存的招聘信息', icon: 'building' },
    { label: '投递岗位数', value: stats.applicationCount, unit: '个岗位', note: '公司下全部岗位记录', icon: 'briefcase' },
    { label: 'P0 公司', value: stats.p0CompanyCount, unit: '家公司', note: '优先跟进队列', icon: 'chart' },
    { label: '最近更新', value: formatDateOnly(stats.latestUpdatedAt), note: '公司与投递更新时间', icon: 'clock' },
  ]
}

export function DashboardView({
  mode = 'readonly',
  companies,
  applications,
  activeTab,
  onActiveTabChange,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  phase,
  onPhaseChange,
  priority = null,
  onPriorityChange,
  industryType = null,
  onIndustryTypeChange,
  expandedCompanyIds,
  onToggleCompany,
  loading = false,
  error = null,
  onRetry,
  lastSyncedAt = null,
  headerActions,
  pageActions,
  renderCompanyActions,
  renderCompanyField,
  renderApplicationActions,
  renderProgressAction,
}) {
  const rows = activeTab === 'applications'
    ? filterApplicationCompanies(companies, applications, { scope, phase, query })
    : filterRecruitmentCompanies(companies, applications, { query, priority, industryType })
  const industries = [...new Set([
    ...INDUSTRY_TYPE_PRESETS,
    ...companies.map((company) => company.industryType).filter(Boolean),
  ])]
  const activeApplicationCount = applications.filter(
    (application) => !application.progressIsTerminal,
  ).length
  const status = mode === 'readonly'
    ? `最近同步：${formatTimestamp(lastSyncedAt)}`
    : '数据已保存'

  return (
    <main className="rt-main">
      <header className="rt-topbar">
        <nav className="rt-tabs" aria-label="主导航" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'applications'}
            className={activeTab === 'applications' ? 'is-active' : ''}
            onClick={() => onActiveTabChange('applications')}
          >
            岗位投递 <span>{activeApplicationCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recruitment'}
            className={activeTab === 'recruitment' ? 'is-active' : ''}
            onClick={() => onActiveTabChange('recruitment')}
          >
            招聘信息 <span>{companies.length}</span>
          </button>
        </nav>
        <div className="rt-topbar__actions">
          <span className={`rt-mode-badge ${mode === 'editable' ? 'is-editable' : ''}`}>
            {mode === 'readonly' ? '手机只读模式' : '电脑编辑模式'}
          </span>
          {headerActions}
        </div>
      </header>

      <div className="rt-shell">
        <section className="rt-page-head">
          <div>
            <h1>{activeTab === 'applications' ? '岗位投递' : '招聘信息'}</h1>
            <p>{activeTab === 'applications'
              ? '按公司聚合管理岗位投递，及时掌握下一步招聘进度。'
              : '集中查看公司招聘链接、行业类型与投递岗位数。'}</p>
          </div>
          {pageActions ? <div className="rt-page-head__actions">{pageActions}</div> : null}
        </section>

        <StatCards items={getStats(activeTab, companies, applications)} activeTab={activeTab} />

        {loading ? (
          <PageState type="loading" title="正在加载数据" description="请稍候。" />
        ) : error ? (
          <PageState type="error" title="数据加载失败" description={error} onRetry={onRetry} />
        ) : (
          <section className="rt-panel" aria-label={activeTab === 'applications' ? '岗位投递列表' : '招聘信息列表'}>
            <DashboardToolbar
              activeTab={activeTab}
              query={query}
              onQueryChange={onQueryChange}
              scope={scope}
              onScopeChange={onScopeChange}
              phase={phase}
              onPhaseChange={onPhaseChange}
              priority={priority}
              onPriorityChange={onPriorityChange}
              industryType={industryType}
              onIndustryTypeChange={onIndustryTypeChange}
              industries={industries}
              status={status}
            />
            {rows.length === 0 ? (
              <PageState type="empty" title="暂无匹配数据" description="可以调整搜索词或筛选条件后重试。" />
            ) : activeTab === 'applications' ? (
              <ApplicationCompanyList
                rows={rows}
                expandedCompanyIds={expandedCompanyIds}
                onToggleCompany={onToggleCompany}
                mode={mode}
                renderCompanyActions={renderCompanyActions}
                renderApplicationActions={renderApplicationActions}
                renderProgressAction={renderProgressAction}
              />
            ) : (
              <RecruitmentCompanyList
                rows={rows}
                mode={mode}
                renderCompanyActions={renderCompanyActions}
                renderCompanyField={renderCompanyField}
              />
            )}
          </section>
        )}
      </div>
    </main>
  )
}
