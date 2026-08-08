import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ChromeLocalRepository,
  createApplication,
  createCompanyRecord,
  serializeRecruitmentCsv,
} from '@recruitment-tracker/core'
import { DashboardApp } from '../../apps/extension/src/dashboard/DashboardApp.jsx'
import { describe, expect, it, vi } from 'vitest'

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
  it('exports a downloadable CSV from the editable header', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:recruitment-export')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    let downloadName = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloadName = this.download
    })

    render(<DashboardApp repository={createRepository()} />)
    await screen.findByText('电脑编辑模式')
    await user.click(screen.getByRole('button', { name: '导出 CSV' }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(downloadName).toMatch(/^recruitment-tracker-\d{4}-\d{2}-\d{2}\.csv$/u)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recruitment-export')
    expect(await screen.findByText('完整 CSV 已导出')).toBeInTheDocument()
    click.mockRestore()
  })

  it('previews and atomically imports a selected CSV after confirmation', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const importedCompany = createCompanyRecord({
      id: 'company-csv',
      companyName: 'CSV 导入公司',
      companyNotes: '由表格维护',
    }, { now: new Date('2026-08-08T10:00:00.000Z') })
    const csv = serializeRecruitmentCsv({ companies: [importedCompany], applications: [] })
    const file = new File([csv], 'recruitment.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: async () => csv })

    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    await user.upload(screen.getByLabelText('选择 CSV 文件'), file)

    const dialog = await screen.findByRole('dialog', { name: '导入 CSV' })
    expect(within(dialog).getByText('recruitment.csv', { exact: false })).toBeInTheDocument()
    expect(within(dialog).getByText('校验通过。', { exact: false })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '确认导入' }))

    expect(await screen.findByText(/CSV 导入成功：新增 1 条/u)).toBeInTheDocument()
    expect((await repository.getData()).companies).toEqual([importedCompany])
    expect((await repository.getEnvelope()).sync.localRevision).toBe(1)
  })

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

  it('quick switches and edits only one application workflow', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    let next = 0
    const idFactory = () => `domain-${++next}`
    const targetCompany = createCompanyRecord(
      { id: 'company-progress', companyName: '进度公司' },
      { idFactory, now: new Date('2026-08-08T10:00:00.000Z') },
    )
    const options = {
      idFactory,
      now: new Date('2026-08-08T10:00:00.000Z'),
      today: '2026-08-08',
      companyIds: new Set([targetCompany.id]),
    }
    const first = createApplication(
      { id: 'application-first', companyId: targetCompany.id },
      options,
    )
    const second = createApplication(
      { id: 'application-second', companyId: targetCompany.id },
      options,
    )
    await repository.saveCompany(targetCompany)
    await repository.saveApplication(first)
    await repository.saveApplication(second)

    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    await screen.findByText('进度公司')
    await user.click(screen.getByRole('button', { name: '展开进度公司' }))
    const firstCard = screen.getByText('投递记录 01').closest('.rt-application-card')
    const quickSelect = within(firstCard).getByRole('combobox', {
      name: /快速更新当前环节/u,
    })
    await user.selectOptions(quickSelect, first.progressStages[3].id)
    await screen.findByText('进度已切换为“技术一面”')
    await waitFor(async () => {
      const saved = (await repository.getData()).applications.find(
        (item) => item.id === first.id,
      )
      expect(saved).toMatchObject({
        progressStatus: '技术一面',
        progressPhase: 'interview',
        progressUpdatedDate: '2026-08-08',
      })
      expect(saved.progressStages[3].date).toBe('2026-08-08')
    })

    await user.click(within(firstCard).getByRole('button', { name: '编辑进度' }))
    await user.click(screen.getByRole('radio', { name: '设为当前环节：筛选' }))
    await user.click(screen.getByRole('button', { name: '删除环节：筛选' }))
    const saveButton = screen.getByRole('button', { name: '保存进度' })
    expect(saveButton).toBeDisabled()
    await user.click(screen.getByLabelText(/我确认已删除原当前环节/u))
    await user.click(saveButton)
    await screen.findByText('招聘进度流程已保存')

    const data = await repository.getData()
    const savedFirst = data.applications.find((item) => item.id === first.id)
    const untouchedSecond = data.applications.find((item) => item.id === second.id)
    expect(savedFirst.progressStages).toHaveLength(5)
    expect(savedFirst).toMatchObject({
      currentStageId: first.progressStages[2].id,
      progressStatus: '笔试',
      progressPhase: 'assessment',
      progressIsTerminal: false,
    })
    expect(untouchedSecond).toEqual(second)
  })
})
