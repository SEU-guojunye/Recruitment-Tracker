import { MODEL_SCHEMA_VERSION } from './constants.js'
import { applyDatasetCompatibilityDefaults } from './compatibility.js'
import { UnsupportedSchemaVersionError } from './local-envelope.js'
import { DomainValidationError, validateDataset } from './validation.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function snapshotError(path, code, message) {
  return new DomainValidationError([{ path, code, message }])
}

function normalizeUpdatedAt(value) {
  let candidate = value
  if (value instanceof Date) candidate = value.getTime()
  else if (value && typeof value === 'object') {
    if (value.$date !== undefined) candidate = value.$date
    else if (Number.isFinite(value._seconds)) candidate = value._seconds * 1000
    else if (Number.isFinite(value.seconds)) candidate = value.seconds * 1000
  }
  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) {
    throw snapshotError('updatedAt', 'invalid_timestamp', '云端快照更新时间无效')
  }
  return date.toISOString()
}

export function validateCloudSnapshot(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw snapshotError('snapshot', 'invalid_type', '云端快照必须是对象')
  }
  if (snapshot.schemaVersion !== MODEL_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(snapshot.schemaVersion)
  }
  if (typeof snapshot.ownerId !== 'string' || !snapshot.ownerId) {
    throw snapshotError('ownerId', 'required', '云端快照缺少所有者')
  }
  if (typeof snapshot.sourceDeviceId !== 'string' || !snapshot.sourceDeviceId) {
    throw snapshotError('sourceDeviceId', 'required', '云端快照缺少来源设备')
  }
  if (!Number.isSafeInteger(snapshot.sourceRevision) || snapshot.sourceRevision < 0) {
    throw snapshotError('sourceRevision', 'invalid_revision', '云端快照修订号无效')
  }
  const data = applyDatasetCompatibilityDefaults(snapshot.data)
  const result = validateDataset(data, options)
  if (!result.valid) throw new DomainValidationError(result.errors)
  return {
    ownerId: snapshot.ownerId,
    schemaVersion: snapshot.schemaVersion,
    sourceDeviceId: snapshot.sourceDeviceId,
    sourceRevision: snapshot.sourceRevision,
    data: clone(data),
    updatedAt: normalizeUpdatedAt(snapshot.updatedAt),
  }
}
