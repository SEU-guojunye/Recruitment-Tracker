export class ExtensionAuthService {
  constructor(request) {
    this.request = request
  }

  signInWithPassword(credentials) {
    return this.request('signIn', { credentials })
  }

  getSession() {
    return this.request('getSession')
  }

  signOut() {
    return this.request('signOut')
  }
}

export class CloudBaseSnapshotWriter {
  constructor(request) {
    this.request = request
  }

  getSnapshot() {
    return this.request('readSnapshot')
  }

  replaceSnapshot(snapshot, { allowDeviceTakeover = false } = {}) {
    return this.request('replaceSnapshot', { snapshot, allowDeviceTakeover })
  }
}
