import { useState } from 'react'
import { Dialog, FormField } from '@recruitment-tracker/ui'
import { SYNC_STATUS_LABELS } from './sync-status.js'

function formatTimestamp(value) {
  if (!value) return '尚未同步'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function SyncAccountDialog({
  session,
  envelope,
  onSignIn,
  onSignOut,
  onSync,
  onTakeover,
  onClearAndRebind,
  onExport,
  onClose,
}) {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exported, setExported] = useState(false)
  const [takeoverConfirmed, setTakeoverConfirmed] = useState(false)
  const [rebindConfirmation, setRebindConfirmation] = useState('')
  const status = envelope.sync.status

  async function run(operation) {
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (caught) {
      setError(caught?.message || '同步操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function exportFirst() {
    const succeeded = await onExport()
    if (succeeded) setExported(true)
  }

  return (
    <Dialog
      open
      title="CloudBase 账号与同步"
      description="电脑本地数据始终是唯一可编辑主数据源，云端只保存手机查看用的完整快照。"
      onClose={onClose}
    >
      <div className="rt-form rt-sync-panel">
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}

        {!session ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(() => onSignIn(credentials))
            }}
          >
            <p className="rt-form-help">使用 CloudBase 管理端预先创建的个人账号登录；此处不提供注册或找回密码。</p>
            <div className="rt-form-grid">
              <FormField label="用户名" full>
                <input
                  data-autofocus
                  required
                  autoComplete="username"
                  value={credentials.username}
                  onChange={(event) => setCredentials((current) => ({
                    ...current,
                    username: event.target.value,
                  }))}
                />
              </FormField>
              <FormField label="密码" full>
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
              </FormField>
            </div>
            <div className="rt-form-actions">
              <button className="rt-action-button is-secondary" type="button" onClick={onClose}>取消</button>
              <button className="rt-action-button" type="submit" disabled={busy}>
                {busy ? '登录中…' : '登录并同步'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="rt-sync-account-summary">
              <div><span>当前账号</span><strong>{session.userId}</strong></div>
              <div><span>同步状态</span><strong>{SYNC_STATUS_LABELS[status] || status}</strong></div>
              <div><span>本地修订</span><strong>{envelope.sync.localRevision}</strong></div>
              <div><span>最近同步</span><strong>{formatTimestamp(envelope.sync.lastSyncedAt)}</strong></div>
            </div>

            {envelope.sync.lastError?.message ? (
              <p className="rt-form-error" role="alert">{envelope.sync.lastError.message}</p>
            ) : null}

            {status === 'accountMismatch' ? (
              <section className="rt-sync-conflict">
                <h3>本地数据属于另一个账号</h3>
                <p>已阻止上传，避免把原账号数据覆盖到当前账号。可以退出后使用原账号，或先导出本地数据，再清空并绑定当前账号。</p>
                <button className="rt-action-button is-secondary" type="button" onClick={() => void exportFirst()}>
                  {exported ? '✓ 已导出本地 CSV' : '先导出本地 CSV'}
                </button>
                <FormField label="确认清空：请输入“清空并重新绑定”" full>
                  <input
                    value={rebindConfirmation}
                    onChange={(event) => setRebindConfirmation(event.target.value)}
                  />
                </FormField>
                <button
                  className="rt-action-button is-danger"
                  type="button"
                  disabled={busy || !exported || rebindConfirmation !== '清空并重新绑定'}
                  onClick={() => void run(onClearAndRebind)}
                >
                  清空本地数据并绑定当前账号
                </button>
              </section>
            ) : null}

            {status === 'deviceConflict' ? (
              <section className="rt-sync-conflict">
                <h3>云端快照来自另一台电脑</h3>
                <p>系统不会合并或下载云端数据。若以本机接管，当前完整本地数据会覆盖云端快照。</p>
                <button className="rt-action-button is-secondary" type="button" onClick={() => void exportFirst()}>
                  {exported ? '✓ 已导出本机 CSV' : '先导出本机 CSV'}
                </button>
                <label className="rt-checkbox-field">
                  <input
                    type="checkbox"
                    checked={takeoverConfirmed}
                    onChange={(event) => setTakeoverConfirmed(event.target.checked)}
                  />
                  我确认云端不会合并或恢复到本机，并以本机数据覆盖云端
                </label>
                <button
                  className="rt-action-button is-danger"
                  type="button"
                  disabled={busy || !exported || !takeoverConfirmed}
                  onClick={() => void run(onTakeover)}
                >
                  确认以本机接管
                </button>
              </section>
            ) : null}

            <div className="rt-form-actions">
              <button className="rt-action-button is-secondary" type="button" disabled={busy} onClick={() => void run(onSignOut)}>
                {status === 'accountMismatch'
                  ? '退出并使用原账号'
                  : status === 'deviceConflict'
                    ? '退出并回到原编辑设备'
                    : '退出并保留本地数据'}
              </button>
              {!['accountMismatch', 'deviceConflict'].includes(status) ? (
                <button className="rt-action-button" type="button" disabled={busy || status === 'syncing'} onClick={() => void run(onSync)}>
                  {busy || status === 'syncing' ? '同步中…' : status === 'failed' ? '重试同步' : '立即同步'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
