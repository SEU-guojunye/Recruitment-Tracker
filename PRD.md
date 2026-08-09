# Recruitment Tracker 产品需求文档（PRD）

> 版本：v1.6
>
> 状态：v1.6 数据模型、TDesign Dashboard、扩展编辑端与只读 Web 已完成验收并部署到 CloudBase
>
> 开发语言：JavaScript ES2022+ / JSX
>
> 前端框架：React + Vite
>
> 产品形态：Chrome / Chromium 浏览器扩展（Manifest V3）+ 响应式只读 Web Dashboard
>
> 数据策略：单用户、单 CloudBase 账号、单个 Chrome 配置文件作为唯一编辑端；`chrome.storage.local` 为主数据源；腾讯云 CloudBase 保存只读快照供手机查看；当前不考虑旧数据迁移

## 1. 产品概述

Recruitment Tracker 是一个以公司为核心、以投递明细为子记录的个人求职管理工具。

用户浏览招聘页面时，解析器只负责识别和保存公司招聘信息；用户完成实际投递后，在“岗位投递”中手动维护该公司下各个岗位的投递信息和招聘进度。

电脑端浏览器扩展是唯一的数据编辑端，数据首先保存在浏览器本地；用户登录后，扩展将完整数据上传至腾讯云 CloudBase 文档型数据库。手机 Chrome 通过响应式 Web Dashboard 登录同一 CloudBase 账号后查看最新快照，MVP 不支持手机端新增、编辑或删除。

MVP 面向个人使用，只支持一个预先创建的 CloudBase 账号和一个可编辑的 Chrome 配置文件。产品不实现团队协作、多账号本地数据空间或多电脑编辑合并，但数据模型、Repository、认证适配器、`schemaVersion`、设备 ID 和修订号需要保留后续扩展能力。

本版本已经完成一个可交互的 Dashboard HTML 原型。后续使用 React + Vite 实现正式页面，并以原型中的页面层级、公司聚合方式、进度时间线和编辑交互为主要参考。

## 2. 原型参考与 React 实现原则

### 2.1 原型文件

- [TDesign Dashboard HTML 原型](./dashboard-tdesign.html)
- 原型绝对路径：`C:\Users\guojunye\code\Recruitment-Tracker\dashboard-tdesign.html`

原型当前使用页面内示例数据，不代表最终 React 组件或存储实现。React 重构后必须保留原型中已经确认的视觉效果、布局关系和核心交互。

当原型与本 PRD 在字段、权限、状态计算或异常流程上不一致时，以本 PRD 为准；原型只作为视觉层级和已覆盖交互的验收基准，不作为完整功能清单。

### 2.2 原型已覆盖范围

- 左上角“岗位投递 / 招聘信息”标签切换；电脑端与移动端复用同一组标签。
- 全宽 Dashboard 布局，不使用左侧导航栏。
- 两个标签页使用对齐的简洁 TDesign 顶部统计卡片。
- “岗位投递”按公司聚合，一家公司只展示一行。
- 公司行展开后展示多个岗位投递子记录。
- 每个投递子记录展示独立的进度时间线。
- 详情字段网格不单独展示“当前进度”，当前环节由招聘进度 Steps 表达。
- 进度环节文字与节点保持明确关联。
- “编辑进度”入口放在招聘进度标题旁。
- 支持新增、删除、重命名、排序和设置时间的流程编辑。
- 桌面端与窄屏端时间线均保持横向自适应排列，节点之间使用 TDesign 风格连接线，且不要求用户左右滚动。

### 2.3 React 实现原则

- `dashboard-tdesign.html` 继续作为视觉、布局和交互验收基准，不直接作为生产页面源码。
- Dashboard 使用 React 函数组件、JSX 和 Hooks 实现。
- 现有 CSS 主题、间距、时间线和响应式规则优先复用。
- 桌面扩展 Dashboard 与手机 Web Dashboard 复用展示组件和业务计算逻辑。
- 通过 `mode="editable"` 和 `mode="readonly"` 区分电脑编辑模式与手机只读模式。
- 第一版使用 React 内置状态能力，不引入 Redux、Zustand、React Router 或大型 UI 组件库。
- 解析器、Content Script、Service Worker、Repository 和同步服务继续使用普通 JavaScript 模块，不依赖 React。

## 3. 核心数据关系

本地业务数据关系：

```text
CompanyRecord 1 ───────── 0..N Application
```

云端只读快照关系：

```text
CloudBaseUser 1 ───────── 1 CloudSnapshot
CloudSnapshot ── contains ── CompanyRecord[] + Application[]
CloudSnapshot ── identifies ── sourceDeviceId + sourceRevision
```

### 3.1 `CompanyRecord`

一家公司对应一条公司记录，保存：

- 公司名称。
- 公司招聘链接。
- 行业类型。
- 招聘批次。
- 优先度。
- 创建时间和更新时间。

公司记录本身不保存某个岗位的招聘进度。

字段规则：

- `companyName` 必填，去除首尾空白后长度为 1～120 个字符。
- `recruitmentLink` 可为空，最多 2048 个字符；解析器默认使用当前页面的 HTTP/HTTPS URL，用户可以修改或清空。
- `industryType` 由用户维护，可从“互联网、制造业、央国企、快消、银行、游戏、军工”中选择；后续允许用户新增自定义选项，解析器不得推断。
- `recruitmentBatch` 由用户维护，只接受“秋招正式批”“秋招提前批”“春招正式批”，新建公司默认“秋招正式批”，解析器不得推断。
- `priority` 由用户维护，只接受 `P0`、`P1`、`P2`，新建公司默认 `P1`，解析器不得推断。
- `companyNotes` 自 v1.6 起不再作为产品字段；历史存储中的同名字段只作兼容保留，Popup、Dashboard 和解析器均不展示、不采集、不更新。
- `normalizedCompanyName` 使用 Unicode NFKC、去除首尾空白、合并连续空白并统一拉丁字母大小写；不自动删除“集团”“科技”“有限公司”等后缀，也不猜测简称或别名。
- 公司名称规范化只用于候选匹配，不进行无提示的自动合并。

### 3.2 `Application`

一条 `Application` 表示同一家公司下某个岗位或某次投递的明细。

同一家公司可以存在多条 `Application`，每条记录独立维护：

- 岗位名称（用户手动填写和编辑）。
- 投递链接。
- 工作地点。
- 投递时间。
- 招聘进度和进度更新时间。
- 查看投递状态页面。
- 是否内推和内推码。
- 投递备注。
- 自定义进度环节、顺序和环节时间。
- 每个自定义环节对应一个稳定的进度阶段，用于筛选和统计。

解析器不负责识别申请职位；用户在“岗位投递”中手动填写和编辑岗位名称。岗位名称可以为空，投递仍通过投递记录 ID、链接、工作地点、投递时间和备注等字段区分。

`Application` 只在用户已经完成实际投递后创建，因此 `appliedDate` 必填，MVP 不使用 `Application` 表示“计划投递”或“待投递”岗位。

### 3.3 `CloudSnapshot`

每个 CloudBase 账号只保存一份最新云端快照，完整包含该用户电脑端的 `CompanyRecord` 和 `Application` 数据。

MVP 使用 CloudBase 文档型数据库的 `user_snapshots` 集合保存快照，不使用 CloudBase PG 模式。每个用户对应一个 JSON 文档，数据权限由 CloudBase 身份认证和数据库安全规则控制。

快照只用于：

- 手机 Web Dashboard 只读查看。
- 展示最近同步时间。
- 为后续云端数据结构升级保留版本号。
- 记录唯一编辑设备和本地修订号，避免另一台电脑无提示覆盖快照。

MVP 不把云端快照作为电脑端主数据源，也不从手机向电脑反向写入。未来若增加手机编辑、关系查询或双向同步，再评估升级到 CloudBase PG 模式。

MVP 将序列化后的本地数据和云端快照都限制在 8 MiB 以内。导入或本地写入预计超过限制时必须在提交前阻止操作并提示用户先导出或清理数据。该限制用于同时避开浏览器本地存储和 CloudBase 单文档容量边界。

### 3.4 本地账号与设备绑定

- 扩展首次初始化本地存储时生成稳定的 `deviceId`；首次成功同步时将当前 CloudBase `userId` 写入本地 `boundUserId`。
- 后续只有 `boundUserId` 对应的账号可以上传该 Chrome 配置文件中的本地数据。
- 如果登录账号与 `boundUserId` 不一致，系统必须阻止自动和手动同步，并提供“退出并使用原账号”“导出本地数据后清空并重新绑定”两种处理方式。
- MVP 不为多个账号维护多套本地数据空间。
- MVP 同一时间只允许一个编辑设备。若云端快照的 `sourceDeviceId` 与当前设备不同，自动和手动同步必须先进入 `deviceConflict`，不得静默覆盖。
- 设备冲突页提供“退出并回到原编辑设备”和“确认以本机接管并覆盖云端快照”两个出口。接管前必须明确提示云端不会合并或恢复到本地，并要求用户先导出本机数据；确认后当前 `deviceId` 成为新的唯一编辑设备。
- 账号退出不删除本地业务数据，也不解除 `boundUserId`；清空和重新绑定必须是单独的显式操作。

## 4. 解析器职责

### 4.1 解析器只负责公司招聘信息

解析器只返回公司级结果：

```js
{
  status: "matched",
  company: {
    companyName: "示例公司",
    recruitmentLink: "https://example.com/careers"
  },
  alternatives: [],
  parsedAt: "2026-08-09T09:30:00.000Z"
}
```

解析器允许：

- 读取当前页面 URL、标题、Meta、JSON-LD 和可见文本。
- 识别公司名称。
- 将当前页面链接作为公司招聘链接候选值。
- 为每次解析生成 ISO 8601 UTC 格式的 `parsedAt`；即使解析失败也必须返回该字段。
- 创建或更新 `CompanyRecord`。
- 提示用户确认或修改识别结果。

