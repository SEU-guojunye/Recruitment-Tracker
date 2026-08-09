import { chromium, expect, test } from '@playwright/test'

test('extension dashboard persists local CRUD across page reloads', async ({ page: unusedPage }, testInfo) => {
  test.setTimeout(60_000)
  await unusedPage.close()
  const extensionPath = new URL('../../apps/extension/dist', import.meta.url).pathname.slice(1)
  const userDataDir = testInfo.outputPath('dashboard-user-data')
  const launch = () => chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
  let context = await launch()

  try {
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker')
    const extensionId = new URL(serviceWorker.url()).host
    expect(extensionId).toBe('jpmabplkjdmlfjpllogjaieehdohkndg')
    let page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`)

    await expect(page.getByText('电脑编辑模式')).toBeVisible()
    await page.getByRole('tab', { name: /招聘信息/u }).click()
    await page.getByRole('button', { name: '新增公司' }).click()
    const companyDialog = page.getByRole('dialog', { name: '保存招聘信息' })
    await companyDialog.getByLabel('公司名称').fill('端到端公司')
    await companyDialog.getByLabel('公司招聘链接').fill('https://example.com/careers')
    await companyDialog.getByLabel('行业类型').fill('互联网')
    await companyDialog.getByLabel('招聘批次').selectOption('秋招提前批')
    await companyDialog.getByLabel('优先度').selectOption('P0')
    await companyDialog.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('公司招聘信息已保存')).toBeVisible()

    await page.locator('.rt-recruitment-row').getByRole('button', { name: '投递' }).click()
    await page.getByLabel('工作地点').fill('上海 / 远程')
    await page.getByRole('button', { name: '保存投递' }).click()
    await expect(page.getByText('投递记录已保存')).toBeVisible()
    await page.close()

    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`)
    await expect(page.getByText('端到端公司')).toBeVisible()
    await page.getByRole('tab', { name: /岗位投递/u }).click()
    await page.getByRole('button', { name: '展开端到端公司' }).click()
    await expect(page.getByText('上海 / 远程')).toBeVisible()
    const applicationCard = page.locator('.rt-application-card')
    await expect(applicationCard.getByText('操作', { exact: true })).toBeVisible()
    await expect(applicationCard.getByRole('button', { name: '编辑投递' })).toBeVisible()
    await expect(applicationCard.getByRole('button', { name: '删除' })).toBeVisible()
    await expect(applicationCard.getByRole('combobox', { name: /快速更新当前环节/u })).toHaveCount(0)
    const fontState = await page.evaluate(async () => {
      await document.fonts.ready
      const faces = [...document.fonts].filter((face) => face.family === 'Noto Sans SC Variable')
      return {
        computedFamily: getComputedStyle(document.querySelector('.rt-main')).fontFamily,
        loadedFaces: faces.filter((face) => face.status === 'loaded').length,
      }
    })
    expect(fontState.computedFamily).toContain('Noto Sans SC Variable')
    expect(fontState.loadedFaces).toBeGreaterThan(0)
    await expect(page.locator('.rt-company-list__head')).toHaveCSS('font-weight', '600')
    await expect(applicationCard.locator('.rt-application-cell').first().locator('span').first())
      .toHaveCSS('font-weight', '600')
    await page.getByRole('tab', { name: /招聘信息/u }).click()
    await expect(page.locator('.rt-recruitment-list__head')).toHaveCSS('font-weight', '600')
    await page.getByRole('tab', { name: /岗位投递/u }).click()
    await expect(page.locator('.rt-company-logo img')).toHaveAttribute('src', /sz=128$/u)
    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.local.get('recruitmentTrackerEnvelope')
      return result.recruitmentTrackerEnvelope
    })
    expect(stored.sync).toMatchObject({ localRevision: 2, dirty: true })
    expect(stored.data).toMatchObject({
      companies: [{
        companyName: '端到端公司',
        industryType: '互联网',
        recruitmentBatch: '秋招提前批',
        priority: 'P0',
      }],
      applications: [{ workLocation: '上海 / 远程' }],
    })

    await context.close()
    context = await launch()
    serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker')
    expect(new URL(serviceWorker.url()).host).toBe(extensionId)
    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/dashboard.html`)
    await expect(page.getByText('端到端公司')).toBeVisible()
    await page.getByRole('button', { name: '展开端到端公司' }).click()
    await expect(page.getByText('上海 / 远程')).toBeVisible()
  } finally {
    await context.close()
  }
})
