import { readFileSync } from 'node:fs'
import { chromium, expect, test } from '@playwright/test'

const credentialsPath = new URL('../.cloudbase-poc.json', import.meta.url)
let credentials = null

try {
  credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'))
} catch {
  // The committed suite skips this integration case unless temporary QA credentials exist.
}

test('extension service worker keeps CloudBase auth and enforces snapshot isolation', async ({ page: unusedPage }, testInfo) => {
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
    const loginA = await send(page, { action: 'pocSignIn', credentials: credentials.a })
    expect(loginA.ok, loginA.error?.message).toBe(true)
    const userA = loginA.data.userId

    const sessionA = await send(page, { action: 'pocGetSession' })
    expect(sessionA).toEqual({ ok: true, data: { userId: userA } })

    const createA = await send(page, {
      action: 'pocReplaceSnapshot',
      snapshot: {
        sourceDeviceId: 'poc-device-a',
        sourceRevision: 1,
        data: { companies: [], applications: [] },
      },
    })
    expect(createA).toEqual({ ok: true, data: { userId: userA, revision: 1 } })

    const updateA = await send(page, {
      action: 'pocReplaceSnapshot',
      snapshot: {
        sourceDeviceId: 'poc-device-a',
        sourceRevision: 2,
        data: { companies: [{ id: 'poc-company' }], applications: [] },
      },
    })
    expect(updateA).toEqual({ ok: true, data: { userId: userA, revision: 2 } })

    const scheduled = await send(page, {
      action: 'pocScheduleSnapshot',
      snapshot: {
        sourceDeviceId: 'poc-device-a',
        sourceRevision: 3,
        data: { companies: [{ id: 'poc-company' }], applications: [{ id: 'poc-app' }] },
      },
    })
    expect(scheduled.ok).toBe(true)
    await page.close()

    await expect.poll(async () => {
      page = await openExtensionPage()
      const result = await send(page, { action: 'pocGetStatus' })
      await page.close()
      return result.data?.state
    }, { timeout: 20_000 }).toBe('synced')

    page = await openExtensionPage()
    const sessionAfterClose = await send(page, { action: 'pocGetSession' })
    expect(sessionAfterClose).toEqual({ ok: true, data: { userId: userA } })
    await send(page, { action: 'pocSignOut' })

    const loginB = await send(page, { action: 'pocSignIn', credentials: credentials.b })
    expect(loginB.ok, loginB.error?.message).toBe(true)
    const userB = loginB.data.userId
    expect(userB).not.toBe(userA)

    const foreignRead = await send(page, { action: 'pocReadSnapshot', ownerId: userA })
    expect(foreignRead.ok).toBe(false)
    const foreignWrite = await send(page, { action: 'pocProbeForeignWrite', ownerId: userA })
    expect(foreignWrite.ok).toBe(false)

    const createB = await send(page, {
      action: 'pocReplaceSnapshot',
      snapshot: {
        sourceDeviceId: 'poc-device-b',
        sourceRevision: 1,
        data: { companies: [], applications: [] },
      },
    })
    expect(createB).toEqual({ ok: true, data: { userId: userB, revision: 1 } })
    await send(page, { action: 'pocRemoveOwnSnapshot' })
    await send(page, { action: 'pocSignOut' })

    await send(page, { action: 'pocSignIn', credentials: credentials.a })
    await send(page, { action: 'pocRemoveOwnSnapshot' })
    await send(page, { action: 'pocSignOut' })
  } finally {
    await context.close()
  }
})