解析与安全规则：

- 解析输入视为不可信数据；公司名称、Meta、JSON-LD 和可见文本必须执行长度限制和纯文本处理。
- 招聘链接和投递链接只允许 `http:` 或 `https:`，禁止 `javascript:`、`data:` 等协议。
- 解析结果为空、置信度不足或页面不可访问时，Popup 必须允许用户手动填写，不得伪造识别成功。
- Content Script 只负责采集页面候选信息并返回消息，不直接读写业务 Repository。

解析器禁止：

- 创建、编辑或删除 `Application`。
- 解析或写入申请职位；岗位名称只能由用户在电脑端投递表单中手动维护。
- 解析或写入投递链接、工作地点、投递日期和招聘进度。
- 解析或写入状态页链接、内推信息和投递备注。
- 解析或写入公司备注、行业类型或优先度。
- 根据页面文案推断用户是否已完成投递。

### 4.2 页面采集流程

1. 用户打开招聘页面。
2. 点击浏览器扩展图标。
3. 解析器识别公司名称和公司招聘链接。
4. 用户确认或修改结果。
5. 点击“保存招聘信息”。
6. 系统按规范化公司名称查找已有公司。
7. 新公司创建 `CompanyRecord`；已有公司由用户确认是否更新招聘链接。
8. 系统不创建投递记录。
9. 本地保存成功后触发 CloudBase 快照同步。
10. 系统提示用户可到“岗位投递”手动新增投递。
11. Popup 提供“打开 Dashboard”入口，不要求用户通过扩展管理页寻找 Dashboard。

CloudBase 同步失败不得阻止本地保存成功。

## 5. 产品运行模式与页面信息架构

### 5.1 运行模式

| 模式 | 载体 | 数据来源 | 权限 |
|---|---|---|---|
| 电脑编辑模式 | Chrome / Chromium 扩展 Dashboard | `chrome.storage.local` | 查看、新增、编辑、删除、同步 |
| 手机只读模式 | 手机 Chrome 响应式网页 | CloudBase `CloudSnapshot` | 登录、查看、搜索、筛选、展开 |

要求：

- 两种模式复用 React 展示组件。
- 电脑端本地数据是 MVP 唯一可编辑主数据。
- 手机端不得渲染新增、编辑、删除、快速进度切换等操作入口。
- 手机端必须展示快照最近更新时间和同步状态说明。

### 5.2 顶部标签页

顶部提供两个标签页：

| 标签页 | 列表主键 | 默认内容 | 用途 |
|---|---|---|---|
| 岗位投递 | `CompanyRecord.id` | 至少有一条非终态投递的公司 | 按公司管理或查看多个岗位投递 |
| 招聘信息 | `CompanyRecord.id` | 所有已保存公司 | 管理或查看公司招聘信息 |

要求：

- 不使用左侧导航栏。
- 标签栏固定在页面左上角，作为唯一主导航；不再提供侧栏、汉堡菜单或内容区内的重复标签。
- 两个标签页使用同一套视觉样式和布局宽度。
- 当前标签页通过 TDesign 品牌蓝下划线、文字和数量徽标突出显示。
- 电脑扩展端顶栏右侧按“电脑编辑模式、同步状态、导入 CSV、导出 CSV、本地占用”顺序保持单行排列；同步状态必须紧邻“电脑编辑模式”右侧，不得换到页面标题操作区。
- 页面标题右侧的“新增投递”和“新增公司”均使用 TDesign 主题蓝实底、600 字重白色文字，作为当前页面的主操作。
- 电脑扩展端刷新后保留当前标签页。
- 手机端直接复用同一组左上角标签，切换时不得触发页面整体刷新。

### 5.3 顶部统计卡片

两个标签页顶部均展示四张对齐的统计卡片。

#### “岗位投递”卡片

1. 进行中的公司：至少有一条 `progressIsTerminal=false` 投递的公司数。
2. 已投递岗位：全部 `Application` 数量；每条 `Application` 都代表一次已完成投递。
3. 面试中：当前 `progressPhase="interview"` 且非终态的投递数量。
4. 最近更新：全部投递中最大的 `progressUpdatedDate`，无投递时显示“暂无”。

#### “招聘信息”卡片

1. 招聘公司：全部 `CompanyRecord` 数量。
2. 投递岗位数：全部 `Application` 数量。
3. P0 公司：`priority="P0"` 的公司数量。
4. 最近更新：公司与投递 `updatedAt` 的最大值，无数据时显示“暂无”。

卡片要求：

- 数字、单位、说明文字和图标保持统一对齐。
- 使用 TDesign 默认品牌蓝 `#0052D9` 作为主色，成功、警告、错误语义分别使用 TDesign 对应色阶。
- 两个标签页的四张卡片统一使用 TDesign 白底、中性边框、浅蓝图标块和一级阴影，不使用任何彩色边框、蓝色实底或单独的首卡强调。每张卡片第一行指标名称使用主题蓝和 600 字重，第二行重点数字使用黑色主文字、单位使用次级灰，第三行说明文字全部使用占位灰；不增加趋势胶囊或微型图表。
- 不因为切换标签页而改变卡片高度和间距。
- 电脑端数据来自本地记录聚合，手机端数据来自 CloudBase 快照聚合。
- 手机端采用两列布局，极窄屏允许切换为单列。
- 相同日期的聚合结果使用 `updatedAt`，再使用稳定业务 ID 作为确定性排序依据。

### 5.4 “招聘信息”标签页

列表面板顶部直接使用搜索框替代“已保存的公司”标题，不再在下方工具栏重复展示搜索框；桌面端搜索框最大宽度为 280px，其右侧依次提供“全部优先度”和“全部行业”两个下拉筛选控件，数据保存状态固定在最右侧，不显示“显示 N 家公司”文案。移动端搜索框占满可用宽度，两个下拉筛选控件在下一行等宽并排。

一行代表一家公司，展示：

- 公司名称及公司图标；招聘信息列表内的表头和各列文字统一使用 13px 字号，正文使用主文字色和常规字重，公司名称保持相同字号并使用 600 字重突出。
- 行业类型，以可编辑普通文字展示；使用与其他正文列一致的主文字色、13px 字号和常规字重，不使用背景、边框、圆角或分类颜色。
- 招聘批次，作为行业类型右侧的可编辑普通文字展示；只提供“秋招正式批”“秋招提前批”“春招正式批”，视觉样式与行业类型及其他正文列一致。
- 优先度，作为招聘批次右侧的可编辑普通文字展示；`P0`、`P1`、`P2` 不使用语义色、背景或胶囊，视觉样式与其他正文列一致。
- 招聘链接，作为优先度右侧的独立列表列展示；链接统一显示为主题蓝文字“招聘链接”，不暴露具体域名，不使用背景、边框或胶囊样式，悬停或聚焦时使用深一级主题色并增加下划线。
- 投递岗位数，以普通加权数字展示，不使用背景、边框或胶囊样式。
- 最近更新时间。
- 最右侧操作列按“投递、编辑、删除”顺序固定提供三个纯文字控件，控件之间使用 16px 桌面间距，不使用边框、背景或胶囊样式，仅通过文字色区分：“投递”使用品牌蓝并进入岗位投递新增操作、预选当前公司；“编辑”使用中性灰并打开当前公司招聘信息编辑操作；“删除”使用错误红并在二次确认后删除当前公司招聘信息及其全部关联岗位投递。

招聘信息列表不展示公司备注或最近进度列。行业类型、招聘批次和优先度均由用户在 Dashboard 维护，点击对应文字时进入编辑操作；优先度同时用于顶部 `P0 公司` 统计。桌面端公司列标题和内容保持左对齐，其余列的标题和内容锚点统一居中，使相邻列的视觉间隔保持一致；移动端转为卡片布局后，各字段标签和值全部左对齐以保持纵向阅读效率。

桌面端招聘信息表头与数据行必须复用同一套八列等宽轨道，单元格占满各自列宽，禁止根据每行内容独立计算列起点；只读网页不展示操作列，使用七列等宽轨道。公司列左对齐，其余列内容锚点居中，使相邻列的视觉间隔保持一致；窄桌面端只收紧单元格与操作文字间距，不改变等宽关系。进入移动端断点后改用两列卡片布局，不产生横向滚动。

列表容器、表头、数据行和交互状态遵循 TDesign 表格层级：使用 6px 默认圆角与中性分割线，表头采用容器悬停底色和占位文字色，数据行使用主文字色；桌面端数据行最小高度为 64px，悬停时仅切换为中性容器悬停色。投递岗位数和最近更新时间使用等宽数字特性，避免内容变化时产生视觉跳动。

公司图标规则：

- 从合法的公司招聘链接提取 hostname，并请求 `https://ico.faviconkit.net/favicon/{domain}?sz=128`。
- 域名必须先校验并进行 URL 编码，不向 FaviconKit 发送完整招聘路径或查询参数。
- 图片加载成功时显示 Favicon；无合法域名、请求失败、返回无效图片或图片解析失败时，降级为浅主题色填充的 6px 圆角矩形，使用主题色以 18px 粗体显示公司名称首字。
- Favicon 仅作辅助识别，公司名称始终保留为可读文本；图片使用空 `alt`，避免屏幕阅读器重复播报公司名。
- Favicon 加载成功后图标容器不使用背景色、边框或外环，图片等比铺满原有图标区域，不修改企业原始图标的颜色。
- 图标请求失败不得阻塞公司列表渲染，也不得显示破损图片占位。

### 5.5 “岗位投递”标签页

列表面板顶部直接使用搜索框替代“岗位投递进度”标题，桌面端搜索框最大宽度为 280px，其右侧依次放置投递范围和招聘阶段两个下拉筛选控件，数据保存状态固定在最右侧，不再保留下方筛选工具栏。移动端搜索框占满可用宽度，两个筛选器在下一行使用稳定的双列布局。

