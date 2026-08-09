import { MAX_DATA_BYTES } from './constants.js'
import { applyDatasetCompatibilityDefaults } from './compatibility.js'
import {
  AccountBindingError,
  LOCAL_ENVELOPE_KEY,
  assertDataCapacity,
  createDefaultEnvelope,
  serializedDataBytes,
  validateEnvelope,
} from './local-envelope.js'
import {
  assertValid,
  validateApplication,
  validateCompanyRecord,
} from './validation.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function defaultStorageArea() {
  if (!globalThis.chrome?.storage?.local) {
    throw new Error('ChromeLocalRepository 需要 chrome.storage.local')
  }
  return globalThis.chrome.storage.local
}

function nextBusinessEnvelope(envelope, data) {
  const blockingStatus = ['signedOut', 'accountMismatch', 'deviceConflict']
  return {
    ...envelope,
    data,
    sync: {
      ...envelope.sync,
      localRevision: envelope.sync.localRevision + 1,
      dirty: true,
      status: blockingStatus.includes(envelope.sync.status)
        ? envelope.sync.status
        : 'dirty',
    },
  }
}

export class ChromeLocalRepository {
  constructor({
    storageArea = defaultStorageArea(),
    storageKey = LOCAL_ENVELOPE_KEY,
    idFactory,
    maxDataBytes = MAX_DATA_BYTES,
    capacityWarningRatio = 0.8,
    today,
  } = {}) {
    this.storageArea = storageArea
    this.storageKey = storageKey
    this.idFactory = idFactory
    this.maxDataBytes = maxDataBytes
    this.capacityWarningRatio = capacityWarningRatio
    this.today = today
    this.queue = Promise.resolve()
  }

  enqueue(operation) {
    const result = this.queue.then(operation, operation)
    this.queue = result.catch(() => {})
    return result
  }

  async readOrCreate() {
    const stored = await this.storageArea.get(this.storageKey)
    const existing = stored?.[this.storageKey]
    if (existing !== undefined) {
      const compatible = {
        ...existing,
        data: applyDatasetCompatibilityDefaults(existing.data),
      }
      validateEnvelope(compatible, { today: this.today })
      return clone(compatible)
    }

    const envelope = createDefaultEnvelope({ idFactory: this.idFactory })
    await this.storageArea.set({ [this.storageKey]: envelope })
    return clone(envelope)
  }

  async writeEnvelope(envelope) {
    validateEnvelope(envelope, { today: this.today })
    assertDataCapacity(envelope.data, this.maxDataBytes)
    await this.storageArea.set({ [this.storageKey]: clone(envelope) })
    return clone(envelope)
  }

  getEnvelope() {
    return this.enqueue(() => this.readOrCreate())
  }

  getData() {
    return this.getEnvelope().then((envelope) => envelope.data)
  }

  getCapacity() {
    return this.getEnvelope().then((envelope) => {
      const bytes = serializedDataBytes(envelope.data)
      const ratio = bytes / this.maxDataBytes
      return {
        bytes,
        limit: this.maxDataBytes,
        ratio,
        warning: ratio >= this.capacityWarningRatio,
      }
    })
  }

