function errorDetail(error) {
  return {
    code: error?.code || 'SYNC_FAILED',
    message: error?.message || '同步失败',
  }
}

function sessionUserId(session) {
  return session?.userId || session?.user?.id || session?.user?.uid || null
}

const BLOCKING_STATUSES = new Set([
  'signedOut',
  'accountMismatch',
  'deviceConflict',
])

export class SyncCoordinator {
  constructor({
    repository,
    authService,
    snapshotWriter,
    scheduler,
    now = () => new Date(),
    debounceMs = 1500,
    retryDelayMs = 60_000,
  }) {
    this.repository = repository
    this.authService = authService
    this.snapshotWriter = snapshotWriter
    this.scheduler = scheduler
    this.now = now
    this.debounceMs = debounceMs
    this.retryDelayMs = retryDelayMs
    this.running = null
  }

  async schedulePending(delayMs = this.debounceMs) {
    const envelope = await this.repository.getEnvelope()
    if (!envelope.sync.dirty || BLOCKING_STATUSES.has(envelope.sync.status)) {
      return { scheduled: false, status: envelope.sync.status }
    }
    await this.scheduler.schedule(delayMs)
    return { scheduled: true, status: envelope.sync.status }
  }

  resume() {
    return this.schedulePending(0)
  }

  synchronize(options = {}) {
    if (this.running) return this.running
    this.running = this.performSynchronization(options).finally(() => {
      this.running = null
    })
    return this.running
  }

  async fail(error) {
    const detail = errorDetail(error)
    await this.repository.markSyncFailed(detail)
    await this.scheduler.schedule(this.retryDelayMs)
    return { status: 'failed', error: detail }
  }

  async performSynchronization({ allowDeviceTakeover = false } = {}) {
    let session
    try {
      session = await this.authService.getSession()
    } catch (error) {
      if (error?.code === 'UNAUTHENTICATED') session = null
      else return this.fail(error)
    }

    const userId = sessionUserId(session)
    if (!userId) {
      const error = { code: 'UNAUTHENTICATED', message: '登录已过期，请重新登录' }
      await this.repository.markSyncBlocked('signedOut', error)
      return { status: 'signedOut', error }
    }

    const envelope = await this.repository.getEnvelope()
    const boundUserId = envelope.settings.boundUserId
    if (boundUserId && boundUserId !== userId) {
      const error = {
        code: 'ACCOUNT_MISMATCH',
        message: '当前本地数据已绑定其他账号',
        boundUserId,
        requestedUserId: userId,
      }
      await this.repository.markSyncBlocked('accountMismatch', error)
      return { status: 'accountMismatch', error }
    }

    await this.repository.markSyncing()
    try {
      const remote = await this.snapshotWriter.getSnapshot()
      if (
        remote?.sourceDeviceId &&
        remote.sourceDeviceId !== envelope.settings.deviceId &&
        !allowDeviceTakeover
      ) {
        const error = {
          code: 'DEVICE_CONFLICT',
          message: '云端快照来自另一台编辑设备',
          sourceDeviceId: remote.sourceDeviceId,
        }
        await this.repository.markSyncBlocked('deviceConflict', error)
        return { status: 'deviceConflict', error }
      }

      const snapshot = await this.repository.exportSnapshot()
      await this.snapshotWriter.replaceSnapshot(snapshot, { allowDeviceTakeover })
      const syncedAt = this.now().toISOString()
      const savedEnvelope = await this.repository.markSynced({
        sourceRevision: snapshot.sourceRevision,
        syncedAt,
        userId,
      })
      if (savedEnvelope.sync.dirty) await this.scheduler.schedule(0)
      return {
        status: savedEnvelope.sync.status,
        sourceRevision: snapshot.sourceRevision,
        syncedAt,
        userId,
      }
    } catch (error) {
      if (error?.code === 'DEVICE_CONFLICT') {
        const detail = errorDetail(error)
        await this.repository.markSyncBlocked('deviceConflict', detail)
        return { status: 'deviceConflict', error: detail }
      }
      if (error?.code === 'UNAUTHENTICATED') {
        const detail = errorDetail(error)
        await this.repository.markSyncBlocked('signedOut', detail)
        return { status: 'signedOut', error: detail }
      }
      return this.fail(error)
    }
  }
}