一行代表一家公司，展开后展示该公司下的多个 `Application` 申请记录区块。公司摘要的表头与数据行必须复用同一套列轨道，最近进度列和公司级进度汇总徽标不再展示。

公司行展示：

- 公司名称及公司图标。
- 投递链接，作为独立列展示并统一显示为“投递链接”，文字使用 TDesign 主题蓝。
- 投递岗位数，直接以普通数字展示，不附加“条”等单位。
- 已投递岗位，在未展开的公司摘要中直接列出该公司当前筛选结果内的各个岗位名称，多个岗位使用顿号分隔；内容固定单行展示，超出列宽时使用省略号，不得换行。
- 展开 / 收起控件。
- 操作列按“投递、编辑、删除”顺序提供普通文字控件：“投递”直接为当前公司新增岗位投递，“编辑”维护公司信息，“删除”删除当前公司下的全部投递但保留公司招聘信息；不使用主题色实心按钮，也不提供“更多操作”菜单。

公司摘要列顺序固定为“公司、投递链接、投递岗位数、已投递岗位、操作”。桌面端展开图标使用固定功能列，其余五个语义列等宽分布；只读网页不展示操作列，其余四个语义列等宽分布，公司列标题和内容保持左对齐。展开后的投递详情信息列同样等宽，操作控件保持横向且不换行；移动端明细内容左边界必须与公司信息左边界对齐。岗位投递与招聘信息两个页面的列表表头统一使用 TDesign 占位文字色、13px 字号和 600 字重；数据行统一使用 13px 主文字色，公司名使用 600 字重，计数及普通字段使用 400 字重，链接使用 13px 主题蓝。两页数据行最小高度统一为 64px。

公司行展开后，每个投递子记录采用开放式字段网格展示：字段标签在上、内容在下，岗位名称使用品牌色突出，TDesign Steps 进度组件独占下一行；记录之间仅使用中性分割线和留白区分，不额外嵌套厚重卡片。每条记录必须展示：

- 投递岗位名称；未填写时显示投递记录编号。
- 投递链接。
- 岗位工作地点。
- 投递日期。
- 最新更新日期。
- “编辑进度”控件紧邻招聘进度标题文字右侧，使用轻量主题色文字按钮，用于打开当前投递记录的进度编辑器。
- 当前投递记录的进度 Steps。
- 每个进度节点均可点击或通过键盘展开详情；同一条投递一次只展开一个节点，再次触发当前节点时收起。
- 节点详情展示环节名称、状态、节点日期和备注；空日期显示“未填写”，空备注显示“暂无备注”，备注内的 HTTP/HTTPS URL 使用安全的新窗口外链。

投递详情字段在桌面只读端使用五列等宽布局；可编辑端在末尾增加等宽的操作列。所有字段的标签和内容必须分别排列在同一水平线上，内容锚点统一居中；进入移动端后改为两列等宽布局，岗位名称与操作区各自独占整行，字段标签和值恢复左对齐且不得产生水平滚动。

进度 Steps 遵循 TDesign 的步骤条语义：桌面端和窄屏端均使用横向等比例排列；节点直径为 22px，桌面端连接线使用 4px 圆角分段，移动端收窄为 2px；已完成节点与连接线使用品牌蓝，当前节点使用品牌蓝实心圆、浅蓝焦点环及 `aria-current="step"`，未开始节点与连接线使用中性占位色。当前状态同时通过文字和节点形态表达，不能只依赖颜色。进度区域不使用彩色边框、虚线分隔或额外的高饱和背景。

展开内容的信息组织参考个人申请记录页面的“字段标签 + 岗位信息 + 横向招聘进度”层级，同时使用 TDesign 的中性分割线、品牌蓝和步骤条语义；不引入阿里品牌橙色，也不复制其品牌视觉资产。

修改某个投递子记录不得影响同公司其他投递。

列表筛选规则：

- 默认筛选为“进行中”，展示至少包含一条非终态投递的公司，并在展开后只展示非终态投递。
- “全部投递”展示全部公司投递子记录。
- 阶段筛选按 `progressPhase` 计算，不按用户可修改的环节名称猜测。
- 搜索范围包括公司名称、公司招聘链接、行业类型、招聘批次、优先度、岗位名称、投递链接、状态页链接、工作地点和投递备注。
- 招聘信息页的优先度筛选提供“全部优先度、P0、P1、P2”，行业筛选提供“全部行业”和当前行业预置选项；关键词、优先度和行业筛选使用 AND 关系共同计算列表结果。

### 5.6 手机只读布局

- 页面支持宽度至少从 320px 开始正常展示。
- 岗位投递与招聘信息两个页面的标题、说明、统计卡片、表头、数据字段、链接、按钮和进度标签均保持单行展示；当内容超过所在容器可用宽度时使用省略号截断，不得换行或撑出水平滚动。
- 顶部统计卡片在手机端使用两列布局。
- 页面字号以 15～16px 正文为基准，辅助文字原则上不小于 12px；移动端不得通过整体缩小字号换取空间。
- 工具栏、公司摘要和投递摘要改为纵向或分行布局。
- “岗位投递”公司摘要在移动端隐藏桌面表头，公司名称独占首行，投递链接与投递岗位数并排展示，已投递岗位独占下一行并保持单行省略；展开后的申请记录区块将岗位元数据改为两列，招聘进度与编辑控件保持清晰分组。
- “招聘信息”不得通过简单隐藏字段造成关键信息缺失，应改为卡片式分行展示。
- 公司名称独占移动卡片首行；行业类型与招聘批次、优先度与招聘链接、投递岗位数与最近更新分别组成稳定的两列分组，避免单字段纵向堆叠形成大块无效空白。
- 招聘进度在窄屏端仍保持横向排列，并通过等比例列宽、2px 连接线和文字换行完整展示。
- 节点详情在窄屏端占满投递记录可用宽度，日期和备注改为单列排列，不产生页面级水平滚动。
- 手机端字号和触控区域需要单独优化，不直接沿用桌面端的小字号；招聘信息卡片底部“投递、编辑、删除”操作的最小触控高度为 44px。
- 核心信息不得依赖水平滚动查看。
- MVP 直接提供响应式网页，不要求安装 PWA。

### 5.7 通用页面状态与可访问性

- Dashboard、Popup 和手机 Web 必须分别提供加载中、空数据、可重试错误和成功反馈状态。
- 本地 Repository 写入失败时不得先显示成功；CloudBase 同步失败与本地保存失败必须使用不同文案。
- 所有弹窗必须支持键盘焦点管理、Esc 关闭、关闭后焦点回到触发按钮，以及明确的表单标签和错误提示。
- 不能只使用颜色表达当前状态；时间线节点、文字或辅助标签需要同时表达状态含义。
- 手机端主要触控目标最小尺寸为 44×44 CSS 像素。
- 外部链接使用新标签页打开，并设置 `noopener noreferrer`。

## 6. 招聘进度时间线

### 6.1 时间线展示

每条投递记录都有独立的自定义招聘进度流程。

```text
    ●────────●────────●────────●
   投递      筛选      面试      结果
```

展示规则：

- 环节文字显示在对应节点下方。
- 节点和连接线独立占一层。
- 当前环节使用品牌蓝实心节点、品牌蓝文字和浅蓝外圈突出显示，并通过详情中的最新更新日期表达更新时间。
- 已完成环节使用带对勾的品牌蓝节点和品牌蓝连接线。
- 未到达环节使用中性灰色边框节点和中性连接线。
- 已完成、当前和未到达状态只由环节数组顺序与 `currentStageId` 决定，不能根据日期是否为空推断。
- 当前投递的摘要区域显示“当前环节：环节名称 · 时间”。
- 右下角不再重复显示编辑按钮。
- 每条投递只在电脑编辑模式的招聘进度标题旁保留“编辑进度”按钮。

### 6.2 自适应布局

桌面端：

- 时间线使用等比例自适应列宽。
- 环节文字允许换行，并与对应节点保持居中关联。
- 进度卡片使用可用内容宽度，不设置不必要的固定宽度。
- 不出现水平滚动条。

窄屏端：

- 时间线保持横向等比例排列。
- 节点位于对应环节文字上方，环节文字允许换行。
- 连接线水平连接相邻节点，移动端收窄至 2px。
- 不要求用户左右滚动查看完整流程。

### 6.3 默认流程

1. 已投递，阶段为 `submitted`。
2. 筛选，阶段为 `screening`。
3. 笔试，阶段为 `assessment`。
4. 技术一面，阶段为 `interview`。
5. HR 面，阶段为 `interview`。
6. 结果，阶段为 `result`。

默认流程只是初始模板，每条投递可以单独调整。

## 7. 进度编辑功能

本节功能只在电脑编辑模式开放。点击招聘进度标题旁的“编辑进度”后打开流程编辑弹窗。

用户可以：

- 新增环节。
- 删除环节。
- 修改环节名称。
- 为环节选择稳定阶段分类。
- 标记该环节是否为终态。
- 调整环节顺序。
- 为每个环节填写或修改日期。
- 为每个环节填写或修改备注、面试链接或准备事项。
- 指定当前环节。
- 保存或取消修改。

编辑器要求：

- 当前环节使用绿色边框和绿色单选状态提示。
- 环节名称、日期、排序按钮和删除按钮分列布局。
- “备注或面试链接”使用多行输入并独占环节编辑项的下一行，最多 5000 个字符；保存时去除首尾空白但保留内部换行。
- 窄屏下编辑项自动分行，避免控件互相覆盖。
- 环节名称不能为空。
- 环节阶段不能为空；任一阶段都允许因淘汰、撤回等原因成为终态，`closed` 阶段必须为终态。
- 至少保留一个环节。
- 删除当前环节时，默认将删除后相同位置的环节设为当前环节；如果删除的是最后一项，则选择新的最后一项，并要求用户在保存前确认。
- 点击保存后只更新当前 `Application`。
- 取消时不应保存临时修改。

快速进度下拉：

