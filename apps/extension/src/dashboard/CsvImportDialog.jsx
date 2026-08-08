import { useState } from 'react'
import { Dialog, FormField } from '@recruitment-tracker/ui'

function SummaryItem({ label, value }) {
  return (
    <div className="rt-csv-summary__item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function CsvImportDialog({
  fileName,
  sourceText,
  initialPreview,
  csvService,
  onCommitted,
  onClose,
}) {
  const [preview, setPreview] = useState(initialPreview)
  const [matches, setMatches] = useState(initialPreview.matches || {})
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [committing, setCommitting] = useState(false)

  function updateMatch(key, value) {
    setMatches((current) => ({ ...current, [key]: value }))
  }

  async function checkMatches() {
    setChecking(true)
    setError('')
    try {
      const next = await csvService.previewImport(sourceText, { matches })
      setPreview(next)
      setMatches(next.matches)
    } catch (caught) {
      setError(caught?.message || 'CSV 重新校验失败')
    } finally {
      setChecking(false)
    }
  }

  async function commit() {
    setCommitting(true)
    setError('')
    try {
      await csvService.commitImport(preview)
      await onCommitted(preview.summary)
    } catch (caught) {
      setError(caught?.message || 'CSV 导入失败')
    } finally {
      setCommitting(false)
    }
  }

  const allMatchesSelected = preview.confirmations.every(
    (confirmation) => Boolean(matches[confirmation.key]),
  )

  return (
    <Dialog
      open
      title="导入 CSV"
      description={`文件：${fileName}。全部校验通过并再次确认后，才会一次性写入本地数据。`}
      onClose={() => {
        if (!committing) onClose()
      }}
    >
      <div className="rt-form rt-csv-import">
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}

        <section aria-label="导入摘要">
          <h3>导入预览</h3>
          <div className="rt-csv-summary">
            <SummaryItem label="数据行" value={preview.summary.totalRows} />
            <SummaryItem label="新增公司" value={preview.summary.companyCreates} />
            <SummaryItem label="更新公司" value={preview.summary.companyUpdates} />
            <SummaryItem label="新增投递" value={preview.summary.applicationCreates} />
            <SummaryItem label="更新投递" value={preview.summary.applicationUpdates} />
            <SummaryItem label="错误" value={preview.summary.errorCount} />
          </div>
        </section>

        {preview.errors.length > 0 ? (
          <section className="rt-csv-errors" aria-label="导入错误">
            <h3>需要修正的错误</h3>
            <ul>
              {preview.errors.map((item, index) => (
                <li key={`${item.row}-${item.column}-${item.code}-${index}`}>
                  <strong>{item.row ? `第 ${item.row} 行` : '完整数据'}</strong>
                  {item.column ? ` · ${item.column}` : ''}：{item.message}
                </li>
              ))}
            </ul>
            <p>已停止导入，本地数据没有发生变化。请修正文件后重新选择。</p>
          </section>
        ) : null}

        {preview.confirmations.length > 0 ? (
          <section className="rt-csv-confirmations" aria-label="公司匹配确认">
            <h3>确认公司匹配</h3>
            <p>以下名称可能对应已有公司。请选择更新对象，避免无提示合并。</p>
            <div className="rt-form-grid">
              {preview.confirmations.map((confirmation) => (
                <FormField
                  key={confirmation.key}
                  label={`第 ${confirmation.row} 行 · ${confirmation.companyName}`}
                  full
                >
                  <select
                    value={matches[confirmation.key] || ''}
                    onChange={(event) => updateMatch(confirmation.key, event.target.value)}
                  >
                    <option value="">请选择处理方式</option>
                    {confirmation.candidates.map((candidate) => (
                      <option value={candidate.id} key={candidate.id}>
                        更新已有公司：{candidate.companyName}
                      </option>
                    ))}
                    {confirmation.allowCreate ? (
                      <option value="create">创建新的独立公司</option>
                    ) : null}
                  </select>
                </FormField>
              ))}
            </div>
          </section>
        ) : null}

        {preview.canCommit ? (
          <p className="rt-csv-ready" role="status">
            校验通过。未在 CSV 中出现的本地记录会保留；相同 ID 的记录按 CSV 完整覆盖。
          </p>
        ) : null}

        <div className="rt-form-actions">
          <button className="rt-action-button is-secondary" type="button" onClick={onClose} disabled={committing}>
            取消
          </button>
          {preview.confirmations.length > 0 ? (
            <button
              className="rt-action-button"
              type="button"
              disabled={!allMatchesSelected || checking}
              onClick={() => void checkMatches()}
            >
              {checking ? '校验中…' : '应用匹配并重新校验'}
            </button>
          ) : (
            <button
              className="rt-action-button"
              type="button"
              disabled={!preview.canCommit || committing}
              onClick={() => void commit()}
            >
              {committing ? '导入中…' : '确认导入'}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
