import { CloudBaseAuthService } from '../cloudbase/auth-service.js'
import { CloudBaseSnapshotRepository } from '../cloudbase/snapshot-repository.js'

const CHANNEL = 'recruitment-tracker-cloudbase'
const parentOrigin = new URLSearchParams(window.location.search).get('parentOrigin')
const authService = new CloudBaseAuthService()
const snapshotRepository = new CloudBaseSnapshotRepository(authService)

if (!parentOrigin?.startsWith('chrome-extension://')) {
  throw new Error('CloudBase 桥接页缺少有效扩展来源')
}

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
  }
}

async function handleRequest(action, payload = {}) {
  switch (action) {
    case 'signIn': {
      const { userId } = await authService.signInWithPassword(payload.credentials)
      return { userId }
    }
    case 'getSession': {
      const { userId } = await authService.requireSession()
      return { userId }
    }
    case 'signOut':
      await authService.signOut()
      return { signedOut: true }
    case 'replaceSnapshot': {
      const snapshot = await snapshotRepository.replaceSnapshot(payload.snapshot)
      return { userId: snapshot.ownerId, revision: snapshot.sourceRevision }
    }
    case 'readSnapshot': {
      const snapshot = payload.ownerId
        ? await snapshotRepository.getSnapshotForOwner(payload.ownerId)
        : await snapshotRepository.getSnapshot()
      return snapshot
        ? { ownerId: snapshot.ownerId, revision: snapshot.sourceRevision }
        : null
    }
    case 'probeForeignWrite':
      await snapshotRepository.probeForeignWrite(payload.ownerId)
      return { unexpectedlyAllowed: true }
    case 'removeOwnSnapshot':
      return { removed: await snapshotRepository.removeOwnSnapshot() }
    default:
      throw new Error('未知的 CloudBase 桥接请求')
  }
}

window.addEventListener('message', (event) => {
  const message = event.data
  if (event.source !== window.parent || event.origin !== parentOrigin) return
  if (message?.channel !== CHANNEL || message.type !== 'request') return

  handleRequest(message.action, message.payload)
    .then((data) => window.parent.postMessage({
      channel: CHANNEL,
      type: 'response',
      requestId: message.requestId,
      ok: true,
      data,
    }, parentOrigin))
    .catch((error) => window.parent.postMessage({
      channel: CHANNEL,
      type: 'response',
      requestId: message.requestId,
      ok: false,
      error: serializeError(error),
    }, parentOrigin))
})

window.parent.postMessage({ channel: CHANNEL, type: 'ready' }, parentOrigin)
