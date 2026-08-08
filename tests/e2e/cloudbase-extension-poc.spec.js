import { readFileSync } from 'node:fs'
import { chromium, expect, test } from '@playwright/test'

const credentialsPath = new URL('../.cloudbase-poc.json', import.meta.url)
let credentials = null

try {
  credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'))
} catch {
  // The committed suite skips this integration case unless temporary QA credentials exist.
}

test('extension service worker keeps formal CloudBase auth and snapshot sync', async ({ page: unusedPage }, testInfo) => {
  test.skip(!credentials, 'CloudBase PoC credentials are not available')
  test.setTimeout(90_000)
  await unusedPage.close()

  const extensionPath = new URL('../../apps/extension/dist', import.meta.url).pathname.slice(1)
  const context = await chromium.launchPersistentContext(testInfo.outputPath('user-data'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })

  try {
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker')
    const extensionId = new URL(serviceWorker.url()).host

    const openExtensionPage = async () => {
      const page = await context.newPage()
      await page.goto(`chrome-extension://${extensionId}/index.html`)
      return page
    }
    const send = (page, message) => page.evaluate(
      (payload) => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`消息 ${payload.action} 响应超时`)), 20_000)
        chrome.runtime.sendMessage(payload, (response) => {
          clearTimeout(timeoutId)
          const runtimeError = chrome.runtime.lastError
          if (runtimeError) reject(new Error(runtimeError.message))
          else resolve(response)
        })
      }),
      message,
    )

    let page = await openExtensionPage()
    const loginA = await send(page, { action: 'authSignIn', credentials: credentials.a })
    expect(loginA.ok, loginA.error?.message).toBe(true)
    const userA = loginA.data.session.userId

    const sessionA = await send(page, { action: 'authGetSession' })
    expect(sessionA.data.session).toEqual({ userId: userA })

    const syncA = await send(page, { action: 'syncNow' })
    expect(syncA.ok, syncA.error?.message).toBe(true)
    expect(syncA.data.sync.status).toBe('synced')
    await page.close()

    await expect.poll(async () => {
      page = await openExtensionPage()
      const result = await send(page, { action: 'authGetSession' })
      await page.close()
      return result.data?.envelope?.sync?.status
    }, { timeout: 20_000 }).toBe('synced')

    page = await openExtensionPage()
    const sessionAfterClose = await send(page, { action: 'authGetSession' })
    expect(sessionAfterClose.data.session).toEqual({ userId: userA })
    await send(page, { action: 'authSignOut' })

    const loginB = await send(page, { action: 'authSignIn', credentials: credentials.b })
    expect(loginB.ok, loginB.error?.message).toBe(true)
    const userB = loginB.data.session.userId
    expect(userB).not.toBe(userA)
    expect(loginB.data.sync.status).toBe('accountMismatch')

    const rebound = await send(page, { action: 'syncClearAndRebind' })
    expect(rebound.ok, rebound.error?.message).toBe(true)
    expect(rebound.data.envelope.settings.boundUserId).toBe(userB)
    await send(page, { action: 'snapshotRemoveOwn' })
    await send(page, { action: 'authSignOut' })

    await send(page, { action: 'authSignIn', credentials: credentials.a })
    await send(page, { action: 'snapshotRemoveOwn' })
    await send(page, { action: 'authSignOut' })
  } finally {
    await context.close()
  }
})
