function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }
      if (!response) {
        reject(new Error('扩展同步服务未响应'))
        return
      }
      if (!response.ok) {
        const error = new Error(response.error?.message || '扩展同步操作失败')
        error.name = response.error?.name || 'Error'
        error.code = response.error?.code || null
        reject(error)
        return
      }
      resolve(response.data)
    })
  })
}

export class ExtensionSyncClient {
  constructor(request = sendRuntimeMessage) {
    this.request = request
  }

  getSession() {
    return this.request({ action: 'authGetSession' })
  }

  signIn(credentials) {
    return this.request({ action: 'authSignIn', credentials })
  }

  signOut() {
    return this.request({ action: 'authSignOut' })
  }

  syncNow() {
    return this.request({ action: 'syncNow' })
  }

  takeOverDevice() {
    return this.request({ action: 'syncTakeover' })
  }

  clearAndRebind() {
    return this.request({ action: 'syncClearAndRebind' })
  }
}
