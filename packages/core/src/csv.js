import {
  MAX_DATA_BYTES,
  MODEL_SCHEMA_VERSION,
  PROGRESS_PHASE_ORDER,
} from './constants.js'
import { assertDataCapacity } from './local-envelope.js'
import { createApplication, createCompanyRecord } from './models.js'
import { normalizeCompanyName } from './normalization.js'
import { validateDataset } from './validation.js'

export const CSV_HEADERS = Object.freeze([
  'schemaVersion',
  'recordType',
  'companyId',
  'companyName',
  'recruitmentLink',
  'industryType',
  'recruitmentBatch',
  'priority',
  'companyNotes',
  'companyCreatedAt',
  'companyUpdatedAt',
  'applicationId',
  'jobTitle',
  'applicationLink',
  'workLocation',
  'statusLink',
  'appliedDate',
  'progressStatus',
  'progressPhase',
  'progressIsTerminal',
  'progressUpdatedDate',
  'isReferral',
  'referralCode',
  'applicationNotes',
  'progressStages',
  'currentStageId',
  'applicationCreatedAt',
  'applicationUpdatedAt',
])

const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r', '\n'])

export class CsvImportError extends Error {
  constructor(message, { row = 0, column = '', code = 'CSV_IMPORT_FAILED' } = {}) {
    super(message)
    this.name = 'CsvImportError'
    this.code = code
    this.row = row
    this.column = column
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function defaultIdFactory() {
  return crypto.randomUUID()
}

export function escapeSpreadsheetText(value) {
  const text = String(value ?? '')
  if (text.startsWith("'")) return `'${text}`
  return FORMULA_PREFIXES.has(text[0]) ? `'${text}` : text
}

export function unescapeSpreadsheetText(value) {
  const text = String(value ?? '')
  if (text.startsWith("''")) return text.slice(1)
  if (text.startsWith("'") && FORMULA_PREFIXES.has(text[1])) return text.slice(1)
  return text
}

function quoteCsvField(value) {
  const safe = escapeSpreadsheetText(value)
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function emptyRow() {
  return Object.fromEntries(CSV_HEADERS.map((header) => [header, '']))
}

export function serializeRecruitmentCsv(data) {
  const companyById = new Map(data.companies.map((company) => [company.id, company]))
  const rows = []
  for (const company of data.companies) {
    rows.push({
      ...emptyRow(),
      schemaVersion: MODEL_SCHEMA_VERSION,
      recordType: 'company',
      companyId: company.id,
      companyName: company.companyName,
      recruitmentLink: company.recruitmentLink,
      industryType: company.industryType,
      recruitmentBatch: company.recruitmentBatch,
      priority: company.priority,
      companyNotes: '',
      companyCreatedAt: company.createdAt,
      companyUpdatedAt: company.updatedAt,
    })
  }
  for (const application of data.applications) {
    const company = companyById.get(application.companyId)
    if (!company) throw new CsvImportError(`投递 ${application.id} 关联的公司不存在`)
    rows.push({
      ...emptyRow(),
      schemaVersion: MODEL_SCHEMA_VERSION,
      recordType: 'application',
      companyId: company.id,
      companyName: company.companyName,
      applicationId: application.id,
      jobTitle: application.jobTitle,
      applicationLink: application.applicationLink,
      workLocation: application.workLocation,
      statusLink: application.statusLink,
      appliedDate: application.appliedDate,
      progressStatus: application.progressStatus,
      progressPhase: application.progressPhase,
      progressIsTerminal: String(application.progressIsTerminal),
      progressUpdatedDate: application.progressUpdatedDate,
      isReferral: String(application.isReferral),
      referralCode: application.referralCode,
      applicationNotes: application.applicationNotes,
      progressStages: JSON.stringify(application.progressStages),
      currentStageId: application.currentStageId,
      applicationCreatedAt: application.createdAt,
      applicationUpdatedAt: application.updatedAt,
    })
  }
  const lines = [CSV_HEADERS.join(',')]
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((header) => quoteCsvField(row[header])).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}`
}

function parseCsvRows(input) {
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input
  const rows = []
  let values = []
  let field = ''
  let quoted = false
  let justClosedQuote = false
  let line = 1
  let rowStartLine = 1

  function finishField() {
    values.push(field)
    field = ''
    justClosedQuote = false
  }

  function finishRow() {
    finishField()
    rows.push({ values, line: rowStartLine })
    values = []
    rowStartLine = line + 1
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
        justClosedQuote = true
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && next === '\n') index += 1
        field += '\n'
        line += 1
      } else {
        field += character
      }
      continue
    }

    if (justClosedQuote && ![',', '\r', '\n'].includes(character)) {
      throw new CsvImportError('结束引号后存在非法字符', {
        row: rowStartLine,
        code: 'INVALID_CSV_QUOTE',
      })
    }
    if (character === '"') {
      if (field !== '') {
        throw new CsvImportError('字段中存在未转义的双引号', {
          row: rowStartLine,
          code: 'INVALID_CSV_QUOTE',
        })
      }
      quoted = true
    } else if (character === ',') {
      finishField()
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && next === '\n') index += 1
      finishRow()
      line += 1
    } else {
      field += character
    }
  }

  if (quoted) {
    throw new CsvImportError('CSV 存在未闭合的双引号', {
      row: rowStartLine,
      code: 'UNCLOSED_CSV_QUOTE',
    })
  }
  if (field !== '' || values.length > 0 || justClosedQuote) finishRow()
  return rows
}

export function parseRecruitmentCsv(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new CsvImportError('CSV 文件为空', { row: 1, code: 'EMPTY_CSV' })
  }
  const rows = parseCsvRows(text)
  const header = rows.shift()?.values || []
  if (
    header.length !== CSV_HEADERS.length ||
    header.some((value, index) => value !== CSV_HEADERS[index])
  ) {
    throw new CsvImportError('CSV 表头与当前版本不一致', {
      row: 1,
      code: 'INVALID_CSV_HEADER',
    })
  }

  return rows
    .filter((row) => row.values.some((value) => value !== ''))
    .map((row) => {
      if (row.values.length !== CSV_HEADERS.length) {
        throw new CsvImportError(
          `第 ${row.line} 行列数应为 ${CSV_HEADERS.length}，实际为 ${row.values.length}`,
          { row: row.line, code: 'INVALID_COLUMN_COUNT' },
        )
      }
      return {
        line: row.line,
        values: Object.fromEntries(
          CSV_HEADERS.map((headerName, index) => [
            headerName,
            unescapeSpreadsheetText(row.values[index]),
          ]),
        ),
      }
    })
}

function errorFromCaught(error, row, column = '') {
  const detail = error?.errors?.[0]
  return {
    row,
    column: detail?.path || column,
    code: detail?.code || error?.code || 'INVALID_ROW',
    message: detail?.message || error?.message || '行数据无效',
  }
}

function parseBoolean(value, row, column) {
  if (value === 'true') return true
  if (value === 'false') return false
  throw new CsvImportError(`${column} 只接受 true 或 false`, {
    row,
    column,
    code: 'INVALID_BOOLEAN',
  })
}

function requireValue(value, row, column) {
  if (!value.trim()) {
    throw new CsvImportError(`${column} 不能为空`, {
      row,
      column,
      code: 'REQUIRED',
    })
  }
}

function validateApplicationSummary(values, row) {
  for (const column of [
    'appliedDate',
    'progressStatus',
    'progressPhase',
    'progressUpdatedDate',
  ]) {
    requireValue(values[column], row, column)
  }
  if (!PROGRESS_PHASE_ORDER.includes(values.progressPhase)) {
    throw new CsvImportError('progressPhase 阶段代码无效', {
      row,
      column: 'progressPhase',
      code: 'INVALID_PROGRESS_PHASE',
    })
  }
}

function validateCommonRow(row) {
  const { values } = row
  if (values.schemaVersion !== String(MODEL_SCHEMA_VERSION)) {
    throw new CsvImportError(`仅支持 schemaVersion=${MODEL_SCHEMA_VERSION}`, {
      row: row.line,
      column: 'schemaVersion',
      code: 'UNSUPPORTED_SCHEMA_VERSION',
    })
  }
  if (!['company', 'application'].includes(values.recordType)) {
    throw new CsvImportError('recordType 只接受 company 或 application', {
      row: row.line,
      column: 'recordType',
      code: 'INVALID_RECORD_TYPE',
    })
  }
  if (!values.companyName.trim()) {
    throw new CsvImportError('companyName 不能为空', {
      row: row.line,
      column: 'companyName',
      code: 'REQUIRED',
    })
  }
}

function upsertById(items, value) {
  const index = items.findIndex((item) => item.id === value.id)
  if (index === -1) items.push(value)
  else items[index] = value
}

function candidateSummary(companies) {
  return companies.map((company) => ({
    id: company.id,
    companyName: company.companyName,
  }))
}

export class CsvImportExportService {
  constructor(repository, {
    idFactory = defaultIdFactory,
    now = () => new Date(),
    today,
    maxDataBytes = MAX_DATA_BYTES,
  } = {}) {
    this.repository = repository
    this.idFactory = idFactory
    this.now = now
    this.today = today
    this.maxDataBytes = maxDataBytes
  }

  async exportCsv() {
    return serializeRecruitmentCsv(await this.repository.getData())
  }

  async previewImport(text, { matches = {} } = {}) {
    const envelope = await this.repository.getEnvelope()
    const timestamp = this.now().toISOString()
    const data = clone(envelope.data)
    const errors = []
    const confirmations = []
    const companyCreates = new Set()
    const companyUpdates = new Set()
    const applicationCreates = new Set()
    const applicationUpdates = new Set()
    const timestampDefaults = []
    let rows
    try {
      rows = parseRecruitmentCsv(text)
    } catch (error) {
      errors.push(errorFromCaught(error, error.row || 1, error.column))
      return this.buildPreview({
        envelope,
        text,
        matches,
        data: null,
        rows: [],
        errors,
        confirmations,
        companyCreates,
        companyUpdates,
        applicationCreates,
        applicationUpdates,
        timestampDefaults,
      })
    }

    const validRows = []
    for (const row of rows) {
      try {
        validateCommonRow(row)
        validRows.push(row)
      } catch (error) {
        errors.push(errorFromCaught(error, row.line, error.column))
      }
    }

    const companyRows = validRows.filter((row) => row.values.recordType === 'company')
    const applicationRows = validRows.filter((row) => row.values.recordType === 'application')
    const seenCompanyIds = new Map()
    for (const row of companyRows) {
      const sourceId = row.values.companyId
      if (sourceId && seenCompanyIds.has(sourceId)) {
        errors.push({
          row: row.line,
          column: 'companyId',
          code: 'DUPLICATE_ID',
          message: `companyId 与第 ${seenCompanyIds.get(sourceId)} 行重复`,
        })
        continue
      }
      if (sourceId) seenCompanyIds.set(sourceId, row.line)

      try {
        const normalizedName = normalizeCompanyName(row.values.companyName)
        let targetId = sourceId
        const existingById = targetId
          ? data.companies.find((company) => company.id === targetId)
          : null
        if (existingById && existingById.normalizedCompanyName !== normalizedName) {
          throw new CsvImportError('companyId 对应的本地公司名称冲突', {
            row: row.line,
            column: 'companyId',
            code: 'ID_NAME_CONFLICT',
          })
        }

        if (!targetId) {
          const candidates = data.companies.filter(
            (company) => company.normalizedCompanyName === normalizedName,
          )
          if (candidates.length > 0) {
            const key = `company:${row.line}`
            const decision = matches[key]
            if (!decision) {
              confirmations.push({
                key,
                row: row.line,
                kind: 'company',
                companyName: row.values.companyName,
                candidates: candidateSummary(candidates),
                allowCreate: true,
              })
              continue
            }
            if (decision !== 'create' && !candidates.some((company) => company.id === decision)) {
              throw new CsvImportError('公司匹配确认值无效', {
                row: row.line,
                code: 'INVALID_MATCH_DECISION',
              })
            }
            targetId = decision === 'create' ? `company-${this.idFactory()}` : decision
          } else {
            targetId = `company-${this.idFactory()}`
          }
        }

        const existingTarget = data.companies.find((company) => company.id === targetId)
        const exists = Boolean(existingTarget)
        const company = createCompanyRecord({
          id: targetId,
          companyName: row.values.companyName,
          recruitmentLink: row.values.recruitmentLink,
          industryType: row.values.industryType,
          recruitmentBatch: row.values.recruitmentBatch,
          priority: row.values.priority,
          companyNotes: existingTarget?.companyNotes || '',
          createdAt: row.values.companyCreatedAt || timestamp,
          updatedAt: row.values.companyUpdatedAt || timestamp,
        }, { idFactory: this.idFactory, now: this.now })
        if (!row.values.companyCreatedAt) {
          timestampDefaults.push({ recordType: 'company', id: company.id, field: 'createdAt' })
        }
        if (!row.values.companyUpdatedAt) {
          timestampDefaults.push({ recordType: 'company', id: company.id, field: 'updatedAt' })
        }
        upsertById(data.companies, company)
        ;(exists ? companyUpdates : companyCreates).add(company.id)
      } catch (error) {
        errors.push(errorFromCaught(error, row.line, error.column))
      }
    }

    if (confirmations.length > 0) {
      return this.buildPreview({
        envelope, text, matches, data: null, rows, errors, confirmations,
        companyCreates, companyUpdates, applicationCreates, applicationUpdates,
        timestampDefaults,
      })
    }

    const seenApplicationIds = new Map()
    for (const row of applicationRows) {
      const values = row.values
      if (values.applicationId && seenApplicationIds.has(values.applicationId)) {
        errors.push({
          row: row.line,
          column: 'applicationId',
          code: 'DUPLICATE_ID',
          message: `applicationId 与第 ${seenApplicationIds.get(values.applicationId)} 行重复`,
        })
        continue
      }
      if (values.applicationId) seenApplicationIds.set(values.applicationId, row.line)

      try {
        validateApplicationSummary(values, row.line)
        const existingApplication = values.applicationId
          ? data.applications.find((application) => application.id === values.applicationId)
          : null
        let companyId = values.companyId
        if (!companyId && existingApplication) companyId = existingApplication.companyId

        if (companyId) {
          const company = data.companies.find((item) => item.id === companyId)
          if (!company) {
            throw new CsvImportError('companyId 无法关联导入文件或本地公司', {
              row: row.line,
              column: 'companyId',
              code: 'COMPANY_NOT_FOUND',
            })
          }
          if (company.normalizedCompanyName !== normalizeCompanyName(values.companyName)) {
            throw new CsvImportError('投递行 companyId 与 companyName 矛盾', {
              row: row.line,
              column: 'companyName',
              code: 'COMPANY_NAME_CONFLICT',
            })
          }
        } else {
          const normalizedName = normalizeCompanyName(values.companyName)
          const candidates = data.companies.filter(
            (company) => company.normalizedCompanyName === normalizedName,
          )
          if (candidates.length === 0) {
            const company = createCompanyRecord({
              id: `company-${this.idFactory()}`,
              companyName: values.companyName,
              recruitmentLink: '',
              companyNotes: '',
              createdAt: timestamp,
              updatedAt: timestamp,
            }, { idFactory: this.idFactory, now: this.now })
            data.companies.push(company)
            timestampDefaults.push(
              { recordType: 'company', id: company.id, field: 'createdAt' },
              { recordType: 'company', id: company.id, field: 'updatedAt' },
            )
            companyCreates.add(company.id)
            companyId = company.id
          } else if (candidates.length === 1) {
            companyId = candidates[0].id
          } else {
            const key = `application-company:${row.line}`
            const decision = matches[key]
            if (!decision) {
              confirmations.push({
                key,
                row: row.line,
                kind: 'applicationCompany',
                companyName: values.companyName,
                candidates: candidateSummary(candidates),
                allowCreate: false,
              })
              continue
            }
            if (!candidates.some((company) => company.id === decision)) {
              throw new CsvImportError('投递公司匹配确认值无效', {
                row: row.line,
                code: 'INVALID_MATCH_DECISION',
              })
            }
            companyId = decision
          }
        }

        if (existingApplication && existingApplication.companyId !== companyId) {
          throw new CsvImportError('已有 applicationId 不允许移动到其他公司', {
            row: row.line,
            column: 'applicationId',
            code: 'APPLICATION_COMPANY_CONFLICT',
          })
        }

        const progressIsTerminal = parseBoolean(
          values.progressIsTerminal,
          row.line,
          'progressIsTerminal',
        )
        const isReferral = parseBoolean(values.isReferral, row.line, 'isReferral')
        let progressStages
        let currentStageId = values.currentStageId
        if (values.progressStages) {
          try {
            progressStages = JSON.parse(values.progressStages)
          } catch {
            throw new CsvImportError('progressStages 必须是合法 JSON 数组', {
              row: row.line,
              column: 'progressStages',
              code: 'INVALID_PROGRESS_STAGES_JSON',
            })
          }
          if (!Array.isArray(progressStages)) {
            throw new CsvImportError('progressStages 必须是合法 JSON 数组', {
              row: row.line,
              column: 'progressStages',
              code: 'INVALID_PROGRESS_STAGES_JSON',
            })
          }
          if (!currentStageId) {
            throw new CsvImportError('progressStages 非空时 currentStageId 必填', {
              row: row.line,
              column: 'currentStageId',
              code: 'REQUIRED',
            })
          }
        } else {
          currentStageId = `stage-${this.idFactory()}`
          progressStages = [{
            id: currentStageId,
            name: values.progressStatus,
            phase: values.progressPhase,
            isTerminal: progressIsTerminal,
            date: values.progressUpdatedDate,
          }]
        }

        const applicationId = values.applicationId || `application-${this.idFactory()}`
        const application = createApplication({
          id: applicationId,
          companyId,
          jobTitle: values.jobTitle,
          applicationLink: values.applicationLink,
          workLocation: values.workLocation,
          statusLink: values.statusLink,
          appliedDate: values.appliedDate,
          progressStatus: values.progressStatus,
          progressPhase: values.progressPhase,
          progressIsTerminal,
          progressUpdatedDate: values.progressUpdatedDate,
          isReferral,
          referralCode: values.referralCode,
          progressStages,
          currentStageId,
          applicationNotes: values.applicationNotes,
          createdAt: values.applicationCreatedAt || timestamp,
          updatedAt: values.applicationUpdatedAt || timestamp,
        }, {
          idFactory: this.idFactory,
          now: this.now,
          today: this.today,
          companyIds: new Set(data.companies.map((company) => company.id)),
        })
        if (!values.applicationCreatedAt) {
          timestampDefaults.push({
            recordType: 'application',
            id: application.id,
            field: 'createdAt',
          })
        }
        if (!values.applicationUpdatedAt) {
          timestampDefaults.push({
            recordType: 'application',
            id: application.id,
            field: 'updatedAt',
          })
        }
        upsertById(data.applications, application)
        ;(existingApplication ? applicationUpdates : applicationCreates).add(application.id)
      } catch (error) {
        errors.push(errorFromCaught(error, row.line, error.column))
      }
    }

    if (confirmations.length === 0 && errors.length === 0) {
      const result = validateDataset(data, { today: this.today })
      if (!result.valid) {
        errors.push(...result.errors.map((error) => ({
          row: 0,
          column: error.path,
          code: error.code,
          message: error.message,
        })))
      }
      try {
        assertDataCapacity(data, this.maxDataBytes)
      } catch (error) {
        errors.push(errorFromCaught(error, 0))
      }
    }

    return this.buildPreview({
      envelope, text, matches, data, rows, errors, confirmations,
      companyCreates, companyUpdates, applicationCreates, applicationUpdates,
      timestampDefaults,
    })
  }

  buildPreview({
    envelope,
    text,
    matches,
    data,
    rows,
    errors,
    confirmations,
    companyCreates,
    companyUpdates,
    applicationCreates,
    applicationUpdates,
    timestampDefaults,
  }) {
    const canCommit = errors.length === 0 && confirmations.length === 0 && Boolean(data)
    return {
      schemaVersion: MODEL_SCHEMA_VERSION,
      sourceText: text,
      matches: { ...matches },
      baseRevision: envelope.sync.localRevision,
      canCommit,
      errors,
      confirmations,
      summary: {
        totalRows: rows.length,
        companyCreates: companyCreates.size,
        companyUpdates: companyUpdates.size,
        applicationCreates: applicationCreates.size,
        applicationUpdates: applicationUpdates.size,
        errorCount: errors.length,
        confirmationCount: confirmations.length,
      },
      data: canCommit ? clone(data) : null,
      timestampDefaults: canCommit ? clone(timestampDefaults) : [],
    }
  }

  async commitImport(preview) {
    if (!preview?.canCommit || !preview.data) {
      throw new CsvImportError('导入预览尚未通过全部校验', {
        code: 'IMPORT_NOT_READY',
      })
    }
    const envelope = await this.repository.getEnvelope()
    if (envelope.sync.localRevision !== preview.baseRevision) {
      throw new CsvImportError('预览后本地数据已变化，请重新预览 CSV', {
        code: 'STALE_IMPORT_PREVIEW',
      })
    }
    const data = clone(preview.data)
    const commitTimestamp = this.now().toISOString()
    for (const timestampDefault of preview.timestampDefaults || []) {
      const collection = timestampDefault.recordType === 'company'
        ? data.companies
        : data.applications
      const record = collection.find((item) => item.id === timestampDefault.id)
      if (record) record[timestampDefault.field] = commitTimestamp
    }
    assertDataCapacity(data, this.maxDataBytes)
    return this.repository.replaceAll(data)
  }
}
