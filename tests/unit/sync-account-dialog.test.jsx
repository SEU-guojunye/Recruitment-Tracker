import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncAccountDialog } from '../../apps/extension/src/dashboard/SyncAccountDialog.jsx'
import { describe, expect, it, vi } from 'vitest'

function envelope(status, overrides = {}) {
  return {
    settings: { boundUserId: 'user-a', deviceId: 'device-a' },
    sync: {
      status,
      localRevision: 3,
      lastSyncedRevision: 2,
      lastSyncedAt: '2026-08-08T10:00:00.000Z',
      lastError: null,
      dirty: status !== 'synced',
      ...overrides,
    },
  }
}

function props(overrides = {}) {
  return {
    session: { userId: 'user-a' },
    envelope: envelope('dirty'),
    onSignIn: vi.fn().mockResolvedValue(undefined),
    onSignOut: vi.fn().mockResolvedValue(undefined),
    onSync: vi.fn().mockResolvedValue(undefined),
    onTakeover: vi.fn().mockResolvedValue(undefined),
    onClearAndRebind: vi.fn().mockResolvedValue(undefined),
    onExport: vi.fn().mockResolvedValue(true),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('SyncAccountDialog', () => {
  it('offers password login without registration and passes credentials transiently', async () => {
    const user = userEvent.setup()
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    render(<SyncAccountDialog {...props({ session: null, onSignIn })} />)

    expect(screen.queryByRole('button', { name: /注册/u })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('用户名'), 'personal-user')
    await user.type(screen.getByLabelText('密码'), 'temporary-password')
    await user.click(screen.getByRole('button', { name: '登录并同步' }))
    expect(onSignIn).toHaveBeenCalledWith({
      username: 'personal-user',
      password: 'temporary-password',
    })
  })

  it('requires a successful export and exact phrase before clearing an account mismatch', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(true)
    const onClearAndRebind = vi.fn().mockResolvedValue(undefined)
    render(<SyncAccountDialog {...props({
      envelope: envelope('accountMismatch'),
      onExport,
      onClearAndRebind,
    })} />)

    const clear = screen.getByRole('button', { name: '清空本地数据并绑定当前账号' })
    expect(clear).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '先导出本地 CSV' }))
    await user.type(screen.getByLabelText(/确认清空/u), '清空并重新绑定')
    expect(clear).toBeEnabled()
    await user.click(clear)
    expect(onExport).toHaveBeenCalledOnce()
    expect(onClearAndRebind).toHaveBeenCalledOnce()
  })

  it('requires export and an explicit warning acknowledgement before device takeover', async () => {
    const user = userEvent.setup()
    const onTakeover = vi.fn().mockResolvedValue(undefined)
    render(<SyncAccountDialog {...props({
      envelope: envelope('deviceConflict'),
      onTakeover,
    })} />)

    const takeover = screen.getByRole('button', { name: '确认以本机接管' })
    expect(takeover).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '先导出本机 CSV' }))
    await user.click(screen.getByLabelText(/我确认云端不会合并/u))
    expect(takeover).toBeEnabled()
    await user.click(takeover)
    expect(onTakeover).toHaveBeenCalledOnce()
  })

  it('keeps sign-out separate from local data and exposes retry after failure', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    const onSync = vi.fn().mockResolvedValue(undefined)
    render(<SyncAccountDialog {...props({
      envelope: envelope('failed', {
        lastError: { code: 'NETWORK', message: '网络失败' },
      }),
      onSignOut,
      onSync,
    })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('网络失败')
    await user.click(screen.getByRole('button', { name: '重试同步' }))
    expect(onSync).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '退出并保留本地数据' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
