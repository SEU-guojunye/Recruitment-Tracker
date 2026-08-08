const OFFSCREEN_TARGET = 'cloudbase-offscreen'
const BRIDGE_TIMEOUT_MS = 20_000
const bridgeUrl = import.meta.env.VITE_CLOUDBASE_BRIDGE_URL
  || 'http://localhost:5173/extension-bridge.html'
const bridgeOrigin = new URL(bridgeUrl).origin
const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin
const bridgeFrame = document.createElement('iframe')
const pendingRequests = new Map()
let requestCounter = 0
let resolveReady
let rejectReady

const bridgeReady = new Promise((resolve, reject) => {
  resolveReady = resolve
  rejectReady = reject
})
const readyTimeout = setTimeout(() => {
  rejectReady(new Error('CloudBase 托管桥接页加载超时'))
}, BRIDGE_TIMEOUT_MS)

bridgeFrame.hidden = true
bridgeFrame.src = `${bridgeUrl}?parentOrigin=${encodeURIComponent(extensionOrigin)}`
document.body.append(bridgeFrame)

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== bridgeFrame.contentWindow || event.origin !== bridgeOrigin) return
  const message = event.data
  if (message?.channel !== 'recruitment-tracker-cloudbase') return
  if (message.type === 'ready') {
    clearTimeout(readyTimeout)
    resolveReady()
    return
  }
  if (message.type !== 'response' || !message.requestId) return
  const pending = pendingRequests.get(message.requestId)
  if (!pending) return
  pendingRequests.delete(message.requestId)
  clearTimeout(pending.timeoutId)
  if (message.ok) pending.resolve(message.data)
  else {
    const error = new Error(message.error?.message || 'CloudBase 托管桥接请求失败')
    error.name = message.error?.name || 'Error'
    error.code = message.error?.code || null
    pending.reject(error)
  }
})

async function requestBridge(action, payload = {}) {
  await bridgeReady
  const requestId = `bridge-${Date.now()}-${requestCounter += 1}`
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`CloudBase 托管桥接请求超时：${action}`))
    }, BRIDGE_TIMEOUT_MS)
    pendingRequests.set(requestId, { resolve, reject, timeoutId })
    bridgeFrame.contentWindow.postMessage({
      channel: 'recruitment-tracker-cloudbase',
      type: 'request',
      requestId,
      action,
      payload,
    }, bridgeOrigin)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== OFFSCREEN_TARGET) return false

  requestBridge(message.action, message.payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: serializeError(error) }))
  return true
})
