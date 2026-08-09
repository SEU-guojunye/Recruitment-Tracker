import { expect, test } from '@playwright/test'
import { READONLY_SNAPSHOT } from '../fixtures/readonly-snapshot.js'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((snapshot) => {
    window.__RECRUITMENT_TRACKER_TEST_SERVICES__ = {
      authService: {
        getSession: async () => ({ user: { id: 'readonly-user' } }),
        signInWithPassword: async () => ({
          session: { user: { id: 'readonly-user' } },
          userId: 'readonly-user',
        }),
        signOut: async () => {},
      },
      snapshotReader: { getSnapshot: async () => snapshot },
    }
  }, READONLY_SNAPSHOT)
})

test('web entry renders the readonly shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('手机只读模式')).toBeVisible()
  await expect(page.getByRole('heading', { name: '岗位投递' })).toBeVisible()
  await expect(page.getByLabel('招聘进度：当前为技术一面')).toBeVisible()
})

for (const width of [320, 360, 390, 430, 1200]) {
  test(`readonly dashboard has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
  })
}

test('readonly component tree exposes no business write controls', async ({ page }) => {
  await page.goto('/')
  for (const label of ['新增投递', '导入 CSV', '导出 CSV', '编辑进度', '立即同步']) {
    await expect(page.getByRole('button', { name: label })).toHaveCount(0)
  }
})

test('timeline remains horizontal and keeps core information visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('/')
  const desktopColumns = await page.locator('.rt-timeline').first().evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )
  expect(desktopColumns).toBe(6)

  await page.setViewportSize({ width: 390, height: 900 })
  const mobileColumns = await page.locator('.rt-timeline').first().evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )
  expect(mobileColumns).toBe(6)
  await expect(page.locator('.rt-timeline__name', { hasText: '技术一面' })).toBeVisible()
  await expect(page.locator('[aria-current="step"]')).toContainText('技术一面')
})
