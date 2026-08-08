import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  APPLICATION_SCOPES,
  ApplicationService,
  ChromeLocalRepository,
  CompanyNameConflictError,
  CompanyService,
  CsvImportExportService,
  DomainValidationError,
  toLocalDate,
} from '@recruitment-tracker/core'
import {
  DashboardView,
  Dialog,
  FormField,
  PageState,
} from '@recruitment-tracker/ui'
import { ProgressEditorDialog } from './ProgressEditorDialog.jsx'
import { CsvImportDialog } from './CsvImportDialog.jsx'
import { SyncAccountDialog } from './SyncAccountDialog.jsx'
import { SYNC_STATUS_LABELS } from './sync-status.js'
import { ExtensionSyncClient } from '../cloudbase/runtime-client.js'

let defaultRepository
let defaultSyncClient

function getDefaultRepository() {
  if (defaultRepository) return defaultRepository
  if (!globalThis.chrome?.storage?.local) return null
  defaultRepository = new ChromeLocalRepository()
  return defaultRepository
}

function getDefaultSyncClient() {
  if (defaultSyncClient) return defaultSyncClient
  if (!globalThis.chrome?.runtime?.sendMessage) return null
  defaultSyncClient = new ExtensionSyncClient()
  return defaultSyncClient
}

function readableError(error) {
  if (error instanceof DomainValidationError) return error.errors[0]?.message || error.message
  return error?.message || '操作失败，请重试'
}

