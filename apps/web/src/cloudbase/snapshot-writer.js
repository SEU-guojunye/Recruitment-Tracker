import { cloudbaseApp } from './client.js'
import { CloudBaseSnapshotReader } from './snapshot-reader.js'

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

export class CloudBaseSnapshotWriter extends CloudBaseSnapshotReader {
  async replaceSnapshot(
    { sourceDeviceId, sourceRevision, data },
    { allowDeviceTakeover = false } = {},
  ) {
    const { userId } = await this.authService.requireSession()
    const result = await callSnapshotFunction({
      action: 'replaceSnapshot',
      allowDeviceTakeover,
      snapshot: { sourceDeviceId, sourceRevision, data },
    })
    if (
      result.ownerId !== userId ||
      result.sourceDeviceId !== sourceDeviceId ||
      result.sourceRevision !== sourceRevision
    ) {
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
