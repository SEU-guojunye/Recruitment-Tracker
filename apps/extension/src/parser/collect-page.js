export function collectRawPageCandidates() {
  const clamp = (value, length) => String(value || '').slice(0, length)
  const absoluteHttpUrl = (value) => {
    try {
      const url = new URL(String(value || ''), location.href)
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
    } catch {
      return ''
    }
  }
  const meta = {}
  for (const element of [...document.querySelectorAll('meta')].slice(0, 100)) {
    const key = (element.getAttribute('property') || element.getAttribute('name') || '')
      .trim()
      .toLowerCase()
    if (key && !(key in meta)) meta[key] = clamp(element.getAttribute('content'), 1000)
  }
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .slice(0, 10)
    .map((element) => clamp(element.textContent, 100_000))
  const brandSignals = {
    links: [...document.querySelectorAll('a[href]')]
      .slice(0, 200)
      .map((element) => ({
        href: absoluteHttpUrl(element.href),
        text: clamp(element.textContent, 200),
        rel: clamp(element.getAttribute('rel'), 100),
      }))
      .filter((item) => item.href),
    images: [...document.querySelectorAll('img[src]')]
      .slice(0, 100)
      .map((element) => ({
        src: absoluteHttpUrl(element.src),
        alt: clamp(element.getAttribute('alt'), 200),
        className: clamp(element.getAttribute('class'), 200),
      }))
      .filter((item) => item.src),
    scripts: [...document.scripts]
      .filter((element) => /displayName|logoUrl|navbarLogoLink|applyShareLogo|companyName|orgId/iu.test(element.textContent || ''))
      .slice(0, 5)
      .map((element) => clamp(element.textContent, 100_000)),
  }
  return {
    url: clamp(location.href, 2048),
    title: clamp(document.title, 500),
    meta,
    jsonLd,
    brandSignals,
    visibleText: clamp(document.body?.innerText, 50_000),
  }
}

export async function collectActivePage() {
  if (!globalThis.chrome?.tabs || !globalThis.chrome?.scripting) {
    throw new Error('当前环境无法访问活动页面')
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('无法获取当前标签页')
  if (!/^https?:\/\//u.test(tab.url || '')) {
    throw new Error('当前页面不支持自动解析，请手动填写')
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectRawPageCandidates,
  })
  if (!results[0]?.result) throw new Error('页面没有返回可解析内容')
  return results[0].result
}
