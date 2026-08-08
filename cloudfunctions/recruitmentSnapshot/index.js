const cloudbase = require('@cloudbase/node-sdk')
const { createSnapshotHandler } = require('./snapshot-handler')

const app = cloudbase.init({ env: process.env.TCB_ENV })
const auth = app.auth()
const database = app.database()
const snapshots = database.collection('user_snapshots')

const handleSnapshotRequest = createSnapshotHandler({
  getUserId() {
    return auth.getUserInfo()?.uid || null
  },
  async replaceSnapshot(userId, snapshot) {
    const document = {
      ownerId: userId,
      schemaVersion: 1,
      sourceDeviceId: snapshot.sourceDeviceId,
      sourceRevision: snapshot.sourceRevision,
      data: snapshot.data,
      updatedAt: database.serverDate(),
    }
    await snapshots.doc(userId).set(document)
    return document
  },
  async removeSnapshot(userId) {
    const result = await snapshots.doc(userId).remove()
    return Number(result?.deleted || 0) > 0
  },
})

exports.main = async (event) => {
  try {
    return { ok: true, data: await handleSnapshotRequest(event) }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error?.code || 'SNAPSHOT_FUNCTION_FAILED',
        message: error?.message || '快照函数执行失败',
      },
    }
  }
}
