import { useState } from 'react'
import {
  FIELD_LIMITS,
  PROGRESS_PHASE_ORDER,
  PROGRESS_PHASES,
  deriveProgressSummary,
} from '@recruitment-tracker/core'
import { Dialog, ProgressTimeline } from '@recruitment-tracker/ui'

function newStage() {
  return {
    id: `stage-${crypto.randomUUID()}`,
    name: '新环节',
    phase: 'screening',
    isTerminal: false,
    date: '',
  }
}

function previewApplication(application, stages, currentStageId) {
  const summary = deriveProgressSummary(stages, currentStageId)
  return {
    ...application,
    progressStages: stages,
    currentStageId,
    ...(summary || {}),
  }
}

export function ProgressEditorDialog({
  application,
  applicationService,
  onSaved,
  onClose,
}) {
  const [stages, setStages] = useState(() =>
    application.progressStages.map((stage) => ({ ...stage })),
  )
  const [currentStageId, setCurrentStageId] = useState(application.currentStageId)
  const [requiresCurrentDeletionConfirmation, setRequiresCurrentDeletionConfirmation] = useState(false)
  const [currentDeletionConfirmed, setCurrentDeletionConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function updateStage(stageId, changes) {
    setStages((current) => current.map((stage) => {
      if (stage.id !== stageId) return stage
      const next = { ...stage, ...changes }
      if (next.phase === 'closed') next.isTerminal = true
      return next
    }))
  }

  function moveStage(index, offset) {
    const target = index + offset
    if (target < 0 || target >= stages.length) return
    setStages((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function deleteStage(index) {
    if (stages.length <= 1) return
    const removed = stages[index]
    const next = stages.filter((stage) => stage.id !== removed.id)
    if (removed.id === currentStageId) {
      const fallback = next[Math.min(index, next.length - 1)]
      setCurrentStageId(fallback.id)
      setRequiresCurrentDeletionConfirmation(true)
      setCurrentDeletionConfirmed(false)
    }
    setStages(next)
  }

  async function save() {
    const trimmedStages = stages.map((stage) => ({
      ...stage,
      name: stage.name.trim(),
      isTerminal: stage.phase === 'closed' ? true : stage.isTerminal,
    }))
    if (trimmedStages.some((stage) => !stage.name)) {
      setError('环节名称不能为空')
      return
    }
    if (requiresCurrentDeletionConfirmation && !currentDeletionConfirmed) {
      setError('请确认删除当前环节后的新当前环节')
      return
    }

    setSaving(true)
    setError('')
    try {
      const saved = await applicationService.replaceProgress(
        application.id,
        trimmedStages,
        currentStageId,
      )
      await onSaved(saved)
    } catch (caught) {
      setError(caught?.errors?.[0]?.message || caught?.message || '进度保存失败')
    } finally {
      setSaving(false)
    }
  }

  const preview = previewApplication(application, stages, currentStageId)
  return (
    <Dialog
      open
      title="编辑招聘进度"
      description="环节名称用于展示；稳定阶段与终态用于统计和筛选。"
      onClose={onClose}
    >
      <div className="rt-form">
        {error ? <p className="rt-form-error" role="alert">{error}</p> : null}
        <section className="rt-progress-preview" aria-label="进度预览">
          <ProgressTimeline application={preview} />
        </section>

        <div className="rt-stage-list">
          {stages.map((stage, index) => (
            <fieldset
              className={`rt-stage-row ${stage.id === currentStageId ? 'is-current' : ''}`}
              key={stage.id}
            >
              <legend className="rt-sr-only">环节 {index + 1}</legend>
              <label className="rt-stage-current">
                <input
                  type="radio"
                  name="current-stage"
                  checked={stage.id === currentStageId}
                  onChange={() => setCurrentStageId(stage.id)}
                  aria-label={`设为当前环节：${stage.name}`}
                />
                <span>当前</span>
              </label>
              <label>
                <span>环节名称</span>
                <input
                  maxLength={FIELD_LIMITS.stageName}
                  value={stage.name}
                  onChange={(event) => updateStage(stage.id, { name: event.target.value })}
                  aria-label={`环节 ${index + 1} 名称`}
                />
              </label>
              <label>
                <span>稳定阶段</span>
                <select
                  value={stage.phase}
                  onChange={(event) => updateStage(stage.id, { phase: event.target.value })}
                  aria-label={`环节 ${index + 1} 稳定阶段`}
                >
                  {PROGRESS_PHASE_ORDER.map((phase) => (
                    <option value={phase} key={phase}>{PROGRESS_PHASES[phase].label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>环节日期</span>
                <input
                  type="date"
                  value={stage.date}
                  onChange={(event) => updateStage(stage.id, { date: event.target.value })}
                  aria-label={`环节 ${index + 1} 日期`}
                />
              </label>
              <label className="rt-terminal-toggle">
                <input
                  type="checkbox"
                  checked={stage.isTerminal}
                  disabled={stage.phase === 'closed'}
                  onChange={(event) => updateStage(stage.id, { isTerminal: event.target.checked })}
                  aria-label={`环节 ${index + 1} 设为终态`}
                />
                终态
              </label>
              <div className="rt-stage-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveStage(index, -1)}
                  aria-label={`上移环节：${stage.name}`}
                >↑</button>
                <button
                  type="button"
                  disabled={index === stages.length - 1}
                  onClick={() => moveStage(index, 1)}
                  aria-label={`下移环节：${stage.name}`}
                >↓</button>
                <button
                  type="button"
                  disabled={stages.length <= 1}
                  onClick={() => deleteStage(index)}
                  aria-label={`删除环节：${stage.name}`}
                >×</button>
              </div>
            </fieldset>
          ))}
        </div>

        <button
          className="rt-add-stage"
          type="button"
          disabled={stages.length >= FIELD_LIMITS.progressStages}
          onClick={() => setStages((current) => [...current, newStage()])}
        >
          ＋ 添加环节
        </button>

        {requiresCurrentDeletionConfirmation ? (
          <label className="rt-current-delete-confirm">
            <input
              type="checkbox"
              checked={currentDeletionConfirmed}
              onChange={(event) => setCurrentDeletionConfirmed(event.target.checked)}
            />
            我确认已删除原当前环节，保存后“{preview.progressStatus}”将成为当前环节。
          </label>
        ) : null}

        <div className="rt-form-actions">
          <button className="rt-action-button is-secondary" type="button" onClick={onClose}>取消</button>
          <button
            className="rt-action-button"
            type="button"
            disabled={saving || (requiresCurrentDeletionConfirmation && !currentDeletionConfirmed)}
            onClick={() => void save()}
          >
            {saving ? '保存中…' : '保存进度'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
