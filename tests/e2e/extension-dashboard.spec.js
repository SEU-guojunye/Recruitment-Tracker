import { chromium, expect, test } from '@playwright/test'

test('extension dashboard persists local CRUD across page reloads', async ({ page: unusedPage }, testInfo) => {
  test.setTimeout(60_000)
  await unusedPage.close()
  const extensionPath = new URL('../../apps/extension/dist', import.meta.url).pathname.slice(1)
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('dashboard-user-data'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  )

  try {
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker')
    const extensionId = new URL(serviceWorker.url()).host
    let page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`)

    await expect(page.getByText('电脑编辑模式')).toBeVisible()
    await page.getByRole('button', { name: '＋ 招聘信息' }).click()
    await page.getByLabel('公司名称').fill('端到端公司')
    await page.getByLabel('公司招聘链接').fill('https://example.com/careers')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('公司招聘信息已保存')).toBeVisible()

    await page.getByRole('button', { name: '＋ 新增投递' }).click()
    await page.getByLabel('工作地点').fill('上海 / 远程')
    await page.getByRole('button', { name: '保存投递' }).click()
    await expect(page.getByText('投递记录已保存')).toBeVisible()
    await page.close()

    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`)
    await expect(page.getByText('端到端公司')).toBeVisible()
    await page.getByRole('button', { name: '展开端到端公司' }).click()
    await expect(page.getByText('上海 / 远程')).toBeVisible()
    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.local.get('recruitmentTrackerEnvelope')
      return result.recruitmentTrackerEnvelope
    })
    expect(stored.sync).toMatchObject({ localRevision: 2, dirty: true })
    expect(stored.data).toMatchObject({
      companies: [{ companyName: '端到端公司' }],
      applications: [{ workLocation: '上海 / 远程' }],
    })
  } finally {
    await context.close()
  }
})
