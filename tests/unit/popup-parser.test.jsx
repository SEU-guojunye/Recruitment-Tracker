import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChromeLocalRepository, createCompanyRecord } from '@recruitment-tracker/core'
import { PopupApp } from '../../apps/extension/src/popup/PopupApp.jsx'
import { describe, expect, it, vi } from 'vitest'

class FakeStorageArea {
  constructor() {
    this.values = {}
  }

  async get(key) {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}
  }

  async set(values) {
    Object.assign(this.values, structuredClone(values))
  }
}

function createRepository() {
  let next = 0
  return new ChromeLocalRepository({
    storageArea: new FakeStorageArea(),
    idFactory: () => `popup-${++next}`,
    today: '2026-08-08',
  })
}

const reliablePage = {
  url: 'https://example.com/jobs/123',
  title: '工程师职位',
  meta: {},
  jsonLd: [JSON.stringify({
    '@type': 'JobPosting',
    hiringOrganization: { name: '示例科技' },
  })],
  visibleText: '工作地点：上海',
}

describe('Popup company-only capture', () => {
  it('parses and saves only a company while keeping applications empty', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(
      <PopupApp
        repository={repository}
        collectPage={vi.fn().mockResolvedValue(reliablePage)}
        openDashboard={vi.fn()}
      />,
    )

    expect(await screen.findByDisplayValue('示例科技')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com/jobs/123')).toBeInTheDocument()
    expect(screen.queryByLabelText(/投递时间|工作地点|招聘进度|内推/u)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('公司备注'), '关注校招')
    await user.click(screen.getByRole('button', { name: '保存招聘信息' }))
    await screen.findByText(/招聘信息已保存到本地/u)

    const envelope = await repository.getEnvelope()
    expect(envelope.data.companies).toHaveLength(1)
    expect(envelope.data.companies[0]).toMatchObject({
      companyName: '示例科技',
      companyNotes: '关注校招',
    })
    expect(envelope.data.applications).toEqual([])
    expect(envelope.sync).toMatchObject({ localRevision: 1, dirty: true })
  })

  it('keeps the manual form usable when page parsing fails', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(
      <PopupApp
        repository={repository}
        collectPage={vi.fn().mockRejectedValue(new Error('当前页面不可访问'))}
        openDashboard={vi.fn()}
      />,
    )
    expect(await screen.findByText('当前页面不可访问')).toBeInTheDocument()
    await user.type(screen.getByLabelText('公司名称'), '手动公司')
    await user.click(screen.getByRole('button', { name: '保存招聘信息' }))
    await screen.findByText(/招聘信息已保存到本地/u)
    expect((await repository.getData()).companies[0].companyName).toBe('手动公司')
  })

  it('offers explicit update/duplicate choices for a normalized name match', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const existing = createCompanyRecord(
      { id: 'company-existing', companyName: '示例科技', recruitmentLink: 'https://old.example.com' },
      { now: new Date('2026-08-08T00:00:00.000Z') },
    )
    await repository.saveCompany(existing)
    render(
      <PopupApp
        repository={repository}
        collectPage={vi.fn().mockResolvedValue(reliablePage)}
        openDashboard={vi.fn()}
      />,
    )
    await screen.findByDisplayValue('示例科技')
    await user.click(screen.getByRole('button', { name: '保存招聘信息' }))
    expect(await screen.findByText(/发现同名候选/u)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '更新已有公司' }))
    await waitFor(async () => {
      const data = await repository.getData()
      expect(data.companies).toHaveLength(1)
      expect(data.companies[0].recruitmentLink).toBe('https://example.com/jobs/123')
    })
  })

  it('opens the dedicated Dashboard entry', async () => {
    const user = userEvent.setup()
    const openDashboard = vi.fn().mockResolvedValue(undefined)
    render(
      <PopupApp
        repository={createRepository()}
        collectPage={vi.fn().mockResolvedValue(reliablePage)}
        openDashboard={openDashboard}
      />,
    )
    await screen.findByDisplayValue('示例科技')
    await user.click(screen.getByRole('button', { name: /打开 Dashboard/u }))
    expect(openDashboard).toHaveBeenCalledOnce()
  })
})
