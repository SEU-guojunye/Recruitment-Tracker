import {
  CloudBaseAuthService,
  getSessionUserId,
} from '../cloudbase/auth-service.js'
import { CloudBaseSnapshotWriter } from '../cloudbase/snapshot-writer.js'

const CHANNEL = 'recruitment-tracker-cloudbase'
const parentOrigin = new URLSearchParams(window.location.search).get('parentOrigin')
const PRODUCTION_EXTENSION_ORIGIN = 'chrome-extension://jpmabplkjdmlfjpllogjaieehdohkndg'
const configuredParentOrigins = (String(
  import.meta.env.VITE_CLOUDBASE_EXTENSION_ORIGINS || '',
).split(',').map((origin) => origin.trim()).filter(Boolean))
if (import.meta.env.PROD && configuredParentOrigins.length === 0) {
  configuredParentOrigins.push(PRODUCTION_EXTENSION_ORIGIN)
}
const authService = new CloudBaseAuthService()
const snapshotRepository = new CloudBaseSnapshotWriter(authService)

const validDevelopmentOrigin = import.meta.env.DEV
  && /^chrome-extension:\/\/[a-p]{32}$/u.test(parentOrigin || '')
if (!configuredParentOrigins.includes(parentOrigin) && !validDevelopmentOrigin) {
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
      const session = await authService.getSession()
      const userId = getSessionUserId(session)
      return userId ? { userId } : null
    }
    case 'signOut':
      await authService.signOut()
      return { signedOut: true }
    case 'replaceSnapshot': {
      const snapshot = await snapshotRepository.replaceSnapshot(payload.snapshot, {
        allowDeviceTakeover: payload.allowDeviceTakeover === true,
      })
      return {
        ownerId: snapshot.ownerId,
        sourceDeviceId: snapshot.sourceDeviceId,
        sourceRevision: snapshot.sourceRevision,
        updatedAt: snapshot.updatedAt,
      }
    }
    case 'readSnapshot': {
      const snapshot = await snapshotRepository.getSnapshot()
      return snapshot
        ? {
            ownerId: snapshot.ownerId,
            schemaVersion: snapshot.schemaVersion,
            sourceDeviceId: snapshot.sourceDeviceId,
            sourceRevision: snapshot.sourceRevision,
            updatedAt: snapshot.updatedAt,
          }
        : null
    }
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
