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

test('company logo falls back after every external icon API fails', async ({ page }) => {
  await page.route('https://a.favicon.im/**', (route) => route.fulfill({ status: 404, body: '' }))
  await page.route('https://ico.faviconkit.net/**', (route) => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')

  const logo = page.locator('.rt-company-identity', { hasText: '极光科技' })
    .first()
    .locator('.rt-company-logo')
  await expect(logo.locator(':scope > span')).toHaveText('极')
  await expect(logo.locator('img')).toHaveCount(0)
  await expect(logo).not.toHaveClass(/is-loaded/u)
  await expect(logo).toHaveCSS('background-color', 'rgb(242, 243, 255)')
  await expect(logo).toHaveCSS('color', 'rgb(0, 82, 217)')
  await expect(logo).toHaveCSS('border-radius', '6px')
  await expect(logo).toHaveCSS('font-size', '18px')
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
  await expect(page.locator('.rt-timeline__expand-hint')).toHaveCount(6)
  await expect(page.locator('[aria-current="step"]')).toContainText('技术一面')

  const currentStage = page.getByRole('button', { name: '技术一面：当前，展开详情' })
  await currentStage.press('Enter')
  const detail = page.getByRole('region', { name: '技术一面节点详情' })
  await expect(detail).toContainText('日期')
  await expect(detail).not.toContainText('节点日期')
  await expect(detail).toContainText('2026.08.08')
  await expect(detail).toContainText('技术面试反馈良好')
  await expect(detail.getByRole('link', { name: /meeting\.example\.com\/tech-round/u }))
    .toHaveAttribute('target', '_blank')
  const detailLayout = await detail.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(detailLayout.columns).toBe(1)
  expect(detailLayout.content).toBeLessThanOrEqual(detailLayout.viewport)

  await page.getByRole('button', { name: '技术一面：当前，收起详情' }).press('Space')
  await expect(detail).toHaveCount(0)
})

test('application details keep a stable two-column mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/')

  const layout = await page.locator('.rt-application-info-grid').first().evaluate((grid) => {
    const gridRect = grid.getBoundingClientRect()
    const titleRect = grid.querySelector('.rt-application-cell--title').getBoundingClientRect()
    const metadataRect = grid.querySelector('.rt-application-cell--title + .rt-application-cell')
      .getBoundingClientRect()
    const cellsStayInside = [...grid.children].every((cell) => {
      const rect = cell.getBoundingClientRect()
      return rect.left >= gridRect.left - 1 && rect.right <= gridRect.right + 1
    })
    const columnWidths = getComputedStyle(grid).gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))

    return {
      columnCount: columnWidths.length,
      columnsAreEqual: Math.abs(columnWidths[0] - columnWidths[1]) <= 1,
      columnGap: getComputedStyle(grid).columnGap,
      titleUsesFullRow: Math.abs(titleRect.left - gridRect.left) <= 1
        && Math.abs(titleRect.right - gridRect.right) <= 1,
      metadataStartsBelowTitle: metadataRect.top >= titleRect.bottom,
      cellsStayInside,
    }
  })

  expect(layout).toEqual({
    columnCount: 2,
    columnsAreEqual: true,
    columnGap: '12px',
    titleUsesFullRow: true,
    metadataStartsBelowTitle: true,
    cellsStayInside: true,
  })
})

test('company summary columns are equal and evenly spaced on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/')

  const layout = await page.locator('.rt-company-card.is-open .rt-company-card__head').evaluate((head) => {
    const style = getComputedStyle(head)
    const columnWidths = style.gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))
    const summaryCells = [...head.querySelectorAll('.rt-company-summary-cell')]
      .slice(0, 2)
      .map((cell) => cell.getBoundingClientRect().width)
    const identityRect = head.querySelector('.rt-company-identity').getBoundingClientRect()
    const captionRect = head.parentElement.querySelector('.rt-detail-caption').getBoundingClientRect()

    return {
      columnCount: columnWidths.length,
      contentColumnsAreEqual: Math.abs(columnWidths[1] - columnWidths[2]) <= 1,
      summaryCellsAreEqual: Math.abs(summaryCells[0] - summaryCells[1]) <= 1,
      columnGap: style.columnGap,
      detailsAlignWithCompany: Math.abs(captionRect.left - identityRect.left) <= 1,
    }
  })

  expect(layout).toEqual({
    columnCount: 3,
    contentColumnsAreEqual: true,
    summaryCellsAreEqual: true,
    columnGap: '12px',
    detailsAlignWithCompany: true,
  })
})

test('readonly desktop lists use equal semantic columns and evenly spaced anchors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(page.locator('.rt-application-info-grid').first()).toBeVisible()
  const applicationLayout = await page.locator('.rt-application-info-grid').first().evaluate((grid) => {
    const widths = getComputedStyle(grid).gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))
    return {
      columnCount: widths.length,
      widthDelta: Math.max(...widths) - Math.min(...widths),
    }
  })
  expect(applicationLayout.columnCount).toBe(5)
  expect(applicationLayout.widthDelta).toBeLessThanOrEqual(1)

  const companyLayout = await page.locator('.rt-company-list__head').evaluate((head) => {
    const widths = getComputedStyle(head).gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))
      .slice(1)
    const centers = [...head.children]
      .slice(1)
      .map((cell) => {
        const rect = cell.getBoundingClientRect()
        return rect.left + rect.width / 2
      })
    const intervals = centers.slice(1).map((center, index) => center - centers[index])
    return {
      semanticColumnCount: widths.length,
      widthDelta: Math.max(...widths) - Math.min(...widths),
      intervalDelta: Math.max(...intervals) - Math.min(...intervals),
      companyAlignment: getComputedStyle(head.children[1]).textAlign,
    }
  })
  expect(companyLayout).toEqual({
    semanticColumnCount: 4,
    widthDelta: 0,
    intervalDelta: 0,
    companyAlignment: 'left',
  })

  await page.getByRole('tab', { name: /招聘信息/u }).click()
  const recruitmentLayout = await page.locator('.rt-recruitment-list__head').evaluate((head) => {
    const widths = getComputedStyle(head).gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))
    const centers = [...head.children].map((cell) => {
      const rect = cell.getBoundingClientRect()
      return rect.left + rect.width / 2
    })
    const intervals = centers.slice(1).map((center, index) => center - centers[index])
    return {
      columnCount: widths.length,
      widthDelta: Math.max(...widths) - Math.min(...widths),
      intervalDelta: Math.max(...intervals) - Math.min(...intervals),
      alignments: [...head.children].map((cell) => getComputedStyle(cell).textAlign),
    }
  })
  expect(recruitmentLayout.columnCount).toBe(7)
  expect(recruitmentLayout.widthDelta).toBeLessThanOrEqual(1)
  expect(recruitmentLayout.intervalDelta).toBeLessThanOrEqual(1)
  expect(recruitmentLayout.alignments).toEqual(['left', ...Array(6).fill('center')])
})
