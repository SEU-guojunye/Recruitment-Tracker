import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChromeLocalRepository } from '@recruitment-tracker/core'
import { DashboardApp } from '../../apps/extension/src/dashboard/DashboardApp.jsx'
import { describe, expect, it } from 'vitest'

class FakeStorageArea {
  constructor() {
    this.values = {}
    this.failNextSet = false
  }

  async get(key) {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}
  }

  async set(values) {
    if (this.failNextSet) {
      this.failNextSet = false
      throw new Error('模拟本地存储失败')
    }
    Object.assign(this.values, structuredClone(values))
  }
}

function createRepository(storageArea = new FakeStorageArea()) {
  let next = 0
  return new ChromeLocalRepository({
    storageArea,
    idFactory: () => `test-${++next}`,
    today: '2026-08-08',
  })
}

async function addCompany(user, name = '极光科技') {
  await user.click(screen.getByRole('button', { name: '＋ 招聘信息' }))
  await user.type(screen.getByLabelText('公司名称'), name)
  await user.type(
    screen.getByLabelText('公司招聘链接'),
    'https://example.com/careers',
  )
  await user.type(screen.getByLabelText('公司备注'), '重点关注校招')
  await user.click(screen.getByRole('button', { name: '保存' }))
  await screen.findByText('公司招聘信息已保存')
}

async function addApplication(user, location) {
  await user.click(screen.getByRole('button', { name: '＋ 新增投递' }))
  await user.type(screen.getByLabelText('工作地点'), location)
  await user.type(
    screen.getByLabelText('招聘投递链接'),
    `https://example.com/apply/${location}`,
  )
  await user.click(screen.getByRole('button', { name: '保存投递' }))
  await screen.findByText('投递记录已保存')
}

describe('editable extension dashboard', () => {
  it('completes company/application CRUD and two-step cascade deletion', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    await waitFor(() => expect(screen.getByText(/本地占用/u)).toHaveTextContent('KB'))

    await addCompany(user)
    expect(screen.getByText('公司招聘信息已保存')).toBeInTheDocument()
    await addApplication(user, '上海')
    await addApplication(user, '北京')

    expect(screen.getAllByText(/投递记录 0[12]/u)).toHaveLength(2)
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    const companyRow = screen.getByText('重点关注校招').closest('.rt-recruitment-row')
    await user.click(within(companyRow).getByRole('button', { name: '删除' }))

    expect(screen.getByText(/包含 2 条投递/u)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续删除' }))
    const confirmation = screen.getByLabelText(/再次确认/u)
    const finalDelete = screen.getByRole('button', { name: '确认删除' })
    expect(finalDelete).toBeDisabled()
    await user.type(confirmation, '极光科技')
    await user.click(finalDelete)

    await screen.findByText('公司及 2 条投递已删除')
    expect(await repository.getData()).toEqual({ companies: [], applications: [] })
    expect((await repository.getEnvelope()).sync.localRevision).toBe(4)
  })

  it('shows a repository error and does not close the form on failed save', async () => {
    const user = userEvent.setup()
    const storageArea = new FakeStorageArea()
    const repository = createRepository(storageArea)
    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    await waitFor(() => expect(screen.getByText(/本地占用/u)).toHaveTextContent('KB'))

    await user.click(screen.getByRole('button', { name: '＋ 招聘信息' }))
    await user.type(screen.getByLabelText('公司名称'), '失败公司')
    storageArea.failNextSet = true
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('模拟本地存储失败')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect((await repository.getData()).companies).toEqual([])
  })

  it('closes dialogs with Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DashboardApp repository={createRepository()} />)
    await screen.findByText('电脑编辑模式')
    const trigger = await screen.findByRole('button', { name: '＋ 招聘信息' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
