export function collectRawPageCandidates() {
  const clamp = (value, length) => String(value || '').slice(0, length)
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
  return {
    url: clamp(location.href, 2048),
    title: clamp(document.title, 500),
    meta,
    jsonLd,
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
