import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PopupApp } from '../../apps/extension/src/popup/PopupApp.jsx'
import { DashboardApp } from '../../apps/extension/src/dashboard/DashboardApp.jsx'
import { WebApp } from '../../apps/web/src/WebApp.jsx'
import { READONLY_SNAPSHOT } from '../fixtures/readonly-snapshot.js'

describe('application entry points', () => {
  it('renders the focused popup surface', () => {
    render(<PopupApp />)
    expect(screen.getByRole('heading', { name: '保存招聘信息' })).toBeInTheDocument()
  })

  it('renders the editable extension dashboard surface', () => {
    render(<DashboardApp />)
    expect(screen.getByText('电脑编辑模式')).toBeInTheDocument()
  })

  it('renders the readonly web surface', async () => {
    render(<WebApp
      authService={{
        getSession: async () => ({ user: { id: 'readonly-user' } }),
        signOut: async () => {},
      }}
      snapshotReader={{ getSnapshot: async () => READONLY_SNAPSHOT }}
    />)
    expect(await screen.findByText('手机只读模式')).toBeInTheDocument()
  })
})
