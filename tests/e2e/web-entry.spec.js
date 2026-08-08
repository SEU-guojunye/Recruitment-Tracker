import { expect, test } from '@playwright/test'

test('web entry renders the readonly shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Recruitment Tracker')).toBeVisible()
  await expect(page.getByText('手机只读模式')).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的投递' })).toBeVisible()
  await expect(page.getByLabel('招聘进度：当前为技术一面')).toBeVisible()
})

for (const width of [320, 390, 1200]) {
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

test('timeline changes from horizontal to vertical without hiding core information', async ({ page }) => {
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
  expect(mobileColumns).toBe(1)
  await expect(page.locator('.rt-timeline__name', { hasText: '技术一面' })).toBeVisible()
  await expect(page.locator('.rt-timeline__date', { hasText: '2026.08.08' })).toBeVisible()
})