  transactData(mutator) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      const data = await mutator(clone(envelope.data), clone(envelope))
      return this.writeEnvelope(nextBusinessEnvelope(envelope, data))
    })
  }

  saveCompany(company) {
    return this.transactData((data) => {
      assertValid(validateCompanyRecord(company))
      const index = data.companies.findIndex((item) => item.id === company.id)
      if (index === -1) data.companies.push(clone(company))
      else data.companies[index] = clone(company)
      return data
    })
  }

  deleteCompanyCascade(companyId) {
    let deletedApplications = 0
    return this.transactData((data) => {
      if (!data.companies.some((company) => company.id === companyId)) {
        throw new Error('公司记录不存在')
      }
      data.companies = data.companies.filter((company) => company.id !== companyId)
      const remaining = data.applications.filter(
        (application) => application.companyId !== companyId,
      )
      deletedApplications = data.applications.length - remaining.length
      data.applications = remaining
      return data
    }).then((envelope) => ({ envelope, deletedApplications }))
  }

  saveApplication(application) {
    return this.transactData((data) => {
      const companyIds = new Set(data.companies.map((company) => company.id))
      assertValid(validateApplication(application, {
        companyIds,
        today: this.today,
      }))
      const index = data.applications.findIndex((item) => item.id === application.id)
      if (index === -1) data.applications.push(clone(application))
      else data.applications[index] = clone(application)
      return data
    })
  }

  deleteApplication(applicationId) {
    return this.transactData((data) => {
      if (!data.applications.some((application) => application.id === applicationId)) {
        throw new Error('投递记录不存在')
      }
      data.applications = data.applications.filter(
        (application) => application.id !== applicationId,
      )
      return data
    })
  }

  replaceAll(data) {
    return this.transactData(() => clone(data))
  }

  setSyncState(status, { error = null } = {}) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      return this.writeEnvelope({
        ...envelope,
        sync: {
          ...envelope.sync,
          status,
          lastError: error,
        },
      })
    })
  }

  markSyncing() {
    return this.setSyncState('syncing')
  }

  markSyncBlocked(status, error) {
    if (!['signedOut', 'accountMismatch', 'deviceConflict'].includes(status)) {
      throw new Error('同步阻塞状态无效')
    }
    return this.setSyncState(status, { error })
  }

  markSyncFailed(error) {
    return this.setSyncState('failed', { error })
  }

  markSynced({ sourceRevision, syncedAt, userId }) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      const boundUserId = envelope.settings.boundUserId
      if (boundUserId && boundUserId !== userId) {
        throw new AccountBindingError(boundUserId, userId)
      }
      if (
        !Number.isSafeInteger(sourceRevision) ||
        sourceRevision < 0 ||
        sourceRevision > envelope.sync.localRevision
      ) {
        throw new Error('已同步修订号无效')
      }
      const dirty = envelope.sync.localRevision > sourceRevision
      return this.writeEnvelope({
        ...envelope,
        settings: { ...envelope.settings, boundUserId: userId },
        sync: {
          ...envelope.sync,
          lastSyncedRevision: Math.max(
            envelope.sync.lastSyncedRevision,
            sourceRevision,
          ),
          lastSyncedAt: syncedAt,
          lastError: null,
          dirty,
          status: dirty ? 'dirty' : 'synced',
        },
      })
    })
  }

  exportSnapshot() {
    return this.getEnvelope().then((envelope) => ({
      schemaVersion: envelope.schemaVersion,
      sourceDeviceId: envelope.settings.deviceId,
      sourceRevision: envelope.sync.localRevision,
      data: clone(envelope.data),
    }))
  }

  setActiveTab(activeTab) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      const next = {
        ...envelope,
        settings: { ...envelope.settings, activeTab },
      }
      return this.writeEnvelope(next)
    })
  }

  bindUser(userId) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      const boundUserId = envelope.settings.boundUserId
      if (boundUserId && boundUserId !== userId) {
        throw new AccountBindingError(boundUserId, userId)
      }
      if (boundUserId === userId) return envelope
      return this.writeEnvelope({
        ...envelope,
        settings: { ...envelope.settings, boundUserId: userId },
      })
    })
  }

  assertAccountBinding(userId) {
    return this.getEnvelope().then((envelope) => {
      const boundUserId = envelope.settings.boundUserId
      if (boundUserId && boundUserId !== userId) {
        throw new AccountBindingError(boundUserId, userId)
      }
      return { bound: boundUserId === userId, boundUserId }
    })
  }

  clearAndRebind(userId) {
    return this.enqueue(async () => {
      const envelope = await this.readOrCreate()
      const next = nextBusinessEnvelope(envelope, {
        companies: [],
        applications: [],
      })
      next.settings = { ...next.settings, boundUserId: userId }
      next.sync.lastSyncedRevision = 0
      next.sync.lastSyncedAt = null
      next.sync.lastError = null
      next.sync.status = 'dirty'
      return this.writeEnvelope(next)
    })
  }
}
