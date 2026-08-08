import { useId } from 'react'
import {
  APPLICATION_SCOPES,
  PROGRESS_PHASES,
  PROGRESS_PHASE_ORDER,
  filterApplicationCompanies,
  filterRecruitmentCompanies,
  getTimelineStates,
  selectApplicationStats,
  selectCompanyStats,
} from '@recruitment-tracker/core'

function formatDate(value) {
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

function linkLabel(value) {
  if (!value) return '未填写链接'
  try {
    return new URL(value).hostname.replace(/^www\./u, '')
  } catch {
    return value
  }
}

export function ExternalLink({ href, children, className = '' }) {
  if (!href) return <span className={className}>未填写</span>
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children} <span aria-hidden="true">↗</span>
    </a>
  )
}

export function PageState({ type, title, description, onRetry }) {
  const isError = type === 'error'
  return (
    <section
      className={`rt-page-state rt-page-state--${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="rt-page-state__icon" aria-hidden="true">
        {type === 'loading' ? '…' : isError ? '!' : '○'}
      </span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {isError && onRetry ? (
        <button className="rt-button rt-button--secondary" type="button" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </section>
  )
}

export function ProgressTimeline({ application }) {
  const states = getTimelineStates(application)
  return (
    <div className="rt-timeline-wrap">
      <ol
        className="rt-timeline"
        style={{ '--rt-step-count': states.length }}
        aria-label={`招聘进度：当前为${application.progressStatus}`}
      >
        {states.map((stage) => {
          const stateLabel = {
            completed: '已完成',
            current: '当前',
            upcoming: '未到达',
          }[stage.state]
          return (
            <li className={`rt-timeline__step is-${stage.state}`} key={stage.id}>
              <span className="rt-timeline__name">{stage.name}</span>
              <span className="rt-timeline__marker" aria-hidden="true" />
              <span className="rt-timeline__date">
                {formatDate(stage.date)}
              </span>
              <span className="rt-timeline__state">{stateLabel}</span>
            </li>
          )
        })}
      </ol>
      <p className="rt-timeline__summary">
        当前环节：<strong>{application.progressStatus}</strong>
        <span aria-hidden="true"> · </span>
        {formatDate(application.progressUpdatedDate)}
      </p>
    </div>
  )
}

function StatCards({ items }) {
  return (
    <section className="rt-stats" aria-label="数据概览">
      {items.map((item) => (
        <article className="rt-stat" key={item.label}>
          <div className="rt-stat__label">
            <span>{item.label}</span>
            <span className="rt-stat__icon" aria-hidden="true">{item.icon}</span>
          </div>
          <div className="rt-stat__value">
            {item.value} {item.unit ? <small>{item.unit}</small> : null}
          </div>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  )
}

function PhasePills({ counts }) {
  return (
    <div className="rt-phase-pills" aria-label="进度汇总">
      {PROGRESS_PHASE_ORDER.filter((phase) => counts[phase]).map((phase) => (
        <span className={`rt-phase-pill is-${phase}`} key={phase}>
          {PROGRESS_PHASES[phase].label} {counts[phase]}
        </span>
      ))}
    </div>
  )
}

function ApplicationCard({ application, index, mode, renderActions }) {
  return (
    <article className="rt-application-card">
      <div className="rt-application-card__top">
        <span className="rt-record-index">{String(index + 1).padStart(2, '0')}</span>
        <div className="rt-application-card__identity">
          <h4>投递记录 {String(index + 1).padStart(2, '0')}</h4>
          <ExternalLink href={application.applicationLink}>
            {linkLabel(application.applicationLink)}
          </ExternalLink>
          <span>{application.isReferral ? '内推' : '非内推'}</span>
        </div>
        <div className="rt-labelled-value">
          <span>工作地点</span>
          <strong>{application.workLocation || '未填写'}</strong>
        </div>
        <div className="rt-labelled-value">
          <span>当前环节</span>
          <strong>{application.progressStatus}</strong>
        </div>
        {mode === 'editable' && renderActions ? (
          <div className="rt-row-actions">{renderActions(application)}</div>
        ) : null}
      </div>
      <ProgressTimeline application={application} />
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
}) {
  return (
    <section className="rt-company-list" aria-label="投递公司列表">
      {rows.map((row) => {
        const expanded = expandedCompanyIds.has(row.company.id)
        const panelId = `rt-company-${row.company.id}`
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
                <span aria-hidden="true">›</span>
              </button>
              <div className="rt-company-identity">
                <span className="rt-company-logo" aria-hidden="true">
                  {row.company.companyName.slice(0, 1)}
                </span>
                <div>
                  <h3>{row.company.companyName}</h3>
                  <ExternalLink className="rt-company-link" href={row.company.recruitmentLink}>
                    {linkLabel(row.company.recruitmentLink)}
                  </ExternalLink>
                </div>
              </div>
              <div className="rt-labelled-value rt-company-card__metric">
                <span>投递数</span>
                <strong>{row.applicationCount} 条</strong>
              </div>
              <div className="rt-labelled-value rt-company-card__metric">
                <span>最近进度</span>
                <strong>{row.latestApplication?.progressStatus || '暂无'}</strong>
              </div>
              <div className="rt-company-card__summary">
                <span className="rt-field-label">进度汇总</span>
                <PhasePills counts={row.progressCounts} />
              </div>
              {mode === 'editable' && renderCompanyActions ? (
                <div className="rt-row-actions">{renderCompanyActions(row.company)}</div>
              ) : null}
            </div>
            {expanded ? (
              <div className="rt-company-card__details" id={panelId}>
                <p className="rt-detail-caption">
                  岗位投递 · {row.applications.length} 条
                </p>
                <div className="rt-application-list">
                  {row.applications.map((application, index) => (
                    <ApplicationCard
                      application={application}
                      index={index}
                      key={application.id}
                      mode={mode}
                      renderActions={renderApplicationActions}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}

function RecruitmentCompanyList({ rows, mode, renderCompanyActions }) {
  return (
    <section className="rt-recruitment-list" aria-label="招聘公司列表">
      <div className="rt-recruitment-list__head" aria-hidden="true">
        <span>公司</span><span>招聘链接</span><span>投递数</span>
        <span>最近进度</span><span>最近更新</span><span />
      </div>
      {rows.map((row) => (
        <article className="rt-recruitment-row" key={row.company.id}>
          <div className="rt-company-identity">
            <span className="rt-company-logo" aria-hidden="true">
              {row.company.companyName.slice(0, 1)}
            </span>
            <div>
              <h3>{row.company.companyName}</h3>
              <p>{row.company.companyNotes || '暂无公司备注'}</p>
            </div>
          </div>
          <div className="rt-mobile-field" data-label="招聘链接">
            <ExternalLink className="rt-company-link" href={row.company.recruitmentLink}>
              打开招聘入口
            </ExternalLink>
          </div>
          <div className="rt-mobile-field" data-label="关联投递">
            <span className="rt-count-badge">{row.applicationCount}</span>
          </div>
          <div className="rt-mobile-field" data-label="最近进度">
            <strong>{row.latestApplication?.progressStatus || '暂无'}</strong>
          </div>
          <div className="rt-mobile-field" data-label="最近更新">
            <span>{formatTimestamp(row.latestUpdatedAt)}</span>
          </div>
          {mode === 'editable' && renderCompanyActions ? (
            <div className="rt-row-actions">{renderCompanyActions(row.company)}</div>
          ) : <span />}
        </article>
      ))}
    </section>
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
}) {
  const searchId = useId()
  return (
    <div className="rt-toolbar">
      <label className="rt-search" htmlFor={searchId}>
        <span className="rt-sr-only">搜索</span>
        <span aria-hidden="true">⌕</span>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索公司、链接、地点或备注"
        />
      </label>
      {activeTab === 'applications' ? (
        <div className="rt-toolbar__filters">
          <label>
            <span>范围</span>
            <select value={scope} onChange={(event) => onScopeChange(event.target.value)}>
              <option value={APPLICATION_SCOPES.ACTIVE}>进行中</option>
              <option value={APPLICATION_SCOPES.ALL}>全部投递</option>
            </select>
          </label>
          <label>
            <span>阶段</span>
            <select value={phase || ''} onChange={(event) => onPhaseChange(event.target.value || null)}>
              <option value="">全部阶段</option>
              {PROGRESS_PHASE_ORDER.map((value) => (
                <option value={value} key={value}>{PROGRESS_PHASES[value].label}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  )
}

function getStats(activeTab, companies, applications) {
  if (activeTab === 'applications') {
    const stats = selectApplicationStats(companies, applications)
    return [
      { label: '进行中的公司', value: stats.activeCompanyCount, unit: '家公司', note: '至少一条非终态投递', icon: '⌁' },
      { label: '已投递岗位', value: stats.applicationCount, unit: '条记录', note: '全部已完成投递', icon: '✓' },
      { label: '面试中', value: stats.interviewApplicationCount, unit: '条记录', note: '当前处于面试阶段', icon: '◇' },
      { label: '最近更新', value: formatDate(stats.latestProgressUpdatedDate), note: '按进度更新时间', icon: '↻' },
    ]
  }
  const stats = selectCompanyStats(companies, applications)
  return [
    { label: '招聘公司', value: stats.companyCount, unit: '家公司', note: '全部招聘信息', icon: '⌂' },
    { label: '关联投递', value: stats.applicationCount, unit: '条记录', note: '公司下全部投递', icon: '↗' },
    { label: '进行中的公司', value: stats.activeCompanyCount, unit: '家公司', note: '至少一条非终态投递', icon: '⌁' },
    { label: '最近更新', value: formatTimestamp(stats.latestUpdatedAt), note: '公司与投递更新时间', icon: '↻' },
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
  expandedCompanyIds,
  onToggleCompany,
  loading = false,
  error = null,
  onRetry,
  lastSyncedAt = null,
  headerActions,
  renderCompanyActions,
  renderApplicationActions,
}) {
  const rows = activeTab === 'applications'
    ? filterApplicationCompanies(companies, applications, { scope, phase, query })
    : filterRecruitmentCompanies(companies, applications, { query })

  return (
    <main className="rt-main">
      <div className="rt-shell">
        <header className="rt-topbar">
          <div className="rt-brand">
            <span className="rt-brand__mark" aria-hidden="true">RT</span>
            <div><strong>Recruitment Tracker</strong><span>PERSONAL JOB HUB</span></div>
          </div>
          <div className="rt-topbar__actions">
            <span className={mode === 'readonly' ? 'rt-mode-badge' : 'rt-mode-badge is-editable'}>
              {mode === 'readonly' ? '手机只读模式' : '电脑编辑模式'}
            </span>
            {headerActions}
          </div>
        </header>

        <nav className="rt-tabs" aria-label="主导航" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recruitment'}
            className={activeTab === 'recruitment' ? 'is-active' : ''}
            onClick={() => onActiveTabChange('recruitment')}
          >
            招聘信息 <span>{companies.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'applications'}
            className={activeTab === 'applications' ? 'is-active' : ''}
            onClick={() => onActiveTabChange('applications')}
          >
            我的投递 <span>{applications.length}</span>
          </button>
        </nav>

        <section className="rt-page-head">
          <div>
            <p className="rt-eyebrow">{activeTab === 'applications' ? 'APPLICATION PIPELINE' : 'RECRUITMENT SOURCES'}</p>
            <h1>{activeTab === 'applications' ? '我的投递' : '招聘信息'}</h1>
            <p>{activeTab === 'applications' ? '按公司聚合查看每一条独立投递和招聘进度。' : '集中查看已保存的公司招聘入口与关联投递。'}</p>
          </div>
          {mode === 'readonly' ? (
            <p className="rt-sync-note">最近同步：{formatTimestamp(lastSyncedAt)}</p>
          ) : null}
        </section>

        <StatCards items={getStats(activeTab, companies, applications)} />

        {loading ? (
          <PageState type="loading" title="正在加载数据" description="请稍候。" />
        ) : error ? (
          <PageState type="error" title="数据加载失败" description={error} onRetry={onRetry} />
        ) : (
          <>
            <DashboardToolbar
              activeTab={activeTab}
              query={query}
              onQueryChange={onQueryChange}
              scope={scope}
              onScopeChange={onScopeChange}
              phase={phase}
              onPhaseChange={onPhaseChange}
            />
            {rows.length === 0 ? (
              <PageState
                type="empty"
                title="暂无匹配数据"
                description="可以调整搜索词或筛选条件后重试。"
              />
            ) : activeTab === 'applications' ? (
              <ApplicationCompanyList
                rows={rows}
                expandedCompanyIds={expandedCompanyIds}
                onToggleCompany={onToggleCompany}
                mode={mode}
                renderCompanyActions={renderCompanyActions}
                renderApplicationActions={renderApplicationActions}
              />
            ) : (
              <RecruitmentCompanyList
                rows={rows}
                mode={mode}
                renderCompanyActions={renderCompanyActions}
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}
