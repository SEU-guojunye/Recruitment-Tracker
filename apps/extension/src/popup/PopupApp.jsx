import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChromeLocalRepository,
  CompanyNameConflictError,
  CompanyService,
} from '@recruitment-tracker/core'
import { collectActivePage } from '../parser/collect-page.js'
import { parserOrchestrator } from '../parser/parser-orchestrator.js'

let defaultRepository

function getDefaultRepository() {
  if (defaultRepository) return defaultRepository
  if (!globalThis.chrome?.storage?.local) return null
  defaultRepository = new ChromeLocalRepository()
  return defaultRepository
}

async function openExtensionDashboard() {
  if (!globalThis.chrome?.runtime?.openOptionsPage) {
    throw new Error('当前环境无法打开 Dashboard')
  }
  await chrome.runtime.openOptionsPage()
}

function errorMessage(error) {
  return error?.errors?.[0]?.message || error?.message || '操作失败，请重试'
}

export function PopupApp({
  repository: repositoryProp,
  collectPage = collectActivePage,
  openDashboard = openExtensionDashboard,
}) {
  const repository = useMemo(
    () => repositoryProp || getDefaultRepository(),
    [repositoryProp],
  )
  const companyService = useMemo(
    () => repository ? new CompanyService(repository) : null,
    [repository],
  )
  const [values, setValues] = useState({
    companyName: '',
    recruitmentLink: '',
  })
  const [parsing, setParsing] = useState(true)
  const [parseState, setParseState] = useState('loading')
  const [message, setMessage] = useState('正在读取当前招聘页面…')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [conflict, setConflict] = useState(null)

  const parsePage = useCallback(async () => {
    setParsing(true)
    setSaved(false)
    setConflict(null)
    setParseState('loading')
    setMessage('正在读取当前招聘页面…')
    try {
      const raw = await collectPage()
      const result = parserOrchestrator.parse(raw)
      setValues((current) => ({
        ...current,
        companyName: result.company.companyName,
        recruitmentLink: result.company.recruitmentLink,
      }))
      if (result.status === 'matched') {
        setParseState('success')
        setMessage('已识别公司候选，请确认后保存。')
      } else {
        setParseState('warning')
        setMessage('未能可靠识别公司名称，请检查或手动填写。')
      }
    } catch (error) {
      setParseState('warning')
      setMessage(errorMessage(error))
    } finally {
      setParsing(false)
    }
  }, [collectPage])

  useEffect(() => {
    const timer = setTimeout(() => void parsePage(), 0)
    return () => clearTimeout(timer)
  }, [parsePage])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setSaved(false)
    setConflict(null)
  }

  async function save(options = {}) {
    if (!companyService) {
      setParseState('error')
      setMessage('扩展本地存储不可用')
      return
    }
    setSaving(true)
    setConflict(null)
    try {
      if (options.updateCandidateId) {
        await companyService.update(options.updateCandidateId, values)
      } else {
        await companyService.create(values, { allowDuplicate: options.allowDuplicate })
      }
      setSaved(true)
      setParseState('success')
      setMessage('招聘信息已保存到本地，投递记录仍需在 Dashboard 中手动新增。')
    } catch (error) {
      if (error instanceof CompanyNameConflictError) {
        setConflict(error)
        setParseState('warning')
        setMessage(error.message)
      } else {
        setParseState('error')
        setMessage(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="popup-shell">
      <header className="popup-head">
        <div>
          <p>RECRUITMENT TRACKER</p>
          <h1>保存招聘信息</h1>
        </div>
        <button type="button" className="popup-icon-button" aria-label="重新解析页面" onClick={() => void parsePage()} disabled={parsing}>
          ↻
        </button>
      </header>

      <div className={`popup-status is-${parseState}`} role={parseState === 'error' ? 'alert' : 'status'}>
        <span aria-hidden="true">{parseState === 'loading' ? '…' : parseState === 'success' ? '✓' : '!'}</span>
        <p>{message}</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <label>
          <span>公司名称</span>
          <input
            required
            maxLength={120}
            value={values.companyName}
            onChange={(event) => update('companyName', event.target.value)}
            placeholder="请输入公司名称"
          />
        </label>
        <label>
          <span>公司招聘链接</span>
          <input
            type="url"
            maxLength={2048}
            value={values.recruitmentLink}
            onChange={(event) => update('recruitmentLink', event.target.value)}
            placeholder="https://example.com/careers"
          />
        </label>
        {conflict ? (
          <div className="popup-conflict">
            <p>发现同名候选：{conflict.candidates.map((item) => item.companyName).join('、')}</p>
            <div>
              <button type="button" onClick={() => void save({ updateCandidateId: conflict.candidates[0].id })}>
                更新已有公司
              </button>
              <button type="button" onClick={() => void save({ allowDuplicate: true })}>
                仍然创建
              </button>
            </div>
          </div>
        ) : null}

        <button className="popup-primary" type="submit" disabled={saving || parsing}>
          {saving ? '保存中…' : '保存招聘信息'}
        </button>
      </form>

      <button
        className="popup-dashboard-button"
        type="button"
        onClick={async () => {
          try {
            await openDashboard()
          } catch (error) {
            setParseState('error')
            setMessage(errorMessage(error))
          }
        }}
      >
        打开 Dashboard <span aria-hidden="true">↗</span>
      </button>
      {saved ? <p className="popup-next-step">下一步：到“岗位投递”新增具体岗位投递。</p> : null}
    </main>
  )
}
