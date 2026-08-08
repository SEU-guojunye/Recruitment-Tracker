const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024

class SnapshotFunctionError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SnapshotFunctionError'
    this.code = code
  }
}

function assertSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new SnapshotFunctionError('INVALID_SNAPSHOT', '快照不能为空')
  }
  if (
    typeof snapshot.sourceDeviceId !== 'string' ||
    snapshot.sourceDeviceId.length < 1 ||
    snapshot.sourceDeviceId.length > 200 ||
    !Number.isSafeInteger(snapshot.sourceRevision) ||
    snapshot.sourceRevision < 0
  ) {
    throw new SnapshotFunctionError('INVALID_SNAPSHOT', '快照缺少设备 ID 或有效修订号')
  }
  if (!snapshot.data || !Array.isArray(snapshot.data.companies) || !Array.isArray(snapshot.data.applications)) {
    throw new SnapshotFunctionError('INVALID_SNAPSHOT', '快照数据结构无效')
  }
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SNAPSHOT_BYTES) {
    throw new SnapshotFunctionError('SNAPSHOT_TOO_LARGE', '快照超过 8 MiB 限制')
  }
}

function createSnapshotHandler({ getUserId, getSnapshot, replaceSnapshot, removeSnapshot }) {
  return async function handleSnapshotRequest(event = {}) {
    const userId = getUserId()
    if (!userId) throw new SnapshotFunctionError('UNAUTHENTICATED', '未取得真实 CloudBase 用户身份')

    switch (event.action) {
      case 'replaceSnapshot': {
        assertSnapshot(event.snapshot)
        const current = await getSnapshot(userId)
        if (
          current?.sourceDeviceId &&
          current.sourceDeviceId !== event.snapshot.sourceDeviceId &&
          event.allowDeviceTakeover !== true
        ) {
          throw new SnapshotFunctionError(
            'DEVICE_CONFLICT',
            '云端快照已绑定另一台编辑设备，需要明确接管后才能覆盖',
          )
        }
        if (
          current?.sourceDeviceId === event.snapshot.sourceDeviceId &&
          current.sourceRevision > event.snapshot.sourceRevision
        ) {
          throw new SnapshotFunctionError(
            'STALE_SNAPSHOT_REVISION',
            '本地快照修订号早于云端，已拒绝回退覆盖',
          )
        }
        const saved = await replaceSnapshot(userId, event.snapshot)
        return {
          ownerId: userId,
          sourceDeviceId: saved.sourceDeviceId,
          sourceRevision: saved.sourceRevision,
        }
      }
      case 'removeOwnSnapshot':
        return { removed: await removeSnapshot(userId) }
      case 'probeOwnerScope':
        if (event.ownerId !== userId) {
          throw new SnapshotFunctionError('ACCOUNT_SCOPE_VIOLATION', '不能写入其他账号的快照')
        }
        return { ownerId: userId }
      default:
        throw new SnapshotFunctionError('UNKNOWN_ACTION', '未知的快照操作')
    }
  }
}

module.exports = {
  MAX_SNAPSHOT_BYTES,
  SnapshotFunctionError,
  assertSnapshot,
  createSnapshotHandler,
}
