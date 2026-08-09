import {
  DEFAULT_PROGRESS_STAGE_TEMPLATES,
  PROGRESS_PHASE_ORDER,
} from './constants.js'

function defaultIdFactory() {
  return crypto.randomUUID()
}

export function createDefaultProgressStages({
  appliedDate,
  idFactory = defaultIdFactory,
} = {}) {
  return DEFAULT_PROGRESS_STAGE_TEMPLATES.map((template, index) => ({
    id: `stage-${idFactory()}`,
    ...template,
    date: index === 0 ? appliedDate || '' : '',
    note: '',
  }))
}

export function getCurrentStage(application) {
  return (
    application?.progressStages?.find(
      (stage) => stage.id === application.currentStageId,
    ) || null
  )
}

export function deriveProgressSummary(progressStages, currentStageId) {
  const currentStage = progressStages.find((stage) => stage.id === currentStageId)
  if (!currentStage) return null
  return {
    progressStatus: currentStage.name,
    progressPhase: currentStage.phase,
    progressIsTerminal: currentStage.isTerminal,
  }
}

export function replaceProgressWorkflow(
  application,
  { progressStages, currentStageId, localDate },
) {
  const summary = deriveProgressSummary(progressStages, currentStageId)
  if (!summary) throw new Error('currentStageId 必须指向一个进度环节')

  return {
    ...application,
    progressStages: progressStages.map((stage) => ({
      ...stage,
      note: stage.note === undefined ? '' : stage.note,
    })),
    currentStageId,
    ...summary,
    progressUpdatedDate: localDate,
  }
}

export function switchProgressStage(application, stageId, localDate) {
  const targetExists = application.progressStages.some(
    (stage) => stage.id === stageId,
  )
  if (!targetExists) throw new Error('目标进度环节不存在')

  const progressStages = application.progressStages.map((stage) =>
    stage.id === stageId && !stage.date ? { ...stage, date: localDate } : { ...stage },
  )
  return replaceProgressWorkflow(application, {
    progressStages,
    currentStageId: stageId,
    localDate,
  })
}

export function getTimelineStates(application) {
  const currentIndex = application.progressStages.findIndex(
    (stage) => stage.id === application.currentStageId,
  )
  return application.progressStages.map((stage, index) => ({
    ...stage,
    state:
      index < currentIndex
        ? 'completed'
        : index === currentIndex
          ? 'current'
          : 'upcoming',
  }))
}

export function compareProgressPhases(left, right) {
  return (
    PROGRESS_PHASE_ORDER.indexOf(left) - PROGRESS_PHASE_ORDER.indexOf(right)
  )
}
