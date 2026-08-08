const POC_ALARM = 'recruitment-tracker-poc-sync'
const POC_PENDING_KEY = '__pocPendingSnapshot'
const POC_STATUS_KEY = '__pocSyncStatus'
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

async function sendCloudBaseMessage(action, payload = {}) {
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

async function savePocStatus(status) {
  await chrome.storage.local.set({
    [POC_STATUS_KEY]: {
      ...status,
      recordedAt: new Date().toISOString(),
    },
  })
}

async function runPendingPocSnapshot() {
  const stored = await chrome.storage.local.get(POC_PENDING_KEY)
  const pending = stored[POC_PENDING_KEY]
  if (!pending) return
  await savePocStatus({ state: 'syncing', revision: pending.sourceRevision })
  try {
    const session = await sendCloudBaseMessage('getSession')
    const snapshot = await sendCloudBaseMessage('replaceSnapshot', { snapshot: pending })
    await chrome.storage.local.remove(POC_PENDING_KEY)
    await savePocStatus({
      state: 'synced',
      revision: snapshot.revision,
      userId: session.userId,
    })
  } catch (error) {
    await savePocStatus({ state: 'failed', error: serializeError(error) })
    throw error
  }
}

async function handlePocMessage(message) {
  switch (message?.action) {
    case 'pocSignIn':
      return sendCloudBaseMessage('signIn', { credentials: message.credentials })
    case 'pocGetSession':
      return sendCloudBaseMessage('getSession')
    case 'pocSignOut':
      return sendCloudBaseMessage('signOut')
    case 'pocReplaceSnapshot':
      return sendCloudBaseMessage('replaceSnapshot', { snapshot: message.snapshot })
    case 'pocReadSnapshot':
      return sendCloudBaseMessage('readSnapshot', { ownerId: message.ownerId })
    case 'pocProbeForeignWrite':
      return sendCloudBaseMessage('probeForeignWrite', { ownerId: message.ownerId })
    case 'pocScheduleSnapshot':
      await chrome.storage.local.set({ [POC_PENDING_KEY]: message.snapshot })
      await savePocStatus({ state: 'scheduled', revision: message.snapshot.sourceRevision })
      await chrome.alarms.create(POC_ALARM, { when: Date.now() + 800 })
      return { scheduled: true }
    case 'pocGetStatus': {
      const stored = await chrome.storage.local.get(POC_STATUS_KEY)
      return stored[POC_STATUS_KEY] || null
    }
    case 'pocRemoveOwnSnapshot':
      return sendCloudBaseMessage('removeOwnSnapshot')
    default:
      throw new Error('未知的 CloudBase PoC 消息')
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void restrictStorageAccess()
})

chrome.runtime.onStartup.addListener(() => {
  void restrictStorageAccess()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POC_ALARM) void runPendingPocSnapshot()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target === OFFSCREEN_TARGET) return false

  handlePocMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: serializeError(error) }))
  return true
})

void restrictStorageAccess()