function CompanyDialog({ open, company, companyService, onSaved, onClose }) {
  const [values, setValues] = useState(() => ({
    companyName: company?.companyName || '',
    recruitmentLink: company?.recruitmentLink || '',
    companyNotes: company?.companyNotes || '',
  }))
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(null)
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function save(options = {}) {
    setSaving(true)
    setError('')
    try {
      let saved
      if (options.updateCandidateId) {
        saved = await companyService.update(options.updateCandidateId, values)
      } else if (company) {
        saved = await companyService.update(company.id, values, {
          allowDuplicate: options.allowDuplicate,
        })
      } else {
        saved = await companyService.create(values, {
          allowDuplicate: options.allowDuplicate,
        })
      }
      await onSaved(saved)
    } catch (caught) {
      if (caught instanceof CompanyNameConflictError) {
        setConflict(caught)
        setError(caught.message)
      } else {
        setError(readableError(caught))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={company ? '编辑公司招聘信息' : '保存招聘信息'}
      description="公司信息与具体投递相互独立，更新招聘链接不会修改投递。"
      onClose={onClose}
    >
      <form
        className="rt-form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {error ? (
          <div className="rt-form-error" role="alert">
            {error}
            {conflict ? (
              <div className="rt-form-actions">
                {!company && conflict.candidates[0] ? (
                  <button
                    className="rt-action-button is-secondary"
                    type="button"
                    onClick={() => void save({ updateCandidateId: conflict.candidates[0].id })}
                  >
                    更新“{conflict.candidates[0].companyName}”
                  </button>
                ) : null}
                <button
                  className="rt-action-button"
                  type="button"
                  onClick={() => void save({ allowDuplicate: true })}
                >
                  仍然{company ? '保存' : '创建'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="rt-form-grid">
          <FormField label="公司名称" full>
            <input
              data-autofocus
              required
              maxLength={120}
              value={values.companyName}
              onChange={(event) => update('companyName', event.target.value)}
            />
          </FormField>
          <FormField label="公司招聘链接" full>
            <input
              type="url"
              maxLength={2048}
              placeholder="https://example.com/careers"
              value={values.recruitmentLink}
              onChange={(event) => update('recruitmentLink', event.target.value)}
            />
          </FormField>
          <FormField label="公司备注" full>
            <textarea
              maxLength={5000}
              value={values.companyNotes}
              onChange={(event) => update('companyNotes', event.target.value)}
            />
          </FormField>
        </div>
        <div className="rt-form-actions">
          <button className="rt-action-button is-secondary" type="button" onClick={onClose}>取消</button>
          <button className="rt-action-button" type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ApplicationDialog({
  open,
  application,
  initialCompanyId,
  companies,
  applicationService,
  onSaved,
  onClose,
}) {
  const today = toLocalDate()
  const [values, setValues] = useState(() => ({
    companyId: application?.companyId || initialCompanyId || companies[0]?.id || '',
    jobTitle: application?.jobTitle || '',
    applicationLink: application?.applicationLink || '',
    workLocation: application?.workLocation || '',
    statusLink: application?.statusLink || '',
    appliedDate: application?.appliedDate || toLocalDate(),
    isReferral: application?.isReferral || false,
    referralCode: application?.referralCode || '',
    applicationNotes: application?.applicationNotes || '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const saved = application
        ? await applicationService.update(application.id, values)
        : await applicationService.create(values)
      await onSaved(saved)
    } catch (caught) {
      setError(readableError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={application ? '编辑投递信息' : '新增岗位投递'}
      description="投递记录由你手动维护；新记录默认从“已投递”开始。"
      onClose={onClose}
    >
      <form
        className="rt-form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}
        <div className="rt-form-grid">
          <FormField label="岗位名称" full>
            <input
              data-autofocus
              maxLength={200}
              placeholder="例如：前端开发工程师"
              value={values.jobTitle}
              onChange={(event) => update('jobTitle', event.target.value)}
            />
          </FormField>
          <FormField label="投递公司" full>
            <select
              required
              value={values.companyId}
              onChange={(event) => update('companyId', event.target.value)}
            >
              {companies.map((item) => (
                <option key={item.id} value={item.id}>{item.companyName}</option>
              ))}
            </select>
          </FormField>
          <FormField label="招聘投递链接" full>
            <input
              type="url"
              maxLength={2048}
              placeholder="https://example.com/apply"
              value={values.applicationLink}
              onChange={(event) => update('applicationLink', event.target.value)}
            />
          </FormField>
          <FormField label="工作地点">
            <input
              maxLength={200}
              value={values.workLocation}
              onChange={(event) => update('workLocation', event.target.value)}
            />
          </FormField>
          <FormField label="投递时间">
            <input
              required
              type="date"
              max={today}
              value={values.appliedDate}
              onChange={(event) => update('appliedDate', event.target.value)}
            />
          </FormField>
          <FormField label="查看投递状态页面" full>
            <input
              type="url"
              maxLength={2048}
              value={values.statusLink}
              onChange={(event) => update('statusLink', event.target.value)}
            />
          </FormField>
          <FormField label="内推">
            <span className="rt-checkbox-field">
              <input
                type="checkbox"
                checked={values.isReferral}
                onChange={(event) => update('isReferral', event.target.checked)}
              />
              使用内推
            </span>
          </FormField>
          <FormField label="内推码">
            <input
              maxLength={200}
              disabled={!values.isReferral}
              value={values.isReferral ? values.referralCode : ''}
              onChange={(event) => update('referralCode', event.target.value)}
            />
          </FormField>
          <FormField label="投递备注" full>
            <textarea
              maxLength={5000}
              value={values.applicationNotes}
              onChange={(event) => update('applicationNotes', event.target.value)}
            />
          </FormField>
        </div>
        <p className="rt-form-help">当前进度：{application?.progressStatus || '已投递'}。详细流程在保存后通过“编辑进度”维护。</p>
        <div className="rt-form-actions">
          <button className="rt-action-button is-secondary" type="button" onClick={onClose}>取消</button>
          <button className="rt-action-button" type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存投递'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteDialog({ target, onConfirm, onClose }) {
  const [step, setStep] = useState(1)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const companyName = target?.record?.companyName
  const requiresSecondStep = target?.type === 'company' && target.applicationCount > 0

  async function remove() {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(target)
    } catch (caught) {
      setError(readableError(caught))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      title={target?.type === 'company' ? '删除公司' : '删除投递'}
      description="删除操作会立即写入本地数据，无法从云端恢复。"
      onClose={onClose}
    >
      <div className="rt-form">
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}
        {target?.type === 'company' ? (
          <>
            <p>确定删除“{companyName}”吗？</p>
            {requiresSecondStep ? (
              <p className="rt-form-error">
                该公司包含 {target.applicationCount} 条投递，确认后会在同一次本地写入中全部级联删除。
              </p>
            ) : null}
          </>
        ) : <p>确定只删除当前投递记录吗？其他投递不会受影响。</p>}

        {requiresSecondStep && step === 2 ? (
          <FormField label={`再次确认：请输入公司名称“${companyName}”`} full>
            <input
              data-autofocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
        ) : null}

        <div className="rt-form-actions">
          <button className="rt-action-button is-secondary" type="button" onClick={onClose}>取消</button>
          {requiresSecondStep && step === 1 ? (
            <button className="rt-action-button is-danger" type="button" onClick={() => setStep(2)}>
              继续删除
            </button>
          ) : (
            <button
              className="rt-action-button is-danger"
              type="button"
              disabled={deleting || (requiresSecondStep && confirmation !== companyName)}
              onClick={() => void remove()}
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

export function DashboardApp({
  repository: repositoryProp,
  syncClient: syncClientProp,
}) {
  const repository = useMemo(
    () => repositoryProp || getDefaultRepository(),
    [repositoryProp],
  )
  const companyService = useMemo(
    () => repository ? new CompanyService(repository) : null,
    [repository],
  )
  const applicationService = useMemo(
    () => repository ? new ApplicationService(repository) : null,
    [repository],
  )
  const csvService = useMemo(
    () => repository ? new CsvImportExportService(repository) : null,
    [repository],
  )
  const syncClient = useMemo(
    () => syncClientProp || getDefaultSyncClient(),
    [syncClientProp],
  )
  const csvFileInputRef = useRef(null)
  const [envelope, setEnvelope] = useState(null)
  const [capacity, setCapacity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('applications')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(APPLICATION_SCOPES.ACTIVE)
  const [phase, setPhase] = useState(null)
  const [expandedCompanyIds, setExpandedCompanyIds] = useState(new Set())
  const [companyEditor, setCompanyEditor] = useState(null)
  const [applicationEditor, setApplicationEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [progressEditor, setProgressEditor] = useState(null)
  const [quickProgressId, setQuickProgressId] = useState(null)
  const [csvImport, setCsvImport] = useState(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const [syncSession, setSyncSession] = useState(null)
  const [syncPanelOpen, setSyncPanelOpen] = useState(false)
  const [syncLoadError, setSyncLoadError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (!repository) {
      setLoadError('当前页面无法访问扩展本地存储，请从已安装的扩展打开 Dashboard。')
      setLoading(false)
      return
    }
    if (showLoading) setLoading(true)
    setLoadError('')
    try {
      const [nextEnvelope, nextCapacity] = await Promise.all([
        repository.getEnvelope(),
        repository.getCapacity(),
      ])
      setEnvelope(nextEnvelope)
      setCapacity(nextCapacity)
      setActiveTab(nextEnvelope.settings.activeTab)
    } catch (error) {
      setLoadError(readableError(error))
    } finally {
      setLoading(false)
    }
  }, [repository])

  const loadSyncState = useCallback(async () => {
    if (!syncClient) return
    setSyncLoadError('')
    try {
      const state = await syncClient.getSession()
      setSyncSession(state.session)
      await load({ showLoading: false })
    } catch (error) {
      setSyncLoadError(readableError(error))
    }
  }, [load, syncClient])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!syncClient) return undefined
    const timer = setTimeout(() => void loadSyncState(), 0)
    return () => clearTimeout(timer)
  }, [loadSyncState, syncClient])

  useEffect(() => {
    if (!globalThis.chrome?.storage?.onChanged) return undefined
    const onChanged = (changes, areaName) => {
      if (areaName === 'local' && changes.recruitmentTrackerEnvelope) {
        void load({ showLoading: false })
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [load])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  async function reloadAfterWrite(message) {
    await load({ showLoading: false })
    setCompanyEditor(null)
    setApplicationEditor(null)
    setDeleteTarget(null)
    setProgressEditor(null)
    setToast(message)
  }

  async function changeTab(tab) {
    setActiveTab(tab)
    if (!repository) return
    try {
      await repository.setActiveTab(tab)
    } catch (error) {
      setToast(`标签偏好保存失败：${readableError(error)}`)
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

  function openCompanyDelete(company) {
    const applicationCount = envelope.data.applications.filter(
      (application) => application.companyId === company.id,
    ).length
    setDeleteTarget({ type: 'company', record: company, applicationCount })
  }

  function showCompanyApplications(company) {
    setQuery(company.companyName)
    setScope(APPLICATION_SCOPES.ALL)
    setExpandedCompanyIds((current) => new Set(current).add(company.id))
    void changeTab('applications')
  }

  async function confirmDelete(target) {
    if (target.type === 'company') {
      const result = await companyService.delete(target.record.id)
      await reloadAfterWrite(
        result.deletedApplications
          ? `公司及 ${result.deletedApplications} 条投递已删除`
          : '公司已删除',
      )
    } else {
      await applicationService.delete(target.record.id)
      await reloadAfterWrite('投递已删除')
    }
  }

  async function quickSwitchProgress(application, stageId) {
    setQuickProgressId(application.id)
    try {
      await applicationService.switchProgress(application.id, stageId)
      await reloadAfterWrite(`进度已切换为“${application.progressStages.find((stage) => stage.id === stageId)?.name}”`)
    } catch (error) {
      setToast(`进度更新失败：${readableError(error)}`)
    } finally {
      setQuickProgressId(null)
    }
  }

  async function exportCsv() {
    setCsvBusy(true)
    try {
      const csv = await csvService.exportCsv()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `recruitment-tracker-${toLocalDate()}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      setToast('完整 CSV 已导出')
      return true
    } catch (error) {
      setToast(`CSV 导出失败：${readableError(error)}`)
      return false
    } finally {
      setCsvBusy(false)
    }
  }

  async function signInForSync(credentials) {
    const result = await syncClient.signIn(credentials)
    setSyncSession(result.session)
    await load({ showLoading: false })
    setToast(result.sync.status === 'synced' ? '登录并同步成功' : '登录成功，请处理同步状态')
  }

  async function signOutFromSync() {
    await syncClient.signOut()
    setSyncSession(null)
    await load({ showLoading: false })
    setToast('已退出登录，本地数据仍保留')
  }

  async function syncNow() {
    const result = await syncClient.syncNow()
    await load({ showLoading: false })
    setToast(result.sync.status === 'synced' ? '云端快照已更新' : '同步未完成，请查看状态')
  }

  async function takeOverDevice() {
    const result = await syncClient.takeOverDevice()
    await load({ showLoading: false })
    setToast(result.sync.status === 'synced' ? '本机已接管云端快照' : '接管未完成，请查看状态')
  }

  async function clearAndRebind() {
    const result = await syncClient.clearAndRebind()
    await load({ showLoading: false })
    setToast(result.sync.status === 'synced' ? '本地数据已清空并重新绑定' : '已重新绑定，请查看同步状态')
  }

  async function chooseCsvFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCsvBusy(true)
    try {
      const sourceText = await file.text()
      const initialPreview = await csvService.previewImport(sourceText)
      setCsvImport({ fileName: file.name, sourceText, initialPreview })
    } catch (error) {
      setToast(`CSV 读取失败：${readableError(error)}`)
    } finally {
      setCsvBusy(false)
    }
  }

  if (!repository && !loading) {
    return (
      <main className="rt-main">
        <PageState type="error" title="扩展存储不可用" description={loadError} />
      </main>
    )
  }

  const companies = envelope?.data.companies || []
  const applications = envelope?.data.applications || []
  const capacityLabel = capacity
    ? `${Math.max(1, Math.ceil(capacity.bytes / 1024))} KB / ${Math.round(capacity.limit / 1024 / 1024)} MB`
    : '计算中…'

  return (
    <>
      <DashboardView
        mode="editable"
        companies={companies}
        applications={applications}
        activeTab={activeTab}
        onActiveTabChange={(tab) => void changeTab(tab)}
        query={query}
        onQueryChange={setQuery}
        scope={scope}
        onScopeChange={setScope}
        phase={phase}
        onPhaseChange={setPhase}
        expandedCompanyIds={expandedCompanyIds}
        onToggleCompany={toggleCompany}
        loading={loading}
        error={loadError || null}
        onRetry={() => void load()}
        headerActions={(
          <>
            <label className="rt-sr-only" htmlFor="csv-file-input">选择 CSV 文件</label>
            <input
              ref={csvFileInputRef}
              className="rt-sr-only"
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void chooseCsvFile(event)}
            />
            <button
              className="rt-action-button is-secondary"
              type="button"
              disabled={csvBusy}
              onClick={() => csvFileInputRef.current?.click()}
            >
              导入 CSV
            </button>
            <button
              className="rt-action-button is-secondary"
              type="button"
              disabled={csvBusy}
              onClick={() => void exportCsv()}
            >
              导出 CSV
            </button>
            {syncClient ? (
              <button
                className={`rt-sync-status is-${envelope?.sync.status || 'idle'}`}
                type="button"
                onClick={() => setSyncPanelOpen(true)}
              >
                同步：{SYNC_STATUS_LABELS[envelope?.sync.status] || '加载中'}
              </button>
            ) : null}
            <span className={capacity?.warning ? 'rt-capacity is-warning' : 'rt-capacity'}>
              本地占用 {capacityLabel}
            </span>
            <button className="rt-action-button is-secondary" type="button" onClick={() => setCompanyEditor({ company: null })}>
              ＋ 招聘信息
            </button>
            <button
              className="rt-action-button"
              type="button"
              disabled={companies.length === 0}
              onClick={() => setApplicationEditor({ application: null, companyId: null })}
            >
              ＋ 新增投递
            </button>
          </>
        )}
        renderCompanyActions={(company) => (
          <>
            {activeTab === 'recruitment' ? (
              <button
                className="rt-action-button is-secondary"
                type="button"
                onClick={() => showCompanyApplications(company)}
              >
                查看投递
              </button>
            ) : null}
            <button
              className="rt-action-button"
              type="button"
              onClick={() => setApplicationEditor({ application: null, companyId: company.id })}
            >
              ＋ 投递
            </button>
            <button className="rt-action-button is-secondary" type="button" onClick={() => setCompanyEditor({ company })}>
              编辑
            </button>
            <button className="rt-action-button is-danger" type="button" onClick={() => openCompanyDelete(company)}>
              删除
            </button>
          </>
        )}
        renderApplicationActions={(application) => (
          <>
            <select
              className="rt-quick-progress"
              aria-label={`快速更新当前环节：${application.id}`}
              value={application.currentStageId}
              disabled={quickProgressId === application.id}
              onChange={(event) => void quickSwitchProgress(application, event.target.value)}
            >
              {application.progressStages.map((stage) => (
                <option value={stage.id} key={stage.id}>{stage.name}</option>
              ))}
            </select>
            <button
              className="rt-action-button"
              type="button"
              onClick={() => setProgressEditor(application)}
            >
              编辑进度
            </button>
            <button
              className="rt-action-button is-secondary"
              type="button"
              onClick={() => setApplicationEditor({ application, companyId: application.companyId })}
            >
              编辑投递
            </button>
            <button
              className="rt-action-button is-danger"
              type="button"
              onClick={() => setDeleteTarget({ type: 'application', record: application, applicationCount: 0 })}
            >
              删除
            </button>
          </>
        )}
      />

      {companyEditor ? (
        <CompanyDialog
          open
          company={companyEditor.company}
          companyService={companyService}
          onSaved={() => reloadAfterWrite(companyEditor.company ? '公司信息已更新' : '公司招聘信息已保存')}
          onClose={() => setCompanyEditor(null)}
        />
      ) : null}
      {applicationEditor ? (
        <ApplicationDialog
          open
          application={applicationEditor.application}
          initialCompanyId={applicationEditor.companyId}
          companies={companies}
          applicationService={applicationService}
          onSaved={(saved) => {
            setExpandedCompanyIds((current) => new Set(current).add(saved.companyId))
            return reloadAfterWrite(applicationEditor.application ? '投递信息已更新' : '投递记录已保存')
          }}
          onClose={() => setApplicationEditor(null)}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteDialog
          target={deleteTarget}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
      {progressEditor ? (
        <ProgressEditorDialog
          application={progressEditor}
          applicationService={applicationService}
          onSaved={() => reloadAfterWrite('招聘进度流程已保存')}
          onClose={() => setProgressEditor(null)}
        />
      ) : null}
      {csvImport ? (
        <CsvImportDialog
          fileName={csvImport.fileName}
          sourceText={csvImport.sourceText}
          initialPreview={csvImport.initialPreview}
          csvService={csvService}
          onCommitted={async (summary) => {
            setCsvImport(null)
            await reloadAfterWrite(
              `CSV 导入成功：新增 ${summary.companyCreates + summary.applicationCreates} 条，更新 ${summary.companyUpdates + summary.applicationUpdates} 条`,
            )
          }}
          onClose={() => setCsvImport(null)}
        />
      ) : null}
      {syncPanelOpen && envelope && syncClient ? (
        <SyncAccountDialog
          session={syncSession}
          envelope={envelope}
          onSignIn={signInForSync}
          onSignOut={signOutFromSync}
          onSync={syncNow}
          onTakeover={takeOverDevice}
          onClearAndRebind={clearAndRebind}
          onExport={exportCsv}
          onClose={() => setSyncPanelOpen(false)}
        />
      ) : null}
      {syncLoadError ? (
        <button
          className="rt-sync-service-error"
          type="button"
          onClick={() => setSyncPanelOpen(true)}
        >
          同步服务异常：{syncLoadError}
        </button>
      ) : null}
      {toast ? <div className="rt-toast" role="status">{toast}</div> : null}
    </>
  )
}