- 位于每个投递卡片右上区域。
- 用于快速切换当前环节。
- 如果目标环节没有时间，切换时按用户本地时区写入当天日期；已有环节日期不得自动清除。
- 详细的环节增删改序仍通过“编辑进度”完成。
- 手机只读模式不渲染快速进度下拉。

## 8. 招聘进度状态体系

稳定阶段顺序为：

```text
submitted → screening → assessment → interview → result → closed
```

| 阶段代码 | 中文名称 | 内置环节示例 | 默认终态 |
|---|---|---|---:|
| `submitted` | 已投递 | 已投递 | 否 |
| `screening` | 筛选 | 简历筛选、筛选通过、筛选未通过 | “筛选未通过”为是 |
| `assessment` | 笔试 | 测评、笔试、笔试未通过 | “笔试未通过”为是 |
| `interview` | 面试 | 初面、技术一面、技术二面、技术三面、HR 面、面试未通过 | “面试未通过”为是 |
| `result` | 结果 | Offer、候选人待定、已接受、已拒绝 | “已接受”“已拒绝”为是 |
| `closed` | 关闭 | 已撤回、已关闭 | 是 |

自定义时间线环节可以使用任意显示名称，但必须选择上述一个稳定阶段。统计、筛选和聚合只依赖阶段代码与终态标记，不根据环节名称做正则或模糊推断。

明确规则：

- `progressStatus` 等于当前环节显示名称。
- `progressPhase` 等于当前环节的稳定阶段代码。
- `progressIsTerminal` 等于当前环节的终态标记。
- 保存流程或快速切换时，系统必须同时更新以上三个派生字段和 `progressUpdatedDate`。
- 用户重命名自定义环节不得改变其阶段分类。
- 公司聚合行的状态汇总不可直接编辑。
- 进度修改必须作用于具体 `Application.id`。
- MVP 不提供“待投递”阶段；计划岗位管理属于非目标。

## 9. 功能需求

### F-001 公司招聘信息采集

Popup 只展示：

- 公司名称。
- 公司招聘链接。

Popup 不展示公司备注、行业类型、招聘批次、优先度、投递日期、工作地点、投递链接、招聘进度、状态页链接、内推信息和投递备注。行业类型、招聘批次与优先度在 Dashboard 中由用户维护。

### F-002 公司管理

- 新增、编辑、删除公司。
- 查看公司招聘链接。
- 编辑行业类型、招聘批次和优先度；行业类型支持预置选项并为后续自定义选项保留扩展能力，招聘批次与优先度使用封闭枚举。
- 查看公司关联的全部投递。
- 从招聘信息列表点击“投递”时进入新增岗位投递流程，并自动预选当前公司。
- 删除没有投递的公司时需要普通确认。
- 删除存在投递的公司时必须明确展示将级联删除的投递数量并二次确认；确认后公司与关联投递必须在一次本地原子写入中删除，禁止留下孤立投递。
- 公司招聘链接更新不得修改任何投递记录。
- 新增或重命名公司时，如果规范化名称与已有公司一致，只展示候选并由用户决定更新已有公司或继续创建，不得静默合并。
- 所有写操作只在电脑编辑模式开放。

### F-003 手动新增投递

投递记录由用户在电脑端手动创建，字段包括：

| 字段 | 必填 | 说明 |
|---|---:|---|
| 投递公司 | 是 | 选择已有公司 |
| 岗位名称 | 否 | 用户填写和编辑，最多 200 个字符 |
| 招聘投递链接 | 否 | 用户填写 |
| 工作地点 | 否 | 用户填写 |
| 查看投递状态页面 | 否 | 用户填写 |
| 投递时间 | 是 | 默认当天 |
| 招聘进度 | 是 | 默认“已投递” |
| 是否内推 | 是 | 默认否 |
| 内推码 | 否 | 使用内推时可填写，不作为保存前置条件 |
| 投递备注 | 否 | 自由文本 |

投递记录支持编辑和删除：

- 编辑基本字段不得重建 `Application.id`，也不得修改同公司的其他投递。
- 岗位名称属于当前投递的基本字段，编辑后在投递卡片和只读 Web 中展示，不影响进度、公司聚合或同公司的其他投递。
- 删除投递必须确认；删除后只移除当前 `Application`。
- 投递链接和状态页链接为空时允许保存；非空时只接受 HTTP/HTTPS URL。
- `appliedDate` 和进度环节日期使用用户本地日历日期 `YYYY-MM-DD`，不通过 UTC 截断生成“当天”。

### F-004 投递列表与进度管理

- 默认使用“进行中”筛选，展示至少有一条非终态投递的公司。
- 提供“全部投递”筛选。
- 提供按稳定阶段代码筛选，不按自定义环节名称猜测。
- 公司展开后展示符合筛选条件的投递子记录。
- 电脑端每个子记录提供快速进度下拉。
- 电脑端每个子记录在招聘进度标题旁提供“编辑进度”按钮。
- 修改一个子记录的进度不会影响同公司的其他记录。
- 进度更新时间随快速切换或保存编辑自动刷新。
- 手机端复用列表、筛选、聚合和时间线展示，但不提供写操作。

### F-005 导入导出

CSV 用于表格编辑、数据迁移和再次导入。一次完整导出必须覆盖当前全部 `CompanyRecord` 和 `Application`，包括没有投递记录的公司，并能够在导出后重新导入且不丢失用户维护的业务数据。

CSV 使用单文件混合记录格式，表头固定为：

| 列名 | 适用记录 | 说明 |
|---|---|---|
| `schemaVersion` | 全部 | 必填；CSV 结构版本，MVP 固定为 `1` |
| `recordType` | 全部 | 必填；只接受 `company` 或 `application` |
| `companyId` | 全部 | 导出时必填；公司稳定业务 ID，也是投递关联公司的外键；外部导入时允许留空 |
| `companyName` | 全部 | 必填；投递行重复保存以便阅读和名称回退匹配 |
| `recruitmentLink` | `company` | 公司招聘链接，可为空 |
| `industryType` | `company` | 行业类型，可使用预置选项或用户自定义选项 |
| `recruitmentBatch` | `company` | 招聘批次，只接受“秋招正式批”“秋招提前批”“春招正式批” |
| `priority` | `company` | 优先度，只接受 `P0`、`P1`、`P2` |
| `companyNotes` | `company` | v1.5 及更早版本的弃用兼容列；新版本不展示、不采集且导出为空 |
| `companyCreatedAt` | `company` | 公司创建时间，ISO 8601 UTC 字符串；外部导入时允许留空 |
| `companyUpdatedAt` | `company` | 公司更新时间，ISO 8601 UTC 字符串；外部导入时允许留空 |
| `applicationId` | `application` | 导出时必填；投递稳定业务 ID；外部导入时允许留空 |
| `jobTitle` | `application` | 岗位名称，可为空；用户可在电脑端手动维护，最多 200 个字符 |
| `applicationLink` | `application` | 投递链接，可为空 |
| `workLocation` | `application` | 工作地点，可为空 |
| `statusLink` | `application` | 查看投递状态页面，可为空 |
| `appliedDate` | `application` | 必填；投递日期，格式为 `YYYY-MM-DD` |
| `progressStatus` | `application` | 必填；当前招聘进度，便于表格查看和简单编辑 |
| `progressPhase` | `application` | 必填；当前稳定阶段代码 |
| `progressIsTerminal` | `application` | 必填；当前环节是否终态，只接受 `true` 或 `false` |
| `progressUpdatedDate` | `application` | 必填；进度更新时间，格式为 `YYYY-MM-DD` |
| `isReferral` | `application` | 必填；是否内推，只接受 `true` 或 `false` |
| `referralCode` | `application` | 内推码，可为空 |
| `applicationNotes` | `application` | 投递备注，可为空 |
| `progressStages` | `application` | 完整进度环节数组的 JSON 字符串，保留环节 ID、名称、阶段、终态、日期、备注和数组顺序；外部导入时允许留空 |
| `currentStageId` | `application` | `progressStages` 非空时必填，且必须指向其中一个环节 |
| `applicationCreatedAt` | `application` | 投递创建时间，ISO 8601 UTC 字符串；外部导入时允许留空 |
| `applicationUpdatedAt` | `application` | 投递更新时间，ISO 8601 UTC 字符串；外部导入时允许留空 |

导出规则：

- 每个 `CompanyRecord` 导出一行 `recordType=company`，因此没有投递的公司也不会丢失。
- 每个 `Application` 导出一行 `recordType=application`，并通过 `companyId` 关联公司。
- 同一公司的多条投递导出为多行独立投递记录，重新导入后仍按公司聚合展示。
- `normalizedCompanyName` 是派生字段，不写入 CSV，导入时根据 `companyName` 重新计算。
- CSV 不包含 CloudBase `_openid`、登录令牌或任何密钥。
- 文件编码使用带 BOM 的 UTF-8。包含逗号、双引号或换行的字段必须使用双引号包裹，字段内部双引号按 CSV 规则写成两个双引号。

导入规则：

