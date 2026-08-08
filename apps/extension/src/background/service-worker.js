import {
  ChromeLocalRepository,
  LOCAL_ENVELOPE_KEY,
  SyncCoordinator,
} from '@recruitment-tracker/core'
import {
  CloudBaseSnapshotWriter,
  ExtensionAuthService,
} from '../cloudbase/services.js'

const SYNC_ALARM = 'recruitment-tracker-sync'
const OFFSCREEN_TARGET = 'cloudbase-offscreen'
const OFFSCREEN_PATH = 'offscreen.html'

let creatingOffscreenDocument = null

async function restrictStorageAccess() {
  if (chrome.storage?.local?.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  }
}

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
  }
}

async function ensureOffscreenDocument() {
  const documentUrl = chrome.runtime.getURL(OFFSCREEN_PATH)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [documentUrl],
  })
  if (contexts.length > 0) return

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['IFRAME_SCRIPTING'],
      justification: 'Use the trusted hosted Web origin for CloudBase authentication and snapshot sync.',
    }).finally(() => {
      creatingOffscreenDocument = null
    })
  }
  await creatingOffscreenDocument
}

async function requestHostedBridge(action, payload = {}) {
  await ensureOffscreenDocument()
  const response = await chrome.runtime.sendMessage({
    action,
    payload,
    target: OFFSCREEN_TARGET,
  })
  if (!response) throw new Error('CloudBase offscreen 文档未响应')
  if (!response.ok) {
    const error = new Error(response.error?.message || 'CloudBase 操作失败')
    error.name = response.error?.name || 'Error'
    error.code = response.error?.code || null
    throw error
  }
  return response.data
}

const repository = new ChromeLocalRepository()
const authService = new ExtensionAuthService(requestHostedBridge)
const snapshotWriter = new CloudBaseSnapshotWriter(requestHostedBridge)
const scheduler = {
  schedule(delayMs) {
    return chrome.alarms.create(SYNC_ALARM, {
      when: Date.now() + Math.max(0, delayMs),
    })
  },
}
const syncCoordinator = new SyncCoordinator({
  repository,
  authService,
  snapshotWriter,
  scheduler,
})

async function sessionState() {
  const session = await authService.getSession()
  let envelope = await repository.getEnvelope()
  if (!session?.userId) {
    envelope = await repository.markSyncBlocked('signedOut', {
      code: 'UNAUTHENTICATED',
      message: '当前未登录 CloudBase',
    })
    return { session: null, envelope }
  }

  if (
    envelope.settings.boundUserId &&
    envelope.settings.boundUserId !== session.userId
  ) {
    envelope = await repository.markSyncBlocked('accountMismatch', {
      code: 'ACCOUNT_MISMATCH',
      message: '登录账号与本地数据绑定账号不一致',
      boundUserId: envelope.settings.boundUserId,
      requestedUserId: session.userId,
    })
  } else if (envelope.sync.status === 'signedOut') {
    envelope = await repository.setSyncState(
      envelope.sync.dirty
        ? 'dirty'
        : envelope.sync.lastSyncedAt
          ? 'synced'
          : 'idle',
    )
    if (envelope.sync.dirty) await syncCoordinator.schedulePending(0)
  }
  return { session, envelope }
}

async function handleMessage(message) {
  switch (message?.action) {
    case 'authSignIn': {
      const session = await authService.signInWithPassword(message.credentials)
      const sync = await syncCoordinator.synchronize()
      return { session, sync, envelope: await repository.getEnvelope() }
    }
    case 'authGetSession':
      return sessionState()
    case 'authSignOut':
      await authService.signOut()
      return {
        signedOut: true,
        envelope: await repository.markSyncBlocked('signedOut', {
          code: 'UNAUTHENTICATED',
          message: '已退出 CloudBase，同步已暂停',
        }),
      }
    case 'syncNow':
      return {
        sync: await syncCoordinator.synchronize(),
        envelope: await repository.getEnvelope(),
      }
    case 'syncTakeover':
      return {
        sync: await syncCoordinator.synchronize({ allowDeviceTakeover: true }),
        envelope: await repository.getEnvelope(),
      }
    case 'syncClearAndRebind': {
      const session = await authService.getSession()
      if (!session?.userId) {
        const error = new Error('登录已过期，请重新登录')
        error.code = 'UNAUTHENTICATED'
        throw error
      }
      await repository.clearAndRebind(session.userId)
      return {
        sync: await syncCoordinator.synchronize(),
        envelope: await repository.getEnvelope(),
      }
    }
    case 'snapshotRemoveOwn':
      return requestHostedBridge('removeOwnSnapshot')
    default:
      throw new Error('未知的扩展同步消息')
  }
}

function runScheduledSync() {
  void syncCoordinator.synchronize()
}

chrome.runtime.onInstalled.addListener(() => {
  void restrictStorageAccess()
  void syncCoordinator.resume()
})

chrome.runtime.onStartup.addListener(() => {
  void restrictStorageAccess()
  void syncCoordinator.resume()
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  const envelope = changes[LOCAL_ENVELOPE_KEY]?.newValue
  if (
    areaName === 'local' &&
    envelope?.sync?.dirty &&
    envelope.sync.status === 'dirty'
  ) {
    void syncCoordinator.schedulePending()
  }
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) runScheduledSync()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target === OFFSCREEN_TARGET) return false

  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: serializeError(error) }))
  return true
})

void restrictStorageAccess()
void syncCoordinator.resume()
