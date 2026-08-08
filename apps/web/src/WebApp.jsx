import { useCallback, useEffect, useState } from 'react'
import {
  APPLICATION_SCOPES,
  UnsupportedSchemaVersionError,
  validateCloudSnapshot,
} from '@recruitment-tracker/core'
import { DashboardView, PageState } from '@recruitment-tracker/ui'

function sessionUserId(session) {
  const user = session?.user
  return user?.id || user?.uid || session?.userId || session?.uid || session?.sub || null
}

function AuthShell({ children }) {
  return (
    <main className="rt-web-gate">
      <section className="rt-web-gate__card">
        <div className="rt-brand rt-web-gate__brand">
          <span className="rt-brand__mark" aria-hidden="true">RT</span>
          <div><strong>Recruitment Tracker</strong><span>PERSONAL JOB HUB</span></div>
        </div>
        {children}
      </section>
    </main>
  )
}

function LoginView({ error, busy, onSignIn }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  return (
    <AuthShell>
      <p className="rt-eyebrow">READONLY DASHBOARD</p>
      <h1>查看最近一次求职快照</h1>
      <p className="rt-web-gate__description">
        使用与电脑扩展相同的 CloudBase 个人账号登录。手机端只读，不会修改电脑本地数据。
      </p>
      <form
        className="rt-web-login"
        onSubmit={(event) => {
          event.preventDefault()
          void onSignIn(credentials)
        }}
      >
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}
        <label>
          <span>用户名</span>
          <input
            required
            autoComplete="username"
            value={credentials.username}
            onChange={(event) => setCredentials((current) => ({
              ...current,
              username: event.target.value,
            }))}
          />
        </label>
        <label>
          <span>密码</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) => setCredentials((current) => ({
              ...current,
              password: event.target.value,
            }))}
          />
        </label>
        <button className="rt-web-primary" type="submit" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="rt-web-gate__footnote">不提供注册、找回密码或手机端编辑入口。</p>
    </AuthShell>
  )
}

function SnapshotState({ title, description, actionLabel, onAction, onSignOut }) {
  return (
    <main className="rt-main">
      <div className="rt-shell">
        <header className="rt-topbar">
          <div className="rt-brand">
            <span className="rt-brand__mark" aria-hidden="true">RT</span>
            <div><strong>Recruitment Tracker</strong><span>PERSONAL JOB HUB</span></div>
          </div>
          <div className="rt-topbar__actions">
            <span className="rt-mode-badge">手机只读模式</span>
            <button className="rt-action-button is-secondary" type="button" onClick={onSignOut}>退出登录</button>
          </div>
        </header>
        <PageState
          type={onAction ? 'error' : 'empty'}
          title={title}
          description={description}
          actionLabel={actionLabel}
          onRetry={onAction}
        />
      </div>
    </main>
  )
}

