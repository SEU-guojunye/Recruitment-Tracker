import {
  ChromeLocalRepository,
  SyncCoordinator,
  createCompanyRecord,
} from '@recruitment-tracker/core'
import { describe, expect, it, vi } from 'vitest'

const NOW = new Date('2026-08-08T10:00:00.000Z')

class FakeStorageArea {
  constructor() {
    this.values = {}
  }

  async get(key) {
    return key in this.values ? { [key]: structuredClone(this.values[key]) } : {}
  }

  async set(values) {
    Object.assign(this.values, structuredClone(values))
  }
}

function createRepository() {
  return new ChromeLocalRepository({
    storageArea: new FakeStorageArea(),
    idFactory: () => 'device-a',
    today: '2026-08-08',
  })
}

async function createDirtyRepository() {
  const repository = createRepository()
  await repository.saveCompany(createCompanyRecord(
    { id: 'company-a', companyName: '同步公司' },
    { now: NOW },
  ))
  return repository
}

function setup(repository, {
  session = { userId: 'user-a' },
  remote = null,
  replaceSnapshot,
} = {}) {
  const authService = { getSession: vi.fn().mockResolvedValue(session) }
  const snapshotWriter = {
    getSnapshot: vi.fn().mockResolvedValue(remote),
    replaceSnapshot: replaceSnapshot || vi.fn().mockResolvedValue({ sourceRevision: 1 }),
  }
  const scheduler = { schedule: vi.fn().mockResolvedValue(undefined) }
  const coordinator = new SyncCoordinator({
    repository,
    authService,
    snapshotWriter,
    scheduler,
    now: () => NOW,
  })
  return { coordinator, authService, snapshotWriter, scheduler }
}

describe('SyncCoordinator', () => {
  it('uploads the full local snapshot, binds the account and marks the revision synced', async () => {
    const repository = await createDirtyRepository()
    const { coordinator, snapshotWriter } = setup(repository)
    await expect(coordinator.synchronize()).resolves.toMatchObject({
      status: 'synced',
      sourceRevision: 1,
      userId: 'user-a',
    })
    expect(snapshotWriter.replaceSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      sourceDeviceId: 'device-device-a',
      sourceRevision: 1,
      data: await repository.getData(),
    }, { allowDeviceTakeover: false })
    expect(await repository.getEnvelope()).toMatchObject({
      settings: { boundUserId: 'user-a' },
      sync: {
        status: 'synced',
        dirty: false,
        lastSyncedRevision: 1,
        lastSyncedAt: NOW.toISOString(),
      },
    })
  })

  it('keeps local data dirty when signed out and never contacts the writer', async () => {
    const repository = await createDirtyRepository()
    const { coordinator, snapshotWriter } = setup(repository, { session: null })
    await expect(coordinator.synchronize()).resolves.toMatchObject({ status: 'signedOut' })
    expect(snapshotWriter.getSnapshot).not.toHaveBeenCalled()
    expect(await repository.getEnvelope()).toMatchObject({
      sync: { status: 'signedOut', dirty: true, localRevision: 1 },
    })
  })

  it('blocks a mismatched account before any cloud read or write', async () => {
    const repository = await createDirtyRepository()
    await repository.bindUser('user-original')
    const { coordinator, snapshotWriter } = setup(repository, {
      session: { userId: 'user-other' },
    })
    await expect(coordinator.synchronize()).resolves.toMatchObject({
      status: 'accountMismatch',
    })
    expect(snapshotWriter.getSnapshot).not.toHaveBeenCalled()
    expect((await repository.getEnvelope()).settings.boundUserId).toBe('user-original')
  })

  it('requires explicit takeover for a snapshot from another device', async () => {
    const repository = await createDirtyRepository()
    const { coordinator, snapshotWriter } = setup(repository, {
      remote: { sourceDeviceId: 'device-b', sourceRevision: 9 },
    })
    await expect(coordinator.synchronize()).resolves.toMatchObject({
      status: 'deviceConflict',
    })
    expect(snapshotWriter.replaceSnapshot).not.toHaveBeenCalled()

    await expect(coordinator.synchronize({ allowDeviceTakeover: true }))
      .resolves.toMatchObject({ status: 'synced' })
    expect(snapshotWriter.replaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDeviceId: 'device-device-a' }),
      { allowDeviceTakeover: true },
    )
  })

  it('persists failures, schedules a retry and coalesces concurrent runs', async () => {
    const repository = await createDirtyRepository()
    let release
    const pending = new Promise((resolve) => {
      release = resolve
    })
    const replaceSnapshot = vi.fn(() => pending.then(() => {
      const error = new Error('网络不可用')
      error.code = 'NETWORK_ERROR'
      throw error
    }))
    const { coordinator, snapshotWriter, scheduler } = setup(repository, { replaceSnapshot })
    const first = coordinator.synchronize()
    const second = coordinator.synchronize()
    release()
    expect(await first).toMatchObject({ status: 'failed' })
    expect(await second).toMatchObject({ status: 'failed' })
    expect(snapshotWriter.replaceSnapshot).toHaveBeenCalledOnce()
    expect(scheduler.schedule).toHaveBeenCalledWith(60_000)
    expect(await repository.getEnvelope()).toMatchObject({
      sync: {
        status: 'failed',
        dirty: true,
        lastError: { code: 'NETWORK_ERROR', message: '网络不可用' },
      },
    })
  })

  it('does not lose an edit made while a snapshot upload is in flight', async () => {
    const repository = await createDirtyRepository()
    let release
    const pending = new Promise((resolve) => {
      release = resolve
    })
    const { coordinator, scheduler } = setup(repository, {
      replaceSnapshot: vi.fn(() => pending),
    })
    const syncing = coordinator.synchronize()
    await vi.waitFor(async () => {
      expect((await repository.getEnvelope()).sync.status).toBe('syncing')
    })
    await repository.saveCompany(createCompanyRecord(
      { id: 'company-b', companyName: '上传期间新增' },
      { now: NOW },
    ))
    release({ sourceRevision: 1 })
    await expect(syncing).resolves.toMatchObject({ status: 'dirty' })
    expect(await repository.getEnvelope()).toMatchObject({
      sync: { localRevision: 2, lastSyncedRevision: 1, dirty: true, status: 'dirty' },
    })
    expect(scheduler.schedule).toHaveBeenCalledWith(0)
  })

  it('resumes a persisted dirty revision after an offline failure and coordinator restart', async () => {
    const repository = await createDirtyRepository()
    const offline = new Error('offline')
    offline.code = 'NETWORK_ERROR'
    const firstSetup = setup(repository, {
      replaceSnapshot: vi.fn().mockRejectedValue(offline),
    })
    await expect(firstSetup.coordinator.synchronize()).resolves.toMatchObject({
      status: 'failed',
    })
    expect((await repository.getEnvelope()).sync.dirty).toBe(true)

    const resumedSetup = setup(repository)
    await expect(resumedSetup.coordinator.resume()).resolves.toMatchObject({
      scheduled: true,
    })
    expect(resumedSetup.scheduler.schedule).toHaveBeenCalledWith(0)
    await expect(resumedSetup.coordinator.synchronize()).resolves.toMatchObject({
      status: 'synced',
    })
    expect(await repository.getEnvelope()).toMatchObject({
      sync: { dirty: false, status: 'synced', lastSyncedRevision: 1 },
    })
  })
})
