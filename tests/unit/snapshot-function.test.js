import handlerModule from '../../cloudfunctions/recruitmentSnapshot/snapshot-handler.js'
import { describe, expect, it, vi } from 'vitest'

const { createSnapshotHandler } = handlerModule

function validSnapshot(revision = 1) {
  return {
    sourceDeviceId: 'test-device',
    sourceRevision: revision,
    data: { companies: [], applications: [] },
  }
}

describe('recruitmentSnapshot event function', () => {
  it('derives owner from the trusted caller and ignores client ownership', async () => {
    const replaceSnapshot = vi.fn(async (userId, snapshot) => ({
      ownerId: userId,
      sourceRevision: snapshot.sourceRevision,
    }))
    const handler = createSnapshotHandler({
      getUserId: () => 'user-a',
      replaceSnapshot,
      removeSnapshot: vi.fn(),
    })

    await expect(handler({
      action: 'replaceSnapshot',
      ownerId: 'user-b',
      snapshot: validSnapshot(7),
    })).resolves.toEqual({ ownerId: 'user-a', sourceRevision: 7 })
    expect(replaceSnapshot).toHaveBeenCalledWith('user-a', validSnapshot(7))
  })

  it('rejects unauthenticated and cross-account operations', async () => {
    const unauthenticated = createSnapshotHandler({
      getUserId: () => null,
      replaceSnapshot: vi.fn(),
      removeSnapshot: vi.fn(),
    })
    await expect(unauthenticated({ action: 'replaceSnapshot', snapshot: validSnapshot() }))
      .rejects.toMatchObject({ code: 'UNAUTHENTICATED' })

    const authenticated = createSnapshotHandler({
      getUserId: () => 'user-a',
      replaceSnapshot: vi.fn(),
      removeSnapshot: vi.fn(),
    })
    await expect(authenticated({ action: 'probeOwnerScope', ownerId: 'user-b' }))
      .rejects.toMatchObject({ code: 'ACCOUNT_SCOPE_VIOLATION' })
  })

  it('validates structure before any database write', async () => {
    const replaceSnapshot = vi.fn()
    const handler = createSnapshotHandler({
      getUserId: () => 'user-a',
      replaceSnapshot,
      removeSnapshot: vi.fn(),
    })
    await expect(handler({ action: 'replaceSnapshot', snapshot: { sourceRevision: 1 } }))
      .rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' })
    expect(replaceSnapshot).not.toHaveBeenCalled()
  })
})
