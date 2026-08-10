# 招聘公司名称解析规则与实现方式

本文档说明 Recruitment-Tracker 浏览器扩展当前如何从招聘网页中识别公司名称，以及解析结果如何回填到公司招聘链接。

## 1. 代码位置

核心实现位于：

- `apps/extension/src/parser/collect-page.js`：在当前浏览器标签页采集原始页面信息。
- `apps/extension/src/parser/parser-orchestrator.js`：合并候选公司、清洗字段、排序并输出解析结果。
- `apps/extension/src/parser/site-adapters.js`：针对特定招聘平台的 URL 规则。
- `apps/extension/src/popup/PopupApp.jsx`：触发采集和解析，把结果显示到弹窗表单并保存。
- `tests/unit/parser.test.js`：解析器的单元测试。

## 2. 总体流程

```text
当前招聘页面
    ↓
collectActivePage()
    ↓ 通过 chrome.scripting.executeScript 在页面上下文采集
{ url, title, meta, jsonLd, brandSignals, visibleText }
    ↓
parserOrchestrator.parse(raw)
    ↓
JSON-LD 候选 + Meta 候选 + 站点适配器候选 + 标题候选
    ↓
清洗、去重、按置信度排序
    ↓
{ status, company: { companyName, recruitmentLink, brandDomain, logoUrl }, alternatives, parsedAt }
    ↓
PopupApp.jsx 回填公司名称和招聘链接
```

插件打开弹窗时会自动调用 `parsePage()`；用户点击重新解析按钮时会再次执行同一流程。解析完成后，公司名称仍可在保存前手动修改。

## 3. 页面信息采集

`collectRawPageCandidates()` 只采集当前页面，不请求外部公司数据库或搜索引擎。

### 3.1 URL

采集 `location.href`，最多保留 2048 个字符。之后由 `cleanUrl()` 校验：

- 必须是 `http://` 或 `https://` URL；
- 长度不能超过核心模型定义的 URL 限制；
- `javascript:` 等危险协议会被拒绝。

合法 URL 会作为 `company.recruitmentLink` 原样保存。

### 3.2 页面标题

采集 `document.title`，最多 500 个字符。标题会在后续按以下分隔符拆分：

- `|`
- `-`
- 页面标题中可能出现的其他横线变体

每个拆分片段都可以成为低置信度的公司候选。

### 3.3 Meta 标签

最多读取前 100 个 `<meta>` 标签，按 `property` 或 `name` 作为键，读取 `content` 作为值。每个值最多保留 1000 个字符。

当前参与公司识别的 Meta 字段及默认置信度：

| 字段 | 来源标识 | 置信度 |
| --- | --- | ---: |
| `og:site_name` | `meta:og:site_name` | 0.84 |
| `application-name` | `meta:application-name` | 0.78 |
| `twitter:site` | `meta:twitter:site` | 0.62 |

### 3.4 JSON-LD

最多读取前 10 个 `script[type="application/ld+json"]`，每段最多 100,000 个字符。解析 JSON 后递归遍历对象，最大深度为 8，每层最多遍历 100 个数组或对象成员。

识别规则：

| JSON-LD 内容 | 来源标识 | 置信度 |
| --- | --- | ---: |
| `hiringOrganization.name` | `jsonld:hiringOrganization` | 0.98 |
| `@type` 为 `Organization` 或 `Corporation` 时的 `name` | `jsonld:organization` | 0.86 |

无效 JSON-LD 会被忽略，不会阻断其他解析策略。

### 3.5 可见文本

页面正文可见文本最多采集 50,000 个字符，字段名为 `visibleText`。当前 `ParserOrchestrator` 不直接从正文中提取公司名；该字段主要作为页面采集结果的一部分，为后续扩展站点适配器或正文规则预留。

### 3.6 品牌信号

页面采集器最多返回有限的 `brandSignals`：

