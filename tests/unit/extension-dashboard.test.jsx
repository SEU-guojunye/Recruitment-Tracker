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
    today: '2026-08-09',
  })
}

async function addCompany(user, name = '极光科技') {
  await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
  await user.click(screen.getByRole('button', { name: '新增公司' }))
  await user.type(screen.getByLabelText('公司名称'), name)
  await user.type(
    screen.getByLabelText('公司招聘链接'),
    'https://example.com/careers',
  )
  await user.type(screen.getByLabelText('行业类型'), '互联网')
  await user.selectOptions(screen.getByLabelText('招聘批次'), '秋招提前批')
  await user.selectOptions(screen.getByLabelText('优先度'), 'P0')
  await user.click(screen.getByRole('button', { name: '保存' }))
  await screen.findByText('公司招聘信息已保存')
}

async function addApplication(user, location) {
  const companyRow = screen.getByText('极光科技').closest('.rt-recruitment-row')
  await user.click(within(companyRow).getByRole('button', { name: '投递' }))
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
    expect((await repository.getData()).companies).toEqual([{
      ...importedCompany,
      companyNotes: '',
    }])
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
    expect((await repository.getData()).companies[0]).toMatchObject({
      industryType: '互联网',
      recruitmentBatch: '秋招提前批',
      priority: 'P0',
      companyNotes: '',
    })
    await addApplication(user, '上海')
    await addApplication(user, '北京')
    await user.click(screen.getByRole('tab', { name: /岗位投递/u }))

    const firstCard = screen.getByText('投递记录 01').closest('.rt-application-card')
    await user.click(within(firstCard).getByRole('button', { name: '编辑投递' }))
    const applicationDialog = screen.getByRole('dialog', { name: '编辑投递信息' })
    const jobTitleInput = within(applicationDialog).getByLabelText('岗位名称')
    await user.type(jobTitleInput, '前端开发工程师')
    await user.click(within(applicationDialog).getByRole('button', { name: '保存投递' }))
    await screen.findByText('投递信息已更新')
    expect((await repository.getData()).applications).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobTitle: '前端开发工程师' }),
    ]))
    expect(screen.getByText('前端开发工程师')).toBeInTheDocument()

    expect(screen.getByText('前端开发工程师')).toBeInTheDocument()
    expect(screen.getByText('投递记录 02')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    const companyRow = screen.getByText('极光科技').closest('.rt-recruitment-row')
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
    expect((await repository.getEnvelope()).sync.localRevision).toBe(5)
  })

  it('deletes every application in a company while retaining the company record', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    let next = 0
    const idFactory = () => `batch-delete-${++next}`
    const company = createCompanyRecord(
      { id: 'company-batch-delete', companyName: '保留公司' },
      { idFactory, now: new Date('2026-08-08T10:00:00.000Z') },
    )
    const applicationOptions = {
      idFactory,
      now: new Date('2026-08-08T10:00:00.000Z'),
      today: '2026-08-09',
      companyIds: new Set([company.id]),
    }
    await repository.saveCompany(company)
    await repository.saveApplication(createApplication({
      id: 'application-batch-delete-1',
      companyId: company.id,
      jobTitle: '前端工程师',
    }, applicationOptions))
    await repository.saveApplication(createApplication({
      id: 'application-batch-delete-2',
      companyId: company.id,
      jobTitle: '后端工程师',
    }, applicationOptions))

    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    const companyHead = (await screen.findByText('保留公司')).closest('.rt-company-card__head')
    const deleteButton = within(companyHead).getByRole('button', { name: '删除' })
    expect(deleteButton).toHaveClass('is-delete')
    await user.click(deleteButton)

    const dialog = await screen.findByRole('dialog', { name: '删除全部投递' })
    expect(within(dialog).getByText('确定删除“保留公司”下的全部 2 条投递吗？')).toBeInTheDocument()
    expect(within(dialog).getByText('公司招聘信息将保留，此操作无法撤销。')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '继续删除' }))
    await user.type(within(dialog).getByLabelText(/再次确认/u), '保留公司')
    await user.click(within(dialog).getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('已删除“保留公司”的 2 条投递，公司招聘信息已保留')).toBeInTheDocument()
    expect(await repository.getData()).toEqual({ companies: [company], applications: [] })
    expect((await repository.getEnvelope()).sync.localRevision).toBe(4)
    expect(document.querySelectorAll('.rt-application-card')).toHaveLength(0)
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    expect(screen.getByText('保留公司')).toBeInTheDocument()
  })

  it('shows a repository error and does not close the form on failed save', async () => {
    const user = userEvent.setup()
    const storageArea = new FakeStorageArea()
    const repository = createRepository(storageArea)
    render(<DashboardApp repository={repository} />)
    await screen.findByText('电脑编辑模式')
    await waitFor(() => expect(screen.getByText(/本地占用/u)).toHaveTextContent('KB'))

    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    await user.click(screen.getByRole('button', { name: '新增公司' }))
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
    await user.click(screen.getByRole('tab', { name: /招聘信息/u }))
    const trigger = await screen.findByRole('button', { name: '新增公司' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps application actions in the detail row and edits only one workflow', async () => {
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
      today: '2026-08-09',
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
    expect(within(firstCard).queryByRole('combobox', { name: /快速更新当前环节/u }))
      .not.toBeInTheDocument()
    const actionCell = within(firstCard).getByText('操作').closest('.rt-application-cell--actions')
    expect(within(actionCell).getByRole('button', { name: '编辑投递' })).toBeInTheDocument()
    expect(within(actionCell).getByRole('button', { name: '删除' })).toBeInTheDocument()

    await user.click(within(firstCard).getByRole('button', { name: '编辑进度' }))
    const stageNoteFields = screen.getAllByRole('textbox', { name: /备注或面试链接/u })
    expect(stageNoteFields).toHaveLength(6)
    await user.type(
      stageNoteFields[0],
      '  提前准备系统设计{enter}https://meeting.example.com/round-1  ',
    )
    await user.click(screen.getByRole('button', { name: '＋ 添加环节' }))
    const notesAfterAdding = screen.getAllByRole('textbox', { name: /备注或面试链接/u })
    expect(notesAfterAdding).toHaveLength(7)
    expect(notesAfterAdding.at(-1)).toHaveValue('')
    await user.click(screen.getByRole('button', { name: '删除环节：新环节' }))
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
    expect(savedFirst.progressStages[0].note)
      .toBe('提前准备系统设计\nhttps://meeting.example.com/round-1')
    expect(savedFirst).toMatchObject({
      currentStageId: first.progressStages[2].id,
      progressStatus: '笔试',
      progressPhase: 'assessment',
      progressIsTerminal: false,
    })
    expect(untouchedSecond).toEqual(second)
  })
})
