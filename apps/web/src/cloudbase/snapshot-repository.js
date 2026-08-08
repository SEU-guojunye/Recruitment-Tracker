import { cloudbaseApp, cloudbaseDatabase } from './client.js'

const COLLECTION_NAME = 'user_snapshots'

async function callSnapshotFunction(data) {
  const response = await cloudbaseApp.callFunction({
    name: 'recruitmentSnapshot',
    data,
  })
  const result = response?.result || response
  if (!result?.ok) {
    const error = new Error(result?.error?.message || '快照云函数执行失败')
    error.code = result?.error?.code || null
    throw error
  }
  return result.data
}

export class CloudBaseSnapshotRepository {
  constructor(authService) {
    this.authService = authService
    this.collection = cloudbaseDatabase.collection(COLLECTION_NAME)
  }

  async getSnapshot() {
    const { userId } = await this.authService.requireSession()
    return this.getSnapshotForOwner(userId)
  }

  async getSnapshotForOwner(ownerId) {
    const result = await this.collection
      .where({ _id: ownerId, ownerId })
      .limit(1)
      .get()
    return result?.data?.[0] || null
  }

  async replaceSnapshot({ sourceDeviceId, sourceRevision, data }) {
    const { userId } = await this.authService.requireSession()
    const result = await callSnapshotFunction({
      action: 'replaceSnapshot',
      snapshot: { sourceDeviceId, sourceRevision, data },
    })
    if (result.ownerId !== userId || result.sourceRevision !== sourceRevision) {
      throw new Error('快照函数返回的用户或修订号不匹配')
    }
    const saved = await this.getSnapshotForOwner(userId)
    if (!saved || saved.sourceRevision !== sourceRevision) {
      throw new Error('快照写入后回读校验失败')
    }
    return saved
  }

  async probeForeignWrite(ownerId) {
    return callSnapshotFunction({ action: 'probeOwnerScope', ownerId })
  }

  async removeOwnSnapshot() {
    await this.authService.requireSession()
    const result = await callSnapshotFunction({ action: 'removeOwnSnapshot' })
    return Boolean(result.removed)
  }
}