- 导入器先解析和校验全部行，再执行本地写入；存在结构错误时不得部分写入。
- `schemaVersion` 不是当前支持版本时拒绝导入并提示升级或转换文件。
- 导入顺序不影响结果，系统必须先建立公司映射，再写入投递记录，禁止产生孤立投递。
- `companyId` 或 `applicationId` 与本地已有记录一致时更新该记录。公司行缺少 `companyId` 时先按规范化 `companyName` 匹配，单一匹配项由用户确认更新，没有匹配项时才生成新的稳定业务 ID。
- 投递行携带的 `companyId` 必须能关联导入文件中的公司行或本地已有公司，否则该行报错；缺少 `companyId` 时使用规范化后的 `companyName` 匹配公司，没有匹配项时创建公司，存在多个候选时要求用户确认。
- 已有 ID 采用完整记录覆盖语义：CSV 中可选字段为空表示清空该字段，不表示保留旧值；导入预览必须展示将被更新的记录数。
- 同一文件出现重复 ID、相同 ID 对应不同公司名称、投递行 `companyId` 与公司行矛盾、ID 对应名称与本地记录冲突，或已有 `applicationId` 被关联到不同公司时必须报错，不能按最后一行静默覆盖或无提示移动投递。
- 多条没有 `applicationId` 的投递行必须创建为多条独立投递，不得按公司名称合并为一条。
- `progressStages` 非空时必须是合法 JSON 数组，且至少包含一个环节；每个环节必须包含合法阶段和终态标记，`note` 缺失时按旧数据兼容为空字符串，非字符串或超过 5000 个字符时拒绝导入；`currentStageId` 必须指向其中一个环节，`progressStatus`、`progressPhase` 和 `progressIsTerminal` 以当前环节为准。
- `progressStages` 为空时，系统使用 `progressStatus`、`progressPhase`、`progressIsTerminal` 和 `progressUpdatedDate` 创建一个当前环节，节点备注默认为空；用户后续可以在进度编辑器中扩展流程。
- ID 为空时由系统生成；创建时间或更新时间为空时使用导入提交时的当前时间。
- 导出到表格的文本字段如果以 `=`、`+`、`-`、`@`、制表符、回车或换行开头，在内容前增加一个单引号作为转义；原文本如果以单引号开头则再增加一个单引号。导入当前 `schemaVersion` 时按相反规则只移除一层由本产品增加的前缀，保证本产品 CSV 往返后原始文本不变且表格软件不执行公式。
- 导入前按导入后的完整数据计算序列化字节数，预计超过 8 MiB 时拒绝提交。
- 导入前展示新增、更新和错误数量，用户确认后才提交；导入成功作为一次本地批量变更，只触发一次延迟快照同步。
- CSV 导入导出只在电脑编辑模式开放，手机只读模式不得挂载入口或导入处理逻辑。

### F-006 用户登录

- MVP 只提供 CloudBase 用户名密码登录，使用一个由管理端预先创建的个人账号，不提供注册入口。
- 电脑扩展和手机网页使用同一个 CloudBase 账号体系。
- 登录状态过期时提示用户重新登录。
- 退出登录不删除电脑本地数据。
- 手机端未登录时不得读取任何用户快照。
- 登录、令牌续期和账号状态由 CloudBase 身份认证管理。
- 页面登录守卫必须使用 CloudBase Web SDK v3 `auth.getSession()` 的真实 Session，不使用已废弃或可能产生误判的登录状态 API。
- 用户名、密码和令牌不得写入业务 Repository；会话持久化由 CloudBase SDK 管理。
- 认证调用通过 `AuthService` 适配器封装，为后续切换邮箱验证码或 OAuth 保留边界。
- MVP 不提供注册、邮箱验证和密码找回界面；账号创建和密码重置通过 CloudBase 管理端完成。

### F-007 CloudBase 只读快照同步

- 电脑端 `chrome.storage.local` 是唯一可编辑主数据源。
- 云端使用 CloudBase 文档型数据库的 `user_snapshots` 集合。
- 用户登录后，可以点击“立即同步”。
- 本地数据变更成功后，系统自动延迟合并并上传一次完整快照，避免连续频繁请求。
- 自动同步失败时保留本地数据，并显示失败状态和“重试”入口。
- 每次上传使用当前完整数据覆盖该用户上一份快照。
- 快照保存 `schemaVersion`、`ownerId`、`sourceDeviceId`、`sourceRevision` 和 CloudBase 服务端更新时间。
- 每个快照文档必须记录数据所有者，并由安全规则限制为所有者本人可读写。
- 登录账号与本地 `boundUserId` 不一致，或检测到另一编辑设备时，不得自动上传。
- 同步状态统一使用 `signedOut`、`idle`、`dirty`、`syncing`、`synced`、`failed`、`accountMismatch` 和 `deviceConflict`，界面文案不得把 `dirty` 或 `failed` 显示为已同步。
- MVP 不实现字段级增量同步、双向同步和冲突合并。
- 云端数据不得覆盖电脑本地数据。

### F-008 手机只读 Dashboard

- 用户通过公开 HTTPS 地址访问响应式 Web Dashboard。
- 登录后读取当前 CloudBase 账号最新快照。
- 支持查看顶部统计、公司列表、投递列表和进度时间线。
- 支持标签切换、搜索、筛选、公司展开和外部链接跳转。
- 页面显著展示“只读模式”和“数据更新时间”。
- 手机端不显示新增、编辑、删除、导入、快速切换进度和同步上传入口。
- 无快照时展示引导：请先在电脑扩展中登录并同步。
- 网络失败时展示可重试错误，不显示伪造或过期成功状态。

## 10. 数据模型

### 10.1 `CompanyRecord`

```js
{
  id: "company-uuid",
  companyName: "示例公司",
  normalizedCompanyName: "示例公司",
  recruitmentLink: "https://example.com/careers",
  industryType: "互联网",
  recruitmentBatch: "秋招正式批",
  priority: "P0",
  createdAt: "2026-08-08T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z"
}
```

### 10.2 `Application`

```js
{
  id: "application-uuid",
  companyId: "company-uuid",
  jobTitle: "前端开发工程师",
  applicationLink: "https://example.com/apply/record",
  workLocation: "北京 / 远程",
  statusLink: "https://example.com/my-applications",
  appliedDate: "2026-08-08",
  progressStatus: "已投递",
  progressPhase: "submitted",
  progressIsTerminal: false,
  progressUpdatedDate: "2026-08-08",
  isReferral: true,
  referralCode: "REF-2026",
  progressStages: [
    { id: "stage-1", name: "已投递", phase: "submitted", isTerminal: false, date: "2026-08-08", note: "" },
    { id: "stage-2", name: "筛选", phase: "screening", isTerminal: false, date: "", note: "" },
    { id: "stage-3", name: "笔试", phase: "assessment", isTerminal: false, date: "", note: "" },
    { id: "stage-4", name: "技术一面", phase: "interview", isTerminal: false, date: "", note: "面试会议：https://meeting.example.com/round-1" },
    { id: "stage-5", name: "HR 面", phase: "interview", isTerminal: false, date: "", note: "" },
    { id: "stage-6", name: "结果", phase: "result", isTerminal: false, date: "", note: "" }
  ],
  currentStageId: "stage-1",
  applicationNotes: "",
  createdAt: "2026-08-08T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z"
}
```

进度字段规则：

- `CompanyRecord.id` 和 `Application.id` 在本地数据集中必须唯一且创建后不可变；每个 `Application.companyId` 必须指向已有公司。
- `CompanyRecord.industryType` 由用户维护；预置选项不是封闭枚举，后续允许新增自定义值。
- `CompanyRecord.recruitmentBatch` 必须是“秋招正式批”“秋招提前批”“春招正式批”之一。
- `CompanyRecord.priority` 必须是 `P0`、`P1`、`P2` 之一。
- `jobTitle` 可为空，最多 200 个字符；它是用户维护的展示字段，不由解析器推断。
- `progressStages` 按用户定义的顺序保存。
- `currentStageId` 指向当前环节。
- 每个环节可以有独立日期和 `note` 备注，均允许为空；`note` 最多 5000 个字符，可包含换行和 HTTP/HTTPS 面试链接。
- 同一条投递内的环节 ID 必须唯一。
- 每个环节必须包含 `phase` 和 `isTerminal`；环节显示名称允许自定义。
- 保存流程编辑或快速切换时同步更新 `progressStatus`、`progressPhase`、`progressIsTerminal` 和 `progressUpdatedDate`。
- 上述三个进度摘要字段是当前环节的派生副本，Repository 写入前必须校验一致性。
- `progressStages` 属于 `Application`，不属于公司记录。
- `applicationLink` 和 `statusLink` 可为空，非空时最多 2048 个字符且只允许 HTTP/HTTPS。
- `workLocation` 最多 200 个字符，`referralCode` 最多 200 个字符，`applicationNotes` 最多 5000 个字符。
- `appliedDate` 不得晚于用户本地当天；`isReferral=false` 时保存前清空 `referralCode`。
- 每条投递至少保留 1 个、最多保存 30 个进度环节；环节名称去除首尾空白后长度为 1～80 个字符。

### 10.3 `CloudSnapshot`

```js
{
  _id: "cloudbase-user-id",
  _openid: "cloudbase-platform-managed-owner",
  ownerId: "cloudbase-user-id",
  schemaVersion: 1,
  sourceDeviceId: "device-uuid",
  sourceRevision: 42,
  data: {
    companies: [],
    applications: []
  },
  updatedAt: new Date("2026-08-08T10:00:00.000Z")
}
```

CloudBase 文档型数据库集合：

```text
user_snapshots/{cloudbaseUserId}
├── _id              String，取 CloudBase 用户 ID
├── _openid          String，CloudBase 平台自动记录的数据所有者，不由业务代码伪造
├── ownerId          String，当前 CloudBase 用户 ID
├── schemaVersion    Number
├── sourceDeviceId   String，唯一编辑设备 ID
├── sourceRevision   Number，本地单调递增修订号
├── data             Object，包含 companies 和 applications
└── updatedAt        Date，使用 CloudBase 服务端时间
```

数据规则：

- 每个 CloudBase 用户 ID 只能存在一份最新快照。
- 集合禁止匿名访问，Web 客户端只能读取 `_id` 和 `ownerId` 都属于当前 `auth.uid` 的文档；客户端直接创建、更新和删除快照均关闭。
- 所有快照写入统一调用已认证的 `recruitmentSnapshot` Event Function。函数只使用平台注入的真实 `uid`，忽略客户端传入的 owner 字段，并在服务端固定 `_id`、`ownerId` 和 `updatedAt`。
- Event Function 通过服务端 SDK 写数据库时会绕过客户端安全规则，因此函数必须自行校验登录身份、8 MiB 容量、数据结构和账号边界；跨账号 owner 请求必须在写入前拒绝。
- `_id` 固定使用当前用户 ID；服务端写入采用同一文档的幂等覆盖，不使用随机文档 ID。
- 数据隔离由数据库只读规则和 Event Function 服务端鉴权共同保证，不依赖 React 界面的“只读模式”。
- 前端只包含 CloudBase 环境 ID、客户端可公开配置和 Publishable Key。
- 前端不得包含 SecretId、SecretKey、管理员凭证或服务端 API Key。
- 手机只读是产品交互限制；账号数据隔离由 CloudBase 身份认证和数据库安全规则保证。

