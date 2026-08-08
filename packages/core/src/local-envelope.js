import {
  MAX_DATA_BYTES,
  MODEL_SCHEMA_VERSION,
  SYNC_STATUSES,
} from './constants.js'
import { DomainValidationError, validateDataset } from './validation.js'

export const LOCAL_ENVELOPE_KEY = 'recruitmentTrackerEnvelope'

export class UnsupportedSchemaVersionError extends Error {
  constructor(version) {
    super(`不支持的本地数据版本：${String(version)}`)
    this.name = 'UnsupportedSchemaVersionError'
    this.code = 'UNSUPPORTED_SCHEMA_VERSION'
    this.version = version
  }
}

export class CapacityExceededError extends Error {
  constructor(bytes, limit) {
    super(`数据大小 ${bytes} 字节超过 ${limit} 字节限制`)
    this.name = 'CapacityExceededError'
    this.code = 'CAPACITY_EXCEEDED'
    this.bytes = bytes
    this.limit = limit
  }
}

export class AccountBindingError extends Error {
  constructor(boundUserId, requestedUserId) {
    super('当前本地数据已绑定其他账号')
    this.name = 'AccountBindingError'
    this.code = 'ACCOUNT_MISMATCH'
    this.boundUserId = boundUserId
    this.requestedUserId = requestedUserId
  }
}

function defaultIdFactory() {
  return crypto.randomUUID()
}

export function createDefaultEnvelope({ idFactory = defaultIdFactory } = {}) {
  return {
    schemaVersion: MODEL_SCHEMA_VERSION,
    data: {
      companies: [],
      applications: [],
    },
    settings: {
      activeTab: 'applications',
      boundUserId: null,
      deviceId: `device-${idFactory()}`,
    },
    sync: {
      localRevision: 0,
      lastSyncedRevision: 0,
      dirty: false,
      status: 'idle',
      lastSyncedAt: null,
      lastError: null,
    },
  }
}

export function serializedDataBytes(data) {
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: MODEL_SCHEMA_VERSION,
    data,
  })).byteLength
}

export function assertDataCapacity(data, limit = MAX_DATA_BYTES) {
  const bytes = serializedDataBytes(data)
  if (bytes > limit) throw new CapacityExceededError(bytes, limit)
  return bytes
}

export function validateEnvelope(envelope, options = {}) {
  if (envelope?.schemaVersion !== MODEL_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(envelope?.schemaVersion)
  }

  const errors = [...validateDataset(envelope.data, options).errors]
  if (!envelope.settings || typeof envelope.settings !== 'object') {
    errors.push({ path: 'settings', code: 'invalid_shape', message: 'settings 必须是对象' })
  } else {
    if (!['recruitment', 'applications'].includes(envelope.settings.activeTab)) {
      errors.push({ path: 'settings.activeTab', code: 'invalid_value', message: 'activeTab 无效' })
    }
    if (
      envelope.settings.boundUserId !== null &&
      (typeof envelope.settings.boundUserId !== 'string' || !envelope.settings.boundUserId)
    ) {
      errors.push({ path: 'settings.boundUserId', code: 'invalid_value', message: 'boundUserId 无效' })
    }
    if (typeof envelope.settings.deviceId !== 'string' || !envelope.settings.deviceId) {
      errors.push({ path: 'settings.deviceId', code: 'required', message: 'deviceId 不能为空' })
    }
  }

  if (!envelope.sync || typeof envelope.sync !== 'object') {
    errors.push({ path: 'sync', code: 'invalid_shape', message: 'sync 必须是对象' })
  } else {
    for (const field of ['localRevision', 'lastSyncedRevision']) {
      if (!Number.isSafeInteger(envelope.sync[field]) || envelope.sync[field] < 0) {
        errors.push({ path: `sync.${field}`, code: 'invalid_revision', message: `${field} 必须是非负安全整数` })
      }
    }
    if (envelope.sync.lastSyncedRevision > envelope.sync.localRevision) {
      errors.push({ path: 'sync.lastSyncedRevision', code: 'invalid_revision', message: '已同步修订号不能大于本地修订号' })
    }
    if (typeof envelope.sync.dirty !== 'boolean') {
      errors.push({ path: 'sync.dirty', code: 'invalid_type', message: 'dirty 必须是布尔值' })
    }
    if (!SYNC_STATUSES.includes(envelope.sync.status)) {
      errors.push({ path: 'sync.status', code: 'invalid_value', message: '同步状态无效' })
    }
  }

  if (errors.length > 0) throw new DomainValidationError(errors)
  return envelope
}