- 页面中的前 200 个 HTTP/HTTPS 外部链接及其文本、`rel`；
- 页面中的前 100 个图片地址及其 `alt`、`class`；
- 包含 `displayName`、`logoUrl`、`navbarLogoLink`、`applyShareLogo`、`companyName` 或 `orgId` 的前 5 段内嵌脚本文本，每段最多 100,000 个字符。

这些信号只用于站点适配器提取公司品牌域名和 Logo，不会直接作为公司名称使用。页面采集仍不请求外部服务。

## 4. 公司候选的生成顺序

`ParserOrchestrator.parse()` 会按以下顺序合并候选：

1. JSON-LD 候选；
2. Meta 候选；
3. 站点适配器候选；
4. 页面标题候选。

站点适配器可以同时返回 `brandDomain` 和 `logoUrl`。这两个字段与公司名称候选分开处理，不改变公司名称候选的置信度排序。

候选的合并顺序不是最终优先级。所有候选会先按公司名忽略大小写去重，同名候选只保留置信度更高的一条，之后按以下规则排序：

1. 置信度从高到低；
2. 置信度相同时，按中文本地化排序；
3. 最多保留前 5 个候选。

最终取排序后的第一个候选作为 `company.companyName`。

## 5. 各类解析规则

### 5.1 JSON-LD `hiringOrganization`：最高优先级

标准招聘职位页通常会包含如下结构：

```json
{
  "@type": "JobPosting",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "示例科技"
  }
}
```

解析器会优先取 `hiringOrganization.name`。这是当前最可靠的来源，置信度为 `0.98`。

### 5.2 JSON-LD 普通组织对象

如果页面没有 `hiringOrganization`，但 JSON-LD 中出现：

```json
{
  "@type": "Organization",
  "name": "示例科技"
}
```

则会生成普通组织候选，置信度为 `0.86`。

### 5.3 Open Graph 和其他 Meta

解析器会尝试读取：

```html
<meta property="og:site_name" content="示例科技招聘">
```

以及 `application-name`、`twitter:site`。这些值会经过通用名称清洗；如果值是通用招聘平台名称，则不会作为公司名使用。

### 5.4 Lever

支持的域名：

```text
jobs.lever.co
```

解析路径中的第一个非空片段：

```text
https://jobs.lever.co/example-labs/position-id
                         └──────────┘
```

得到：

```text
example labs
```

路径片段会先 URL 解码，再把 `-` 和 `_` 转为空格。该规则的置信度为 `0.58`，只能作为辅助候选，因此解析状态通常是 `needsConfirmation`。

### 5.5 Greenhouse

支持的域名：

```text
boards.greenhouse.io
job-boards.greenhouse.io
```

同样读取路径的第一个非空片段：

```text
https://boards.greenhouse.io/example-labs/jobs/123
```

得到 `example labs`，置信度为 `0.58`。

### 5.6 Moka

支持的路径结构：

```text
https://app.mokahr.com/campus-recruitment/{tenant}/{siteId}
```

`tenant` 只作为平台租户标识，不能直接作为公司官网域名。适配器优先读取页面标题、Meta 和 Moka 页面配置中的 `displayName`、`logoUrl`、`applyShareLogo`、`navbarLogoLink` 等字段。

首批租户别名：

```text
hypergryph → 鹰角网络
kpmg       → 毕马威
```

Moka 的 `public-cdn.mokahr.com` 图片可以作为 `logoUrl` 保存，但 `app.mokahr.com` 不得作为 `brandDomain` 或 Logo 服务查询域名。页面没有明确官网时，`tenant` 可自动尝试 `${tenant}.com`、`${tenant}.cn` 作为低优先级品牌域名候选，例如 `hypergryph.com`/`hypergryph.cn`、`kpmg.com`/`kpmg.cn`。

### 5.7 Feishu

支持的路径结构：

```text
https://{tenant}.jobs.feishu.cn/campus/
```

例如：

```text
https://momenta.jobs.feishu.cn/campus/?project=7664524042879830335
```