### 10.4 本地存储信封

`chrome.storage.local` 使用单一版本化信封保存业务数据、界面偏好和同步元数据：

```js
{
  schemaVersion: 1,
  data: {
    companies: [],
    applications: []
  },
  settings: {
    activeTab: "applications",
    boundUserId: null,
    deviceId: "device-uuid"
  },
  sync: {
    localRevision: 0,
    lastSyncedRevision: 0,
    dirty: false,
    status: "idle",
    lastSyncedAt: null,
    lastError: null
  }
}
```

规则：

- 每次成功的本地业务写入都使 `localRevision` 加一并设置 `dirty=true`。
- 只有云端成功保存同一修订号后，才能更新 `lastSyncedRevision`、清除 `dirty` 并记录 `lastSyncedAt`。
- `activeTab` 不属于业务数据，修改它不增加业务修订号，也不触发快照同步。
- 本地存储信封遇到不支持的 `schemaVersion` 时停止写入并提示升级，不得尝试按当前结构覆盖。
- 业务 ID 使用 `crypto.randomUUID()`；时间戳保存为 UTC ISO 8601，业务日期保存为用户本地日历日期 `YYYY-MM-DD`。

## 11. React、扩展与 CloudBase 技术方案

### 11.1 MVP 技术栈

| 模块 | 方案 |
|---|---|
| 开发语言 | JavaScript ES2022+ / JSX |
| 前端 UI | React 函数组件 + Hooks |
| 构建工具 | Vite + npm |
| 扩展规范 | Manifest V3 |
| 扩展本地存储 | `chrome.storage.local` |
| 扩展权限 | `storage`、`activeTab`、`scripting`、`alarms`、`offscreen`；仅为托管桥接页配置最小化 `host_permissions` |
| 解析 | `ParserOrchestrator` + `SiteAdapter` + 通用回退解析器 |
| 云端 SDK | `@cloudbase/js-sdk` 仅打包到托管 Web / 手机 Web 产物；扩展通过本地 offscreen 中继访问隔离的托管桥接页 |
| 身份认证 | 腾讯云 CloudBase 身份认证，MVP 使用预创建个人账号的用户名密码登录 |
| 云端数据库 | CloudBase 文档型数据库 `user_snapshots` 集合 |
| 云端写入 | `recruitmentSnapshot` Event Function，使用平台真实 `uid` 幂等覆盖唯一快照 |
| 数据权限 | CloudBase 数据库规则仅允许所有者读取；写入由 Event Function 服务端鉴权 |
| Web 部署 | CloudBase 静态网站托管 |
| 单元与组件测试 | Vitest + React Testing Library |
| 端到端与响应式测试 | Playwright |

### 11.2 React 组件边界

```text
Extension
├── PopupApp
│   ├── ParseStatus
│   ├── CompanyCaptureForm
│   └── OpenDashboardAction
└── DashboardApp
    ├── SyncAccountPanel
    ├── TopBar / TopTabs / StatisticsCards
    ├── RecruitmentView
    │   └── CompanyTable
    ├── ApplicationsView
    │   └── CompanyCard
    │       └── ApplicationCard
    │           └── ProgressTimeline
    ├── ProgressEditorModal
    ├── ApplicationFormModal
    ├── CompanyFormModal
    ├── CsvImportModal
    └── SyncStatus

WebApp
├── AuthGate
└── ReadonlyDashboard
    └── 复用 StatisticsCards、CompanyCard、ApplicationCard 和 ProgressTimeline
```

要求：

- `ProgressTimeline`、统计计算、筛选逻辑和公司聚合逻辑在电脑端与手机端复用。
- 写操作组件通过 `mode` 或权限属性控制，不在只读模式挂载。
- 不通过 CSS 隐藏来代替权限判断；只读模式不得创建写操作事件。
- 列表项使用稳定业务 ID 作为 React `key`，不得使用数组索引作为持久记录主键。
- 弹窗临时状态与已保存数据分离，取消操作不得修改 Repository。
- Popup、扩展 Dashboard 和手机 Web 使用独立 React 入口，不共用同一个根 `App` 判断运行环境。
- Content Script 和 Extension Service Worker 不挂载 React。
- 扩展 Dashboard 的本地查看和编辑不受登录守卫阻断；登录只控制 CloudBase 同步。手机 Web 必须由 `AuthGate` 阻断未登录访问。

### 11.3 状态管理

MVP 使用：

- `useState` 管理局部 UI 状态。
- `useReducer` 管理 Dashboard 数据和复杂编辑动作。
- `Context` 只用于登录用户、运行模式和 Repository 注入。
- 自定义 Hooks 封装数据加载、同步状态、筛选和弹窗逻辑。

MVP 不引入：

- Redux。
- Zustand。
- React Router。
- 服务端渲染框架。
- 大型 UI 组件库。

### 11.4 Repository 与服务边界

```text
ChromeLocalRepository
├── getEnvelope()
├── saveCompany() / deleteCompanyCascade()
├── saveApplication() / deleteApplication()
├── exportSnapshot()
└── replaceAll({ companies, applications })

CloudBaseSnapshotReader
└── getSnapshot()

CloudBaseSnapshotWriter extends CloudBaseSnapshotReader
└── replaceSnapshot()

AuthService
├── getSession()
├── signInWithPassword()
└── signOut()
```

模块职责：

- `ParserOrchestrator` 只返回公司级解析结果。
- `CompanyService` 创建和更新 `CompanyRecord`。
- `ApplicationService` 响应用户的投递新增、编辑、删除和进度更新。
- `CsvImportExportService` 负责 CSV 序列化、解析、格式校验、ID 匹配和导入预览，并在全部校验通过后调用本地 Repository 原子提交结果。
- `SnapshotService` 从本地 Repository 生成完整快照，通过托管桥接页调用 `recruitmentSnapshot` Event Function 上传 CloudBase。
- `SyncCoordinator` 负责持久化 dirty 修订号、延迟调度、单任务串行、失败重试和设备冲突检查。
- `StatisticsService` 只根据稳定阶段、终态标记和明确日期字段计算统计与聚合。
- React 组件不直接调用 `chrome.storage` 或 CloudBase SDK。
- 扩展同步服务注入由托管桥接页和 Event Function 实现的 `CloudBaseSnapshotWriter`，手机 Web 只注入 `CloudBaseSnapshotReader`；手机只读入口的组件树不得引用上传方法。

### 11.5 扩展打包和安全来源约束

- React 和 React DOM 由 Vite 打包进入扩展产物；`@cloudbase/js-sdk` 只进入托管 Web 产物，不进入扩展执行上下文。
- Manifest V3 扩展不得从 CDN 加载或执行远程 JavaScript。
- 扩展只在本地打包的 offscreen document 中嵌入固定 HTTPS 托管桥接页；该 iframe 是隔离的 Web 来源，通过固定消息协议通信，不在扩展上下文执行远程脚本。
- Manifest 只为托管桥接页域名配置最小化 `host_permissions` 和 `frame-src`，不得加入 CloudBase API 通配域名。
- 启动时将 `chrome.storage.local` 的访问级别限制为扩展受信上下文，Content Script 不直接访问完整业务数据。
- 生产包不包含 SecretId、SecretKey、管理员凭证、服务端 API Key 或未使用的权限。
- Chrome 扩展安全来源 PoC 已确认 CloudBase 会拒绝 `chrome-extension://` 来源，且扩展 ID 不能登记为安全域名；生产方案固定为“Service Worker + offscreen document + 托管 Web 桥接页 + Event Function”，不再保留扩展直连 SDK 分支。
- 托管桥接页负责用户名密码登录、真实 `getSession()`、令牌持久化和函数调用；Service Worker 负责 dirty 状态、`chrome.alarms` 和消息调度。Dashboard 关闭后仍必须能重建 offscreen document、恢复托管来源 Session 并上传待处理快照。
- 桥接协议必须校验 iframe 来源、扩展父来源、消息 channel、请求 ID 和超时；用户名、密码和令牌不得写入业务 Repository 或跨消息返回给扩展。
- 手机 Web 域名必须加入 CloudBase 安全来源白名单。
- 生产自定义域名按要求完成 HTTPS 和 ICP 备案。

### 11.6 建议目录结构

```text
Recruitment-Tracker/
├── dashboard-tdesign.html         # 已确认的 TDesign 原型参考
├── apps/
│   ├── extension/
│   │   ├── index.html / dashboard.html       # Popup 与 Dashboard 独立入口
│   │   └── src/                     # Popup、Dashboard、Content Script、Service Worker
│   └── web/
│       └── src/                     # 手机只读 Web 入口
├── packages/
│   ├── core/src/                # 模型、校验、Repository 接口、服务、统计、解析
│   └── ui/src/                  # 可复用 React 展示组件和设计变量
├── tests/
├── apps/extension/manifest.config.js
└── package.json
```

当前仓库已经采用上述 npm workspaces 结构。`packages/core` 和 `packages/ui` 是正式共享边界，不再按旧的根目录单 `src/` 方案开发。

### 11.7 开工前 CloudBase 环境门槛

