const SPECIAL_BRAND_RULES = Object.freeze({
  moka: Object.freeze({
    alibaba: Object.freeze({
      companyName: '阿里巴巴',
      brandDomain: 'alibaba.cn',
    }),
  }),
  feishu: Object.freeze({
    momenta: Object.freeze({
      companyName: 'Momenta',
      brandDomain: 'momenta.ai',
    }),
  }),
})

function normalizeRuleKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function getSpecialBrandRule(platform, tenant) {
  return SPECIAL_BRAND_RULES[normalizeRuleKey(platform)]?.[normalizeRuleKey(tenant)] || null
}

export function getBrandDomainCandidates(platform, tenant) {
  const normalizedTenant = normalizeRuleKey(tenant)
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(normalizedTenant)) return []
  const specialRule = getSpecialBrandRule(platform, normalizedTenant)
  return [...new Set([
    specialRule?.brandDomain,
    `${normalizedTenant}.com`,
    `${normalizedTenant}.cn`,
  ].filter(Boolean))]
}

export { SPECIAL_BRAND_RULES }