适配器从 hostname 提取租户标识。`project`、`current`、`limit` 等查询参数不参与公司名称和 Logo 域名判断。对租户自动尝试 `${tenant}.com`、`${tenant}.cn` 作为品牌域名候选，例如 `nio.com`、`nio.cn`；页面明确提供的官网域名优先。特殊品牌规则按平台和租户维护在 `packages/core/src/special-brand-rules.js`，其中 `feishu.momenta` 固定使用 `momenta.ai`，`moka.alibaba` 固定使用 `alibaba.cn`。租户别名仅作名称兜底。

Feishu 页面标题会自动清除“校招”“校园招聘”“Campus”“Welcome to”等平台装饰词。`*.jobs.feishu.cn` 始终视为招聘平台域名，不得直接查询其 favicon 或 Logo；页面和租户推断均未提供可用品牌域名时显示公司名称首字。

### 5.8 页面标题

标题候选会先移除通用招聘栏目装饰词，再参与公司名候选排序。当前包括：`加入我们`、`欢迎加入`、`招聘`、`校园招聘`、`校招`、`招聘官网`、`招聘官方网站`、`Campus`、`Campus Careers` 和 `Recruiting`。

当页面 hostname 不是已知招聘平台域名时，解析器会将当前页面 hostname（去除 `www.`）作为低优先级 `brandDomain` 候选。例如 `https://www.cxmt.com/join.html` 会得到 `cxmt.com`。Moka、Feishu、智联等平台域名会被排除，不能作为公司官网域名。

标题会按分隔符切分，每个片段作为候选。例如：

```text
高级工程师 | 星河网络
```

可能产生：

```text
高级工程师
星河网络
```

标题候选的置信度为 `0.45`，因此标题猜测通常会标记为需要确认，而不会直接视为高可靠匹配。

## 6. 公司名称清洗

所有候选都会经过 `cleanCompanyName()`：

- 非字符串直接丢弃；
- 删除控制字符；
- 使用 Unicode NFKC 规范化；
- 合并连续空白并去掉首尾空格；
- 超过核心模型公司名长度限制的候选丢弃；
- 空字符串丢弃；
- 通用招聘网站名称丢弃。

当前会过滤的通用名称包括：

```text
BOSS 直聘
LinkedIn
LinkedIn Jobs
猎聘
拉勾
智联招聘
前程无忧
51job
招聘
职位
Jobs
Careers
```

源码中的部分中文常量当前存在字符编码显示异常；如果需要继续扩展通用名称黑名单，应先统一源码文件编码，再补充规范化后的名称。

## 7. 解析状态

解析器使用 `reliableThreshold = 0.75` 判断结果是否可靠：

| 状态 | 条件 | 含义 |
| --- | --- | --- |
| `matched` | 最佳候选置信度 `>= 0.75` | 可以自动回填，但用户仍可确认或修改 |
| `needsConfirmation` | 存在候选，但最佳置信度 `< 0.75` | 已有猜测，需要用户确认 |
| `unavailable` | 没有有效候选，或输入无效 | 无法自动识别，需要手动填写 |

例如：

- JSON-LD `hiringOrganization`：通常为 `matched`；
- 标题推断：通常为 `needsConfirmation`；
- Lever/Greenhouse 路径推断：通常为 `needsConfirmation`；
- 无效 URL、无效 JSON-LD、通用网站名：可能为 `unavailable`。

## 8. 前端调用与保存

`PopupApp.jsx` 的调用链如下：

```text
useEffect()
  → parsePage()
  → collectActivePage()
  → parserOrchestrator.parse(raw)
  → setValues({ companyName, recruitmentLink, brandDomain, logoUrl })
  → 用户确认或修改
  → CompanyService.create()
```

采集阶段通过 `chrome.tabs.query()` 获取当前标签页，再使用 `chrome.scripting.executeScript()` 在目标页面执行 `collectRawPageCandidates()`。解析器本身是纯 JavaScript 逻辑，不依赖网络。

保存阶段由 `CompanyService` 和本地仓储处理。解析器只负责产出：