- 当前环境必须保持 NoSQL 文档数据库模式，不切换到 PG。
- 用户名密码登录方法和 Publishable Key 必须可用；MVP 不依赖当前未启用的邮箱 Provider。
- `user_snapshots` 集合安全规则必须只允许已登录所有者读取，并关闭客户端直接写入；通过两个仅用于开发验收的管理端测试账号验证读取规则与 Event Function 账号边界，这不代表产品支持多账号使用。
- 本地 Vite 实际端口和生产 Web 域名必须分别加入安全来源并验证；扩展来源不直接访问 CloudBase，只允许嵌入固定桥接页来源。
- 首次 Web 发布使用 CloudBase 应用部署能力创建独立应用和域名；后续更新保持同一部署方式。

## 12. 数据同步流程

### 12.1 电脑端保存

```text
用户编辑
  → React 表单校验
  → Service 执行业务规则
  → ChromeLocalRepository 原子保存并增加 localRevision
  → Dashboard 立即更新
  → 持久化 dirty 状态并通过 Extension Service Worker / chrome.alarms 调度
  → SnapshotService 延迟合并并经托管桥接页调用 Event Function
  → Event Function 读取平台 uid、校验并幂等覆盖 CloudBase 完整快照
```

### 12.2 手机端查看

```text
用户打开 CloudBase 静态托管的 Web Dashboard
  → CloudBase 身份认证
  → CloudBaseSnapshotReader 读取快照
  → 校验 ownerId、schemaVersion 和数据结构
  → React 以 readonly 模式渲染
  → 展示 CloudBase 服务端更新时间
```

### 12.3 同步规则

- 本地保存与 CloudBase 同步分离，本地成功不依赖云端成功。
- 同一时间只执行一个快照上传任务。
- 连续本地修改应合并为一次延迟上传。
- 延迟任务不能只依赖 Dashboard 页面中的 `setTimeout`；待同步修订号和下次调度必须持久化，并由 Extension Service Worker 与 `chrome.alarms` 恢复执行。
- 上传开始后如果本地又产生更高修订号，本次成功只更新已上传修订号，仍保持 `dirty=true` 并继续调度最新快照。
- 上传失败可重试，但不得重复创建多份用户快照。
- 自动重试使用有限退避；用户点击“立即同步”时可以跳过等待并重试当前最新修订号。
- 未登录时本地编辑正常保存并保持待同步；下次成功登录且账号绑定一致时继续同步。
- 云端存在不同 `sourceDeviceId` 时停止自动覆盖并显示单编辑设备冲突提示；只有用户完成明确的本机接管确认后才能覆盖，产品不执行字段合并或云端到本地恢复。
- 手机端不产生业务写操作，因此 MVP 不存在双向冲突。
- 手机端看到的数据可能晚于电脑本地，必须显示最后同步时间。
- Web 读取到不支持的 `schemaVersion` 时展示“版本不兼容，请升级扩展或网页”，不得按空数据渲染。

## 13. MVP 验收标准

### 13.1 React 实现和页面布局

- 正式 Dashboard 使用 React + Vite 实现。
- Popup、扩展 Dashboard 和手机 Web 使用三个独立入口，扩展 Popup 不渲染完整 Dashboard。
- `PRD.md` 能链接到 `dashboard-tdesign.html` 原型。
- React 页面与原型的主题色、布局层级和主要交互一致。
- 页面不使用左侧导航栏。
- 左上角存在“岗位投递 / 招聘信息”标签切换，桌面与移动端复用同一组控件。
- 两个标签页顶部均有四张对齐的统计卡片。
- 页面在桌面端使用全宽内容布局。
- 窄屏端不出现必须左右滚动才能理解的核心信息。
- 当页面加载、本地无数据或 Repository 失败时，系统分别展示加载、空状态和可重试错误，不把失败显示为成功。
- 弹窗通过键盘完成打开、填写、保存、取消和焦点返回；当前状态不只依赖颜色表达。

### 13.2 采集、公司与投递管理

- 当用户点击扩展图标时，解析器只返回公司名称、招聘链接候选和 `parsedAt`，不返回公司备注且不创建投递。
- 解析失败时用户可以在 Popup 手动填写并保存公司。
- Popup 不显示公司备注输入框。
- 用户可以新增、编辑和删除公司，也可以新增、编辑和删除具体投递。
- 删除含投递的公司时显示级联数量并二次确认，确认后不存在孤立投递。
- 同一家公司在“岗位投递”中只显示一行。
- 招聘信息列表顶部在搜索框右侧提供优先度和行业两个下拉筛选控件；三项条件可组合筛选，移动端搜索框独占一行、两个筛选器等宽并排。
- 招聘信息列表展示公司图标、公司名称、行业类型、招聘批次、优先度、独立的招聘链接列、投递岗位数和最近更新，不展示公司备注或最近进度列；行业类型、招聘批次和优先度均使用与正文列一致的可编辑普通文字，招聘链接使用主题蓝；桌面端各语义列等宽，公司列左对齐且其余列内容锚点居中，移动端所有字段左对齐。
- FaviconKit 图标加载失败时显示浅主题色圆角矩形和公司名称首字，不显示破损图片。
- 岗位投递列表顶部搜索框直接替代“岗位投递进度”标题；公司摘要独立展示投递链接、已投递岗位和投递岗位数，不展示最近进度列。
- 岗位投递页的投递范围和招聘阶段两个筛选器位于搜索框右侧；移动端搜索框独占一行、两个筛选器等宽并排。
- 展开公司后能看到多条独立申请记录；每条记录完整展示投递岗位名称、岗位链接、岗位工作地点、投递日期、最新更新日期，以及紧邻招聘进度标题文字右侧的编辑进度控件；字段网格不单独展示当前进度。
- 默认“进行中”筛选只展示非终态投递，“全部投递”可以查看所有记录。
- 每条投递可以在电脑端独立编辑进度。
- 修改一条投递不会影响同公司的其他投递。
- 非空链接只接受 HTTP/HTTPS；“当天”按用户本地时区生成。

### 13.3 进度时间线

- 环节文字与节点保持明确关联：桌面端与窄屏端均位于节点下方。
- 当前环节使用 TDesign 品牌蓝实心节点和浅蓝外环突出显示，并设置 `aria-current="step"`。
- 所有节点使用原生按钮作为详情触发器，通过 `aria-expanded` 和 `aria-controls` 关联时间线下方的单一详情面板。
- 已完成环节和未到达环节有明显视觉差异。
- 已完成环节使用品牌蓝节点和对勾，未到达环节使用中性边框；状态文字和节点形态必须同时传达状态，不能只依赖颜色。
- 默认流程与数据模型均为六个环节：已投递、筛选、笔试、技术一面、HR 面、结果。
- 重命名环节后，统计和筛选仍按其稳定 `phase` 正确归类。
- “已投递岗位”统计全部 `Application`，“面试中”只统计当前面试阶段且非终态的投递。
- 桌面端时间线能够自适应完整展示，不出现水平滚动。
- 窄屏端时间线保持横向等比例排列，且不出现水平滚动。
- 桌面端连接线使用 4px 圆角分段，窄屏端连接线为 2px；已完成连接线使用品牌蓝，未完成连接线使用中性色。
- “编辑进度”按钮紧邻招聘进度标题文字右侧，不占用申请记录字段网格。
- 节点详情展示独立日期和备注，备注保留换行，HTTP/HTTPS URL 可点击且不得将普通文本解释为 HTML。
- 右下角不显示重复的“编辑环节、顺序和时间”按钮。

### 13.4 进度编辑器

- 可以新增、删除、重命名环节。
- 可以为环节选择稳定阶段和终态；关闭阶段始终为终态。
- 可以调整环节顺序。
- 可以填写每个环节的时间。
- 可以设置当前环节。
- 删除当前环节后按照约定选择新的当前环节并要求用户确认。
- 保存只影响当前投递。
- 取消不会保存临时修改。

### 13.5 CSV 导入导出

- 完整导出包含全部公司和投递，没有投递的公司也会生成 `company` 记录。
- 行业类型、招聘批次、优先度、岗位名称、投递备注、自定义进度环节、阶段、终态、环节顺序、环节日期和当前环节均可在导出后重新导入并保持一致；弃用的公司备注列不再产生新内容。
- 同一公司的多条投递重新导入后仍是多条独立子记录，并在 Dashboard 中按公司聚合。
- 导入器能够识别已有业务 ID；已有 ID 更新对应记录，缺少 ID 时创建新记录。
- CSV 中的日期、布尔值和 `progressStages` JSON 不合法时显示具体错误行，且不产生部分写入。
- CSV 中出现重复或冲突业务 ID 时停止导入并显示错误行。
- 公式注入防护在表格中不执行不可信文本，重新导入本产品 CSV 后原始文本保持一致。
- 导入后预计数据超过 8 MiB 时不得写入本地数据。
- 导入前显示新增、更新和错误摘要，并要求用户确认。
- 完成一次 CSV 导入后只触发一次延迟 CloudBase 快照同步。
- 导入导出入口只在电脑编辑模式出现，手机只读模式不创建相关事件。

### 13.6 CloudBase 登录和快照同步

- 电脑扩展和手机网页可以使用同一个预创建用户名密码账号登录，页面不提供注册入口。
- 电脑扩展未登录时仍可以查看和编辑本地数据；写入后保持 `signedOut`/`dirty`，登录成功后再同步。
- 未登录时 `auth.getSession()` 不返回真实 Session，受保护页面和快照读取均被阻止。
- 电脑本地数据保存后可以生成并上传完整快照。
- 手动“立即同步”能够覆盖 CloudBase 旧快照。
- 同步失败不影响本地数据，且用户可以重试。
- Dashboard 在延迟同步前关闭后，Extension Service Worker 仍能恢复真实 Session，并根据持久化 dirty 修订号完成任务。
- 上传期间再次修改数据时，旧修订成功不得错误清除新修订的 dirty 状态。
- 登录账号与 `boundUserId` 不一致时同步被阻止；不同 `sourceDeviceId` 不会被自动覆盖，只有明确确认本机接管后才更新唯一编辑设备。
- Event Function 首次创建、后续覆盖以及 Web 读取快照均成功，且 `_id` 始终为平台当前用户 ID，不产生重复快照。
- CloudBase 安全规则验证确认未登录、匿名和其他账号不能读取快照，且所有客户端直接创建、更新和删除请求均被拒绝。
- Event Function 验证确认未登录调用和跨账号 owner 请求在写入前被拒绝，客户端传入的 owner 字段不能改变落库所有者。
- 页面和扩展中均不包含 SecretId、SecretKey、管理员凭证或服务端 API Key。
- Chrome 扩展直连来源拒绝已被 PoC 复现；托管桥接 + Event Function 后备链路的鉴权、来源校验和跨账号拒绝全部通过。
- 手机 Web 产物只包含 `CloudBaseSnapshotReader`，不引用或实例化快照上传能力。

