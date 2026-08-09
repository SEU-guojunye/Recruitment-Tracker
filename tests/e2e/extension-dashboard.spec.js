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
    await expect(page.locator('.rt-sync-status')).toHaveCSS('border-radius', '6px')
    const headerControlLayout = await page.locator('.rt-topbar__actions').evaluate((actions) => {
      const modeRect = actions.querySelector('.rt-mode-badge').getBoundingClientRect()
      const syncRect = actions.querySelector('.rt-sync-status').getBoundingClientRect()
      return {
        flexWrap: getComputedStyle(actions).flexWrap,
        syncFollowsMode: syncRect.left >= modeRect.right,
        sameRow: Math.abs(syncRect.top - modeRect.top) <= 2,
      }
    })
    expect(headerControlLayout).toEqual({
      flexWrap: 'nowrap',
      syncFollowsMode: true,
      sameRow: true,
    })
    await expect(page.locator('.rt-page-head__actions .rt-sync-status')).toHaveCount(0)
    await page.getByRole('tab', { name: /招聘信息/u }).click()
    const addCompanyButton = page.getByRole('button', { name: '新增公司' })
    await expect(addCompanyButton).toHaveCSS('background-color', 'rgb(0, 82, 217)')
    await expect(addCompanyButton).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(addCompanyButton).toHaveCSS('font-weight', '600')
    await addCompanyButton.click()
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
    const addApplicationButton = page.getByRole('button', { name: '新增投递' })
    await expect(addApplicationButton).toHaveCSS('background-color', 'rgb(0, 82, 217)')
    await expect(addApplicationButton).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(addApplicationButton).toHaveCSS('font-weight', '600')
    const companyHead = page.locator('.rt-company-card__head')
    await expect(companyHead.getByRole('button', { name: '投递' })).toBeVisible()
    await page.getByRole('button', { name: '展开端到端公司' }).click()
    await expect(page.getByText('上海 / 远程')).toBeVisible()
    const applicationCard = page.locator('.rt-application-card')
    await expect(applicationCard.getByText('操作', { exact: true })).toBeVisible()
    await expect(applicationCard.getByRole('button', { name: '编辑投递' })).toBeVisible()
    await expect(applicationCard.getByRole('button', { name: '删除' })).toBeVisible()
    await expect(applicationCard.getByRole('combobox', { name: /快速更新当前环节/u })).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 844 })
    const mobileCompanyLayout = await page.locator('.rt-company-card__head').evaluate((head) => {
      const style = getComputedStyle(head)
      const columnWidths = style.gridTemplateColumns
        .split(' ')
        .map((value) => Number.parseFloat(value))
      const actions = head.querySelector('.rt-row-actions')
      const actionsRect = actions.getBoundingClientRect()
      const appliedJobsRect = head.querySelector('.rt-applied-jobs').getBoundingClientRect()
      const identityRect = head.querySelector('.rt-company-identity').getBoundingClientRect()
      const captionRect = head.parentElement.querySelector('.rt-detail-caption').getBoundingClientRect()
      const summaryCells = [...head.querySelectorAll('.rt-company-summary-cell')]
        .slice(0, 2)
        .map((cell) => cell.getBoundingClientRect().width)
      const buttonStyles = [...actions.querySelectorAll('.rt-table-action')].map((button) => {
        const buttonStyle = getComputedStyle(button)
        return {
          whiteSpace: buttonStyle.whiteSpace,
          writingMode: buttonStyle.writingMode,
        }
      })

      return {
        columnCount: columnWidths.length,
        contentColumnsAreEqual: Math.abs(columnWidths[1] - columnWidths[2]) <= 1,
        summaryCellsAreEqual: Math.abs(summaryCells[0] - summaryCells[1]) <= 1,
        columnGap: style.columnGap,
        actionsUseOwnRow: actionsRect.top >= appliedJobsRect.bottom,
        detailsAlignWithCompany: Math.abs(captionRect.left - identityRect.left) <= 1,
        buttonStyles,
      }
    })
    expect(mobileCompanyLayout).toEqual({
      columnCount: 3,
      contentColumnsAreEqual: true,
      summaryCellsAreEqual: true,
      columnGap: '12px',
      actionsUseOwnRow: true,
      detailsAlignWithCompany: true,
      buttonStyles: [
        { whiteSpace: 'nowrap', writingMode: 'horizontal-tb' },
        { whiteSpace: 'nowrap', writingMode: 'horizontal-tb' },
        { whiteSpace: 'nowrap', writingMode: 'horizontal-tb' },
      ],
    })
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
    await page.setViewportSize({ width: 1440, height: 1000 })
    const editableApplicationWidths = await applicationCard.locator('.rt-application-info-grid').evaluate(
      (grid) => getComputedStyle(grid).gridTemplateColumns
        .split(' ')
        .map((value) => Number.parseFloat(value)),
    )
    expect(editableApplicationWidths).toHaveLength(6)
    expect(Math.max(...editableApplicationWidths) - Math.min(...editableApplicationWidths))
      .toBeLessThanOrEqual(1)
    const applicationRowsAlign = await applicationCard.locator('.rt-application-info-grid').evaluate((grid) => {
      const textTop = (element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getBoundingClientRect().top
      }
      const cells = [...grid.children]
      const labelTops = cells.map((cell) => textTop(cell.firstElementChild))
      const valueTops = cells.map((cell) => {
        const value = cell.classList.contains('rt-application-cell--actions')
          ? cell.querySelector('.rt-table-action')
          : cell.children[1]
        return textTop(value)
      })
      return {
        labelDelta: Math.max(...labelTops) - Math.min(...labelTops),
        valueDelta: Math.max(...valueTops) - Math.min(...valueTops),
      }
    })
    expect(applicationRowsAlign.labelDelta).toBeLessThanOrEqual(1)
    expect(applicationRowsAlign.valueDelta).toBeLessThanOrEqual(1)
    const editableCompanyWidths = await page.locator('.rt-company-list__head').evaluate(
      (head) => getComputedStyle(head).gridTemplateColumns
        .split(' ')
        .map((value) => Number.parseFloat(value))
        .slice(1),
    )
    expect(editableCompanyWidths).toHaveLength(5)
    expect(Math.max(...editableCompanyWidths) - Math.min(...editableCompanyWidths))
      .toBeLessThanOrEqual(1)
    await expect(page.locator('.rt-company-list__head > span').nth(1)).toHaveCSS('text-align', 'left')
    await expect(page.locator('.rt-company-card__head > .rt-company-identity'))
      .toHaveCSS('justify-content', 'flex-start')
    await page.getByRole('tab', { name: /招聘信息/u }).click()
    await expect(page.locator('.rt-recruitment-list__head')).toHaveCSS('font-weight', '600')
    const editableRecruitmentLayout = await page.locator('.rt-recruitment-list__head').evaluate((head) => {
      const widths = getComputedStyle(head).gridTemplateColumns
        .split(' ')
        .map((value) => Number.parseFloat(value))
      const centers = [...head.children].map((cell) => {
        const rect = cell.getBoundingClientRect()
        return rect.left + rect.width / 2
      })
      const intervals = centers.slice(1).map((center, index) => center - centers[index])
      return {
        widths,
        intervals,
        alignments: [...head.children].map((cell) => getComputedStyle(cell).textAlign),
      }
    })
    expect(editableRecruitmentLayout.widths).toHaveLength(8)
    expect(Math.max(...editableRecruitmentLayout.widths) - Math.min(...editableRecruitmentLayout.widths))
      .toBeLessThanOrEqual(1)
    expect(Math.max(...editableRecruitmentLayout.intervals) - Math.min(...editableRecruitmentLayout.intervals))
      .toBeLessThanOrEqual(1)
    expect(editableRecruitmentLayout.alignments).toEqual(['left', ...Array(7).fill('center')])
    await expect(page.locator('.rt-recruitment-row > .rt-company-identity'))
      .toHaveCSS('justify-content', 'flex-start')
    await expect(page.locator('.rt-recruitment-row > .rt-row-actions')).toHaveCSS('gap', '16px')
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
