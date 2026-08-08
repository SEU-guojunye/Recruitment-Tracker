import { expect, test } from '@playwright/test'

test('web entry renders the readonly shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Recruitment Tracker' })).toBeVisible()
  await expect(page.getByText('手机只读模式')).toBeVisible()
})