### 13.7 手机只读 Dashboard

- 手机 Chrome 可以通过 HTTPS 地址打开页面。
- 登录后可以看到与最近一次电脑同步一致的数据。
- 支持两个标签页、统计卡片、搜索、筛选、公司展开和进度查看。
- 页面显示“只读模式”和最后同步时间。
- 页面不显示任何业务写操作入口。
- 只读模式不只是隐藏按钮，组件树中不存在公司、投递、CSV、进度和同步上传写事件。
- 无快照、网络失败和不支持的 `schemaVersion` 显示不同提示。
- 在 320px、360px、390px 和 430px 宽度下完成响应式验收。
- 招聘信息、投递信息和时间线均不依赖水平滚动。

### 13.8 工程与容量基线

- `npm run lint`、`npm test`、`npm run build` 和 `npm run test:e2e` 均有实际依赖和配置，不是空脚本。
- 本地序列化数据达到容量预警值时页面显示占用提示，预计超过 8 MiB 的写入被阻止且原数据保持不变。
- `chrome.storage.local` 只向扩展受信上下文开放，Content Script 不能直接读取完整求职数据。
- 在扩展重载、浏览器重启、离线后恢复和登录 Session 过期场景完成回归测试。

## 14. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 公司简称或别名 | 同一公司被拆分 | 规范化匹配、候选提示、用户确认 |
| 同公司多个岗位未填写职位名称 | 子项区分困难 | 支持用户在投递编辑表单中维护岗位名称；为空时仍使用投递 ID、链接、地点、日期和备注区分 |
| 自定义环节名称过长 | 时间线排版拥挤 | 环节文字允许换行；窄屏切换纵向布局 |
| 页面窗口较窄 | 组件重叠或被截断 | React 组件采用响应式布局并执行多宽度视觉测试 |
| 用户误以为打开申请页等于已投递 | 产生虚假记录 | 解析器不创建投递，必须由用户主动新增 |
| 公司进度与岗位进度混淆 | 错误更新多个岗位 | 公司只做聚合，更新必须携带 `applicationId` |
| 自定义环节名称无法归类 | 统计和筛选结果错误 | 每个环节强制保存稳定 `phase` 和终态标记，不按名称推断 |
| CloudBase 同步失败 | 手机数据不是最新版本 | 本地优先、同步状态提示、手动重试、显示最后同步时间 |
| 快照覆盖错误账号 | 用户数据泄露或错写 | 登录确认、以 CloudBase 用户 ID 作为文档 ID、配置所有者安全规则 |
| 同一浏览器切换账号 | 将原账号本地数据上传到新账号 | 使用 `boundUserId` 绑定，账号不一致时阻止同步并要求显式导出、清空和重新绑定 |
| 第二台电脑覆盖快照 | 手机看到另一台电脑的旧数据 | MVP 单编辑设备，使用 `sourceDeviceId` 和 `sourceRevision` 检测并阻止静默覆盖 |
| 前端泄露高权限密钥 | 云端数据被越权访问 | 只打包客户端可公开配置，禁止打包 SecretId、SecretKey 和服务端 API Key |
| 扩展来源无法直连 CloudBase | 电脑端无法登录或同步 | 已采用固定托管桥接页和最小 Event Function；扩展不直连 CloudBase API |
| Service Worker 被回收 | 页面关闭后延迟同步任务丢失 | 持久化 dirty 修订号并使用 `chrome.alarms` 恢复任务，不依赖内存计时器 |
| 本地或单快照容量超限 | 本地写入或云端覆盖失败 | MVP 统一限制序列化数据不超过 8 MiB，写入和 CSV 导入前预检 |
| 页面采集内容包含恶意文本或 URL | XSS、公式注入或危险跳转 | 内容按纯文本处理、限制长度、URL 协议白名单、CSV 可逆公式防护 |
| 自定义域名未备案 | 手机 Web 无法按生产域名上线 | 提前准备域名、HTTPS 证书和 ICP 备案；开发阶段使用 CloudBase 测试域名 |
| React 状态与 Repository 不一致 | 页面显示未真正保存的数据 | 写操作必须等待本地 Repository 成功后提交正式状态 |
| CSV 结构错误或重复导入 | 数据丢失、重复或错误覆盖 | 使用 `schemaVersion`、稳定业务 ID、导入预览、全量预校验和无损往返测试 |

## 15. MVP 非目标

以下能力不属于当前 MVP：

- 手机端新增、编辑和删除。
- 手机端修改招聘进度。
- 计划岗位、收藏岗位和“待投递”管理。
- 团队、多用户共享和角色权限。
- 同一 Chrome 配置文件保存多套账号本地数据。
- 多台电脑同时编辑、自动主设备切换和跨设备冲突合并；只保留有明确警告的整份快照手动接管。
- 将云端快照恢复或合并到电脑本地；云端快照不是备份恢复源。
- 双向同步和冲突合并。
- 实时 WebSocket 同步。
- 多份历史云端快照和版本恢复。
- PWA 安装和离线编辑。
- 原生 Android / iOS App。
- 通用 Node.js / Express 业务后端；仅保留已由 PoC 证明必要的最小 `recruitmentSnapshot` Event Function。
- CloudBase PG 模式和关系型业务表。
- 服务端渲染和 SEO。
- Redux、React Router 和大型 UI 组件库。

## 16. 实施顺序

1. 完善现有 npm workspaces、ESLint、Vitest、React Testing Library 和 Playwright，拆分 Popup、扩展 Dashboard 与 Web 三个入口，保证 lint、test 和 build 基线可执行。
2. 在现有 CloudBase 测试环境完成阻塞性 PoC：验证扩展直连来源拒绝，落地托管桥接页与 `recruitmentSnapshot` Event Function；完成用户名密码登录、`getSession()`、令牌持久化、首次创建与覆盖快照、跨账号拒绝、页面关闭后上传、只读安全规则和最小 `host_permissions`。
3. 在 `packages/core` 实现版本化模型、六环节默认流程、稳定阶段与终态、字段校验、公司名称规范化、统计公式、筛选和确定性聚合，并完成纯函数单元测试。
4. 实现本地存储信封、`ChromeLocalRepository`、公司和投递 Service、级联删除、账号/设备绑定、8 MiB 容量预检及原子批量写入测试。
5. 从原型提取设计变量和响应式 CSS，在 `packages/ui` 先实现只读共享组件、页面状态和可访问性；使用固定数据验证桌面横向时间线和手机纵向时间线。
6. 在扩展 Dashboard 接入本地 Repository，完成标签、统计、搜索、筛选、公司聚合、公司 CRUD、投递 CRUD 和删除确认，形成完整本地业务闭环。
7. 实现快速进度切换和进度编辑器，包括阶段分类、终态、增删改序、日期、删除当前环节规则和派生字段一致性测试。
8. 实现独立 Popup、Content Script、Extension Service Worker、`ParserOrchestrator`、站点适配器和通用回退解析器；验证解析器只保存公司信息。
9. 实现完整 CSV 导入导出、重复 ID 检测、公式注入防护、导入预览、容量预检、原子提交和无损往返测试。
10. 将 PoC 接入正式 `AuthService`、`CloudBaseSnapshotReader`、`CloudBaseSnapshotWriter` 和 `SyncCoordinator`，实现持久 dirty 修订号、`chrome.alarms`、单任务串行、失败重试、手动同步、账号/设备冲突、显式设备接管和最后同步状态。
11. 复用共享组件实现手机只读 Web Dashboard，完成真实 Session 守卫、快照结构校验、无快照、网络错误、版本不兼容和四档手机宽度测试。
12. 生成生产扩展包并通过 CloudBase 应用部署能力首次发布 Web；完成桌面扩展、手机、离线恢复、浏览器重启、容量、权限、跨账号和安全来源端到端验收，最后执行 CloudBase 项目代码审查。

## 17. 最终产品结论

核心闭环为：

> 电脑打开招聘页面 → 解析公司名称、公司招聘链接和解析时间 → 保存公司招聘信息 → 用户在“岗位投递”中按公司新增多个岗位投递 → 展开公司查看各岗位进度时间线 → 使用“编辑进度”维护环节、顺序和时间 → 本地保存后上传 CloudBase 只读快照 → 手机登录响应式 Web Dashboard 查看最近一次同步数据。

最终原则：

- 公司是列表聚合主键。
- 投递是公司下的独立子记录。
- 解析器只维护公司招聘信息。
- 进度时间线属于具体投递。
- 自定义环节名称用于展示，稳定阶段和终态用于统计与筛选。
- 当前进度不作为独立字段展示，由招聘进度 Steps 的节点、文字和 `aria-current="step"` 共同表达。
- Dashboard 使用 React + Vite 实现。
- 电脑扩展是 MVP 唯一编辑端，`chrome.storage.local` 是主数据源。
- MVP 只支持一个个人账号和一个编辑设备，本地数据通过 `boundUserId` 与 `deviceId` 防止误同步。
- CloudBase 文档型数据库保存该账号的一份最新 JSON 快照，包含来源设备和修订号。
- 手机 Web Dashboard 通过 CloudBase 身份认证读取快照，不参与反向同步。
- 手机网页部署到 CloudBase 静态网站托管。
- 原型页面作为 React 实现的 UI 和交互验收基准。
