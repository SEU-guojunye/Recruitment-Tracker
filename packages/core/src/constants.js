export const MODEL_SCHEMA_VERSION = 1

export const MAX_DATA_BYTES = 8 * 1024 * 1024

export const INDUSTRY_TYPE_PRESETS = Object.freeze([
  '互联网',
  '制造业',
  '央国企',
  '快消',
  '银行',
  '游戏',
  '军工',
])

export const RECRUITMENT_BATCHES = Object.freeze([
  '秋招正式批',
  '秋招提前批',
  '春招正式批',
])

export const COMPANY_PRIORITIES = Object.freeze(['P0', 'P1', 'P2'])

export const DEFAULT_RECRUITMENT_BATCH = RECRUITMENT_BATCHES[0]

export const DEFAULT_COMPANY_PRIORITY = 'P1'

export const PROGRESS_PHASE_ORDER = Object.freeze([
  'submitted',
  'screening',
  'assessment',
  'interview',
  'result',
  'closed',
])

export const PROGRESS_PHASES = Object.freeze({
  submitted: Object.freeze({ label: '已投递', defaultTerminal: false }),
  screening: Object.freeze({ label: '筛选', defaultTerminal: false }),
  assessment: Object.freeze({ label: '笔试', defaultTerminal: false }),
  interview: Object.freeze({ label: '面试', defaultTerminal: false }),
  result: Object.freeze({ label: '结果', defaultTerminal: false }),
  closed: Object.freeze({ label: '关闭', defaultTerminal: true }),
})

export const DEFAULT_PROGRESS_STAGE_TEMPLATES = Object.freeze([
  Object.freeze({ name: '已投递', phase: 'submitted', isTerminal: false }),
  Object.freeze({ name: '筛选', phase: 'screening', isTerminal: false }),
  Object.freeze({ name: '笔试', phase: 'assessment', isTerminal: false }),
  Object.freeze({ name: '技术一面', phase: 'interview', isTerminal: false }),
  Object.freeze({ name: 'HR 面', phase: 'interview', isTerminal: false }),
  Object.freeze({ name: '结果', phase: 'result', isTerminal: false }),
])

export const APPLICATION_SCOPES = Object.freeze({
  ACTIVE: 'active',
  ALL: 'all',
})

export const SYNC_STATUSES = Object.freeze([
  'signedOut',
  'idle',
  'dirty',
  'syncing',
  'synced',
  'failed',
  'accountMismatch',
  'deviceConflict',
])

export const FIELD_LIMITS = Object.freeze({
  companyName: 120,
  brandDomain: 253,
  industryType: 80,
  jobTitle: 200,
  url: 2048,
  notes: 5000,
  workLocation: 200,
  referralCode: 200,
  stageName: 80,
  progressStages: 30,
})
