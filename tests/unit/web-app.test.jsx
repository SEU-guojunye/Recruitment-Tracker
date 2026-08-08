import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WebApp } from '../../apps/web/src/WebApp.jsx'
import { READONLY_SNAPSHOT } from '../fixtures/readonly-snapshot.js'
import { describe, expect, it, vi } from 'vitest'

function authenticatedAuth(overrides = {}) {
  return {
    getSession: vi.fn().mockResolvedValue({ user: { id: 'readonly-user' } }),
    signInWithPassword: vi.fn().mockResolvedValue({
      session: { user: { id: 'readonly-user' } },
      userId: 'readonly-user',
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('readonly WebApp', () => {
  it('blocks snapshot reads until a real session exists, then logs in without registration', async () => {
    const user = userEvent.setup()
    const authService = authenticatedAuth({ getSession: vi.fn().mockResolvedValue(null) })
    const snapshotReader = { getSnapshot: vi.fn().mockResolvedValue(READONLY_SNAPSHOT) }
    render(<WebApp authService={authService} snapshotReader={snapshotReader} />)

    expect(await screen.findByRole('heading', { name: '查看最近一次求职快照' })).toBeInTheDocument()
    expect(snapshotReader.getSnapshot).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /注册/u })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('用户名'), 'personal-user')
    await user.type(screen.getByLabelText('密码'), 'temporary-password')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByText('手机只读模式')).toBeInTheDocument()
    expect(authService.signInWithPassword).toHaveBeenCalledWith({
      username: 'personal-user',
      password: 'temporary-password',
    })
    expect(snapshotReader.getSnapshot).toHaveBeenCalledOnce()
  })

  it('rejects an anonymous session before any snapshot read', async () => {
    const snapshotReader = { getSnapshot: vi.fn() }
    render(<WebApp
      authService={authenticatedAuth({
        getSession: vi.fn().mockResolvedValue({
          user: { id: 'anonymous-user', is_anonymous: true },
        }),
      })}
      snapshotReader={snapshotReader}
    />)
    expect(await screen.findByRole('heading', { name: '查看最近一次求职快照' })).toBeInTheDocument()
    expect(snapshotReader.getSnapshot).not.toHaveBeenCalled()
  })

  it('shows a dedicated no-snapshot state for an authenticated user', async () => {
    render(<WebApp
      authService={authenticatedAuth()}
      snapshotReader={{ getSnapshot: vi.fn().mockResolvedValue(null) }}
    />)
    expect(await screen.findByRole('heading', { name: '还没有可查看的快照' })).toBeInTheDocument()
    expect(screen.getByText(/请先在电脑扩展中登录/u)).toBeInTheDocument()
  })

  it('distinguishes unsupported versions from network errors and supports retry', async () => {
    const unsupportedReader = {
      getSnapshot: vi.fn().mockResolvedValue({ ...READONLY_SNAPSHOT, schemaVersion: 99 }),
    }
    const { unmount } = render(<WebApp
      authService={authenticatedAuth()}
      snapshotReader={unsupportedReader}
    />)
    expect(await screen.findByRole('heading', { name: '快照版本不兼容' })).toBeInTheDocument()
    unmount()

    const user = userEvent.setup()
    const getSnapshot = vi.fn()
      .mockRejectedValueOnce(new Error('模拟网络失败'))
      .mockResolvedValueOnce(READONLY_SNAPSHOT)
    render(<WebApp
      authService={authenticatedAuth()}
      snapshotReader={{ getSnapshot }}
    />)
    expect(await screen.findByRole('heading', { name: '快照读取失败' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('模拟网络失败')
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('手机只读模式')).toBeInTheDocument()
    expect(getSnapshot).toHaveBeenCalledTimes(2)
  })

  it('renders only browsing controls and expires back to login without stale data', async () => {
    const user = userEvent.setup()
    const authService = authenticatedAuth()
    render(<WebApp
      authService={authService}
      snapshotReader={{ getSnapshot: vi.fn().mockResolvedValue(READONLY_SNAPSHOT) }}
    />)
    expect(await screen.findByText('极光科技')).toBeInTheDocument()
    for (const name of ['新增投递', '导入 CSV', '导出 CSV', '编辑进度', '立即同步']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: '退出登录' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '查看最近一次求职快照' })).toBeInTheDocument()
    })
    expect(screen.queryByText('极光科技')).not.toBeInTheDocument()
    expect(authService.signOut).toHaveBeenCalledOnce()
  })

  it('returns to login when the snapshot reader reports an expired session', async () => {
    const error = new Error('session expired')
    error.code = 'UNAUTHENTICATED'
    render(<WebApp
      authService={authenticatedAuth()}
      snapshotReader={{ getSnapshot: vi.fn().mockRejectedValue(error) }}
    />)
    expect(await screen.findByRole('heading', { name: '查看最近一次求职快照' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('登录已过期')
  })
})