```js
{
  company: {
    companyName,
    recruitmentLink,
    brandDomain,
    logoUrl,
  },
  alternatives,
  status,
  parsedAt,
}
```

解析器不会写入职位投递日期、投递进度、岗位详情等字段；这些属于后续 Dashboard 中的投递记录流程。

## 9. 当前实现的优点

- 优先使用标准 JSON-LD，准确度高；
- 对 Meta、标题、招聘平台 URL 提供多级回退；
- 通过置信度区分“可靠识别”和“需要确认”；
- 保留最多 5 个候选，便于后续增加候选选择 UI；
- 对 URL、候选长度、控制字符和无效 JSON 做了输入限制；
- 解析过程不访问外部服务，隐私和可测试性较好；
- `ParserOrchestrator` 可通过传入 `now` 进行确定性单元测试。

## 10. 当前限制与误判场景

### 10.1 ATS 平台路径不一定代表最终公司

Lever、Greenhouse、Moka 和 Feishu 的 URL 可能使用内部租户名、品牌缩写或代理方名称，结果可能不是营业执照上的公司全称。因此平台租户只作为低置信度候选或本地别名查找键，不能直接用于公司 Logo 域名。

### 10.2 当前不使用正文文本

虽然页面采集器会返回 `visibleText`，但当前编排器没有通用的正文公司名抽取规则。对于没有 JSON-LD、Meta、可靠标题和已支持平台适配器的页面，可能只能手动填写。

### 10.3 标题拆分可能包含职位名

标题中的每个片段都会成为候选，解析器并不知道哪个片段一定是公司名。标题只有 `0.45` 置信度，因此需要用户确认。

### 10.4 公司名称黑名单需要维护

招聘平台名称过滤依赖固定集合。新平台或不同语言写法需要补充到 `GENERIC_SITE_NAMES`，否则平台名可能进入候选。

### 10.5 解析范围仅限当前页面

解析器不会打开网页中的其他链接，也不会通过搜索引擎、公司数据库或 AI 服务进行二次确认。

## 11. 测试覆盖

`tests/unit/parser.test.js` 当前覆盖以下情况：

1. JSON-LD 的 `hiringOrganization` 优先于标题和 Meta；
2. 只有标题时返回 `needsConfirmation`；
3. Lever URL 路径作为低置信度候选；
4. 拒绝危险 URL；
5. 过滤通用招聘网站名；
6. 拒绝超长候选；
7. 保留解析时间 `parsedAt`；
8. 结果包含公司名称、招聘链接和可选品牌字段，不混入投递进度等字段；Moka、Feishu 平台域名不会作为公司 Logo 域名。

## 12. 与旧版扩展解析器的区别

旧版 `job-tracker-extension-v1.6.1` 中的 `shared/parser.js` 主要采用页面可见文本、标题、域名和大量平台专用正则，直接生成公司、岗位、状态、投递日期等完整投递记录。

当前 Recruitment-Tracker 的解析器已经拆分为更小的职责：

```text
页面采集 → 公司候选生成 → 置信度排序 → 公司表单保存
```

当前版本重点是识别“公司 + 招聘链接”；岗位投递、日期和进度由 Dashboard 里的独立流程维护。这样可以降低页面结构变化对核心数据模型的影响，也方便为新的招聘平台增加独立适配器。

## 13. 扩展新的招聘平台

推荐在 `apps/extension/src/parser/site-adapters.js` 中新增适配器，而不是把平台判断全部写进编排器：

```js
Object.freeze({
  id: 'example-ats',
  matches: (url) => url.hostname === 'jobs.example.com',
  companyName: (url) => firstPathSegment(url),
  confidence: 0.58,
})
```

新增适配器时应同时补充：

1. URL 匹配条件；
2. 公司名来源和清洗逻辑；
3. 置信度；
4. 对应的单元测试；
5. 如果平台名可能被误识别，补充 `GENERIC_SITE_NAMES`。

如果平台页面能够提供标准 JSON-LD，应优先依赖 `hiringOrganization`，而不是新增 URL 猜测规则。
