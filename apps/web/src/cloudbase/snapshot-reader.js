import { cloudbaseDatabase } from './client.js'

const COLLECTION_NAME = 'user_snapshots'

export class CloudBaseSnapshotReader {
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
}