export function WebApp({ authService, snapshotReader }) {
  const [auth, setAuth] = useState({ status: 'checking', session: null, error: '' })
  const [snapshot, setSnapshot] = useState({ status: 'idle', value: null, error: '' })
  const [activeTab, setActiveTab] = useState('applications')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(APPLICATION_SCOPES.ACTIVE)
  const [phase, setPhase] = useState(null)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState(new Set())

  const loadSnapshot = useCallback(async () => {
    setSnapshot({ status: 'loading', value: null, error: '' })
    try {
      const rawSnapshot = await snapshotReader.getSnapshot()
      if (!rawSnapshot) {
        setSnapshot({ status: 'empty', value: null, error: '' })
        return
      }
      const value = validateCloudSnapshot(rawSnapshot)
      setExpandedCompanyIds(new Set(value.data.companies[0]?.id ? [value.data.companies[0].id] : []))
      setSnapshot({ status: 'ready', value, error: '' })
    } catch (error) {
      if (error?.code === 'UNAUTHENTICATED') {
        setAuth({ status: 'signedOut', session: null, error: '登录已过期，请重新登录。' })
        setSnapshot({ status: 'idle', value: null, error: '' })
      } else if (error instanceof UnsupportedSchemaVersionError) {
        setSnapshot({
          status: 'unsupported',
          value: null,
          error: `云端快照版本 ${String(error.version)} 暂不支持，请先在电脑扩展中完成升级和同步。`,
        })
      } else {
        setSnapshot({
          status: 'error',
          value: null,
          error: error?.message || '读取云端快照失败',
        })
      }
    }
  }, [snapshotReader])

  const checkSession = useCallback(async () => {
    if (!authService || !snapshotReader) {
      setAuth({ status: 'error', session: null, error: 'CloudBase 只读服务未配置' })
      return
    }
    try {
      const session = await authService.getSession()
      if (!session || !sessionUserId(session)) {
        setAuth({ status: 'signedOut', session: null, error: '' })
        return
      }
      setAuth({ status: 'authenticated', session, error: '' })
      await loadSnapshot()
    } catch (error) {
      setAuth({
        status: 'signedOut',
        session: null,
        error: error?.message || '读取登录状态失败',
      })
    }
  }, [authService, loadSnapshot, snapshotReader])

  useEffect(() => {
    const timer = setTimeout(() => void checkSession(), 0)
    return () => clearTimeout(timer)
  }, [checkSession])

  async function signIn(credentials) {
    setAuth({ status: 'signingIn', session: null, error: '' })
    try {
      const result = await authService.signInWithPassword(credentials)
      setAuth({ status: 'authenticated', session: result.session, error: '' })
      await loadSnapshot()
    } catch (error) {
      setAuth({
        status: 'signedOut',
        session: null,
        error: error?.message || '登录失败，请检查账号和密码',
      })
    }
  }

  async function signOut() {
    try {
      await authService.signOut()
    } catch {
      // Local read access is closed even if the remote session cleanup fails.
    } finally {
      setSnapshot({ status: 'idle', value: null, error: '' })
      setAuth({ status: 'signedOut', session: null, error: '' })
    }
  }

  function toggleCompany(companyId) {
    setExpandedCompanyIds((current) => {
      const next = new Set(current)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  if (auth.status === 'checking') {
    return <AuthShell><PageState type="loading" title="正在检查登录状态" description="请稍候。" /></AuthShell>
  }
  if (auth.status !== 'authenticated') {
    return (
      <LoginView
        error={auth.error}
        busy={auth.status === 'signingIn'}
        onSignIn={signIn}
      />
    )
  }
  if (snapshot.status === 'loading' || snapshot.status === 'idle') {
    return (
      <SnapshotState
        title="正在读取云端快照"
        description="电脑本地数据不会被读取或修改。"
        onSignOut={() => void signOut()}
      />
    )
  }
  if (snapshot.status === 'empty') {
    return (
      <SnapshotState
        title="还没有可查看的快照"
        description="请先在电脑扩展中登录，并点击“立即同步”。"
        onSignOut={() => void signOut()}
      />
    )
  }
  if (snapshot.status === 'unsupported') {
    return (
      <SnapshotState
        title="快照版本不兼容"
        description={snapshot.error}
        actionLabel="重新读取"
        onAction={() => void loadSnapshot()}
        onSignOut={() => void signOut()}
      />
    )
  }
  if (snapshot.status === 'error') {
    return (
      <SnapshotState
        title="快照读取失败"
        description={snapshot.error}
        actionLabel="重试"
        onAction={() => void loadSnapshot()}
        onSignOut={() => void signOut()}
      />
    )
  }

  return (
    <DashboardView
      mode="readonly"
      companies={snapshot.value.data.companies}
      applications={snapshot.value.data.applications}
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
      lastSyncedAt={snapshot.value.updatedAt}
      headerActions={(
        <button className="rt-action-button is-secondary" type="button" onClick={() => void signOut()}>
          退出登录
        </button>
      )}
    />
  )
}
