# Recruitment Tracker 产品需求文档（PRD）

> 版本：v1.3
>
> 状态：开发前方案讨论稿 / Dashboard 原型已完成 / React 与 CloudBase 技术方案已确定
>
> 开发语言：JavaScript ES2022+ / JSX
>
> 前端框架：React + Vite
>
> 产品形态：Chrome / Chromium 浏览器扩展（Manifest V3）+ 响应式只读 Web Dashboard
>
> 数据策略：电脑端 `chrome.storage.local` 为主数据源；腾讯云 CloudBase 保存用户只读快照供手机查看；当前项目尚未开工，不考虑旧数据迁移

## 1. 产品概述

Recruitment Tracker 是一个以公司为核心、以投递明细为子记录的个人求职管理工具。

用户浏览招聘页面时，解析器只负责识别和保存公司招聘信息；用户完成实际投递后，在“我的投递”中手动维护该公司下各个岗位的投递信息和招聘进度。

电脑端浏览器扩展是唯一的数据编辑端，数据首先保存在浏览器本地；用户登录后，扩展将完整数据上传至腾讯云 CloudBase 文档型数据库。手机 Chrome 通过响应式 Web Dashboard 登录同一 CloudBase 账号后查看最新快照，MVP 不支持手机端新增、编辑或删除。

本版本已经完成一个可交互的 Dashboard HTML 原型。后续使用 React + Vite 实现正式页面，并以原型中的页面层级、公司聚合方式、进度时间线和编辑交互为主要参考。

## 2. 原型参考与 React 实现原则

### 2.1 原型文件

- [Dashboard HTML 原型](./dashboard.html)
- 原型绝对路径：`C:\Users\guojunye\code\Recruitment-Tracker\dashboard.html`

原型当前使用页面内示例数据，不代表最终 React 组件或存储实现。React 重构后必须保留原型中已经确认的视觉效果、布局关系和核心交互。

### 2.2 原型已覆盖范围

- 顶部“招聘信息 / 我的投递”标签切换。
- 全宽 Dashboard 布局，不使用左侧导航栏。
- 两个标签页使用对齐的顶部统计卡片。
- “我的投递”按公司聚合，一家公司只展示一行。
- 公司行展开后展示多个岗位投递子记录。
- 每个投递子记录展示独立的进度时间线。
- 当前进度使用绿色突出显示。
- 进度环节文字位于节点上方，时间位于节点下方。
- 右上角提供“编辑进度”入口。
- 支持新增、删除、重命名、排序和设置时间的流程编辑。
- 桌面端时间线自适应列宽，窄屏端切换为纵向排列，不要求用户左右滚动。

### 2.3 React 实现原则

- `dashboard.html` 继续作为视觉、布局和交互验收基准，不直接作为生产页面源码。
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
```

### 3.1 `CompanyRecord`

一家公司对应一条公司记录，保存：

- 公司名称。
- 公司招聘链接。
- 公司备注。
- 创建时间和更新时间。

公司记录本身不保存某个岗位的招聘进度。

### 3.2 `Application`

一条 `Application` 表示同一家公司下某个岗位或某次投递的明细。

同一家公司可以存在多条 `Application`，每条记录独立维护：

- 投递链接。
- 工作地点。
- 投递时间。
- 招聘进度和进度更新时间。
- 查看投递状态页面。
- 是否内推和内推码。
- 投递备注。
- 自定义进度环节、顺序和环节时间。

当前不要求解析器识别申请职位。岗位投递可以通过投递链接、工作地点、投递时间和备注进行区分。

### 3.3 `CloudSnapshot`

每个 CloudBase 账号只保存一份最新云端快照，完整包含该用户电脑端的 `CompanyRecord` 和 `Application` 数据。

MVP 使用 CloudBase 文档型数据库的 `user_snapshots` 集合保存快照，不使用 CloudBase PG 模式。每个用户对应一个 JSON 文档，数据权限由 CloudBase 身份认证和数据库安全规则控制。

快照只用于：

- 手机 Web Dashboard 只读查看。
- 展示最近同步时间。
- 为后续云端数据结构升级保留版本号。

MVP 不把云端快照作为电脑端主数据源，也不从手机向电脑反向写入。未来若增加手机编辑、关系查询或双向同步，再评估升级到 CloudBase PG 模式。

## 4. 解析器职责

### 4.1 解析器只负责公司招聘信息

解析器只返回公司级结果：

```js
{
  company: {
    companyName: "示例公司",
    recruitmentLink: "https://example.com/careers"
  }
}
```

解析器允许：

- 读取当前页面 URL、标题、Meta、JSON-LD 和可见文本。
- 识别公司名称。
- 将当前页面链接作为公司招聘链接候选值。
- 创建或更新 `CompanyRecord`。
- 提示用户确认或修改识别结果。

解析器禁止：

- 创建、编辑或删除 `Application`。
- 解析或写入申请职位。
- 解析或写入投递链接、工作地点、投递日期和招聘进度。
- 解析或写入状态页链接、内推信息和投递备注。
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
10. 系统提示用户可到“我的投递”手动新增投递。

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
| 招聘信息 | `CompanyRecord.id` | 所有已保存公司 | 管理或查看公司招聘信息 |
| 我的投递 | `CompanyRecord.id` | 至少有一条“已投递”子记录的公司 | 按公司管理或查看多个岗位投递 |

要求：

- 不使用左侧导航栏。
- 标签栏位于主内容顶部。
- 两个标签页使用同一套视觉样式和布局宽度。
- 当前标签页通过蓝色背景和数量徽标突出显示。
- 电脑扩展端刷新后保留当前标签页。
- 手机端切换标签页不得触发页面整体刷新。

### 5.3 顶部统计卡片

两个标签页顶部均展示四张对齐的统计卡片。

#### “我的投递”卡片

1. 进行中的公司。
2. 已投递岗位。
3. 面试中。
4. 最近更新。

#### “招聘信息”卡片

1. 招聘公司。
2. 关联投递。
3. 进行中的公司。
4. 最近更新。

卡片要求：

- 数字、单位、说明文字和图标保持统一对齐。
- 使用蓝色作为产品主题色。
- 不因为切换标签页而改变卡片高度和间距。
- 电脑端数据来自本地记录聚合，手机端数据来自 CloudBase 快照聚合。
- 手机端采用两列布局，极窄屏允许切换为单列。

### 5.4 “招聘信息”标签页

一行代表一家公司，展示：

- 公司名称。
- 公司招聘链接，可点击打开。
- 关联投递数量。
- 最近进度。
- 最近更新时间。
- 查看投递操作。
- 电脑端额外提供编辑公司和保存招聘信息操作。

公司列表中的进度只作为聚合信息展示，不能直接修改公司整体进度。

### 5.5 “我的投递”标签页

一行代表一家公司，展开后展示该公司下的多个 `Application` 子记录。

公司行展示：

- 公司名称。
- 公司招聘链接。
- 投递数量。
- 最近进度。
- 进度汇总徽标。
- 展开 / 收起。
- 电脑端额外提供新增投递。

公司行展开后，每个投递子记录展示：

- 投递记录编号。
- 投递链接。
- 工作地点。
- 当前环节。
- 进度时间线。
- 电脑端额外提供快速进度下拉和“编辑进度”按钮。

修改某个投递子记录不得影响同公司其他投递。

### 5.6 手机只读布局

- 页面支持宽度至少从 320px 开始正常展示。
- 顶部统计卡片在手机端使用两列布局。
- 工具栏、公司摘要和投递摘要改为纵向或分行布局。
- “招聘信息”不得通过简单隐藏字段造成关键信息缺失，应改为卡片式分行展示。
- 招聘进度时间线在窄屏端切换为纵向排列。
- 手机端字号和触控区域需要单独优化，不直接沿用桌面端的小字号。
- 核心信息不得依赖水平滚动查看。
- MVP 直接提供响应式网页，不要求安装 PWA。

## 6. 招聘进度时间线

### 6.1 时间线展示

每条投递记录都有独立的自定义招聘进度流程。

```text
环节文字
    ●────────●────────●────────●
环节时间
```

展示规则：

- 环节文字显示在节点上方。
- 节点和连接线独立占一层。
- 环节时间显示在节点下方。
- 当前环节使用绿色节点、绿色文字、绿色时间和绿色外圈突出显示。
- 已完成环节使用蓝色节点和蓝色连接线。
- 未到达环节使用灰色节点和灰色连接线。
- 当前投递的摘要区域显示“当前环节：环节名称 · 时间”。
- 右下角不再重复显示编辑按钮。
- 每条投递只在电脑编辑模式右上角保留“编辑进度”按钮。

### 6.2 自适应布局

桌面端：

- 时间线使用等比例自适应列宽。
- 环节文字允许换行，不得覆盖连接线。
- 进度卡片使用可用内容宽度，不设置不必要的固定宽度。
- 不出现水平滚动条。

窄屏端：

- 时间线切换为纵向排列。
- 节点位于左侧，环节文字位于右侧上方，时间位于右侧下方。
- 连接线垂直连接相邻节点。
- 不要求用户左右滚动查看完整流程。

### 6.3 默认流程

1. 已投递。
2. 筛选。
3. 笔试。
4. 技术一面。
5. HR 面。
6. 结果。

默认流程只是初始模板，每条投递可以单独调整。

## 7. 进度编辑功能

本节功能只在电脑编辑模式开放。点击投递卡片右上角“编辑进度”后打开流程编辑弹窗。

用户可以：

- 新增环节。
- 删除环节。
- 修改环节名称。
- 调整环节顺序。
- 为每个环节填写或修改日期。
- 指定当前环节。
- 保存或取消修改。

编辑器要求：

- 当前环节使用绿色边框和绿色单选状态提示。
- 环节名称、日期、排序按钮和删除按钮分列布局。
- 窄屏下编辑项自动分行，避免控件互相覆盖。
- 环节名称不能为空。
- 至少保留一个环节。
- 点击保存后只更新当前 `Application`。
- 取消时不应保存临时修改。

快速进度下拉：

- 位于每个投递卡片右上区域。
- 用于快速切换当前环节。
- 如果目标环节没有时间，切换时默认写入当天日期。
- 详细的环节增删改序仍通过“编辑进度”完成。
- 手机只读模式不渲染快速进度下拉。

## 8. 招聘进度状态体系

状态阶段顺序为：

```text
准备 → 已投递 → 筛选 → 笔试 → 面试 → 结果 → 关闭
```

| 阶段 | 状态 |
|---|---|
| 准备 | 待投递 |
| 已投递 | 已投递 |
| 筛选 | 简历筛选、筛选通过、筛选未通过 |
| 笔试 | 测评 / 笔试 |
| 面试 | 一面 / 初面、技术一面、技术二面、技术三面、HR 面 |
| 结果 | Offer、候选人待定、已接受、已拒绝 |
| 关闭 | 已撤回、已关闭 |

自定义时间线的环节可以细化上述阶段，但统计卡片和筛选仍按阶段归类。

明确规则：

- 阶段“已投递”和状态“已投递”统一命名。
- “测评 / 笔试”只属于“笔试”阶段。
- 面试状态不包含“等待一面”“部门负责人面”“终面”。
- 公司聚合行的状态汇总不可直接编辑。
- 进度修改必须作用于具体 `Application.id`。

## 9. 功能需求

### F-001 公司招聘信息采集

Popup 只展示：

- 公司名称。
- 公司招聘链接。
- 公司备注。

Popup 不展示投递日期、工作地点、投递链接、招聘进度、状态页链接、内推信息和投递备注。

### F-002 公司管理

- 新增、编辑、删除公司。
- 查看公司招聘链接。
- 查看公司关联的全部投递。
- 从公司详情新增投递。
- 公司有投递时删除必须二次确认。
- 公司招聘链接更新不得修改任何投递记录。
- 所有写操作只在电脑编辑模式开放。

### F-003 手动新增投递

投递记录由用户在电脑端手动创建，字段包括：

| 字段 | 必填 | 说明 |
|---|---:|---|
| 投递公司 | 是 | 选择已有公司 |
| 招聘投递链接 | 否 | 用户填写 |
| 工作地点 | 否 | 用户填写 |
| 查看投递状态页面 | 否 | 用户填写 |
| 投递时间 | 是 | 默认当天 |
| 招聘进度 | 是 | 默认“已投递” |
| 是否内推 | 是 | 默认否 |
| 内推码 | 否 | 使用内推时填写 |
| 投递备注 | 否 | 自由文本 |

### F-004 投递列表与进度管理

- 默认筛选至少有一条“已投递”子记录的公司。
- 提供“全部投递”筛选。
- 公司展开后展示符合筛选条件的投递子记录。
- 电脑端每个子记录提供快速进度下拉。
- 电脑端每个子记录提供右上角“编辑进度”按钮。
- 修改一个子记录的进度不会影响同公司的其他记录。
- 进度更新时间随快速切换或保存编辑自动刷新。
- 手机端复用列表、筛选、聚合和时间线展示，但不提供写操作。

### F-005 导入导出

CSV 至少包含：

- 公司名称。
- 公司招聘链接。
- 投递链接。
- 工作地点。
- 查看投递状态页面。
- 投递时间。
- 招聘进度。
- 进度更新时间。
- 是否内推。
- 内推码。
- 投递备注。

同一公司多行导入后必须保留为多条投递，并在 Dashboard 中按公司聚合展示。CSV 导入导出只在电脑编辑模式开放。

### F-006 用户登录

- MVP 只提供一种登录方式，优先使用 CloudBase 邮箱验证码登录。
- 电脑扩展和手机网页使用同一个 CloudBase 账号体系。
- 登录状态过期时提示用户重新登录。
- 退出登录不删除电脑本地数据。
- 手机端未登录时不得读取任何用户快照。
- 登录、令牌续期和账号状态由 CloudBase 身份认证管理。
- MVP 不自建用户名密码、邮件验证和密码找回系统。

### F-007 CloudBase 只读快照同步

- 电脑端 `chrome.storage.local` 是唯一可编辑主数据源。
- 云端使用 CloudBase 文档型数据库的 `user_snapshots` 集合。
- 用户登录后，可以点击“立即同步”。
- 本地数据变更成功后，系统自动延迟合并并上传一次完整快照，避免连续频繁请求。
- 自动同步失败时保留本地数据，并显示失败状态和“重试”入口。
- 每次上传使用当前完整数据覆盖该用户上一份快照。
- 快照保存 `schemaVersion` 和 CloudBase 服务端更新时间。
- 每个快照文档必须记录数据所有者，并由安全规则限制为所有者本人可读写。
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
  companyNotes: "关注校招和社招页面",
  createdAt: "2026-08-08T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z"
}
```

### 10.2 `Application`

```js
{
  id: "application-uuid",
  companyId: "company-uuid",
  applicationLink: "https://example.com/apply/record",
  workLocation: "北京 / 远程",
  statusLink: "https://example.com/my-applications",
  appliedDate: "2026-08-08",
  progressStatus: "已投递",
  progressUpdatedDate: "2026-08-08",
  isReferral: true,
  referralCode: "REF-2026",
  progressStages: [
    { id: "stage-1", name: "已投递", date: "2026-08-08" },
    { id: "stage-2", name: "筛选", date: "" },
    { id: "stage-3", name: "笔试", date: "" },
    { id: "stage-4", name: "面试", date: "" },
    { id: "stage-5", name: "结果", date: "" }
  ],
  currentStageId: "stage-1",
  applicationNotes: "",
  createdAt: "2026-08-08T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z"
}
```

进度字段规则：

- `progressStages` 按用户定义的顺序保存。
- `currentStageId` 指向当前环节。
- 每个环节可以有独立日期，允许为空。
- 保存流程编辑时同步更新 `progressStatus` 和 `progressUpdatedDate`。
- `progressStages` 属于 `Application`，不属于公司记录。

### 10.3 `CloudSnapshot`

```js
{
  _id: "cloudbase-user-id",
  _openid: "cloudbase-user-id",
  schemaVersion: 1,
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
├── _openid          String，CloudBase 自动记录的数据所有者
├── schemaVersion    Number
├── data             Object，包含 companies 和 applications
└── updatedAt        Date，使用 CloudBase 服务端时间
```

数据规则：

- 每个 CloudBase 用户 ID 只能存在一份最新快照。
- 集合禁止匿名访问，登录用户只能读取和覆盖 `_openid` 属于自己的文档。
- 数据隔离使用 CloudBase 数据库安全规则，不只依赖 React 界面的“只读模式”。
- 前端只包含 CloudBase 环境 ID、客户端可公开配置和 Publishable Key。
- 前端不得包含 SecretId、SecretKey、管理员凭证或服务端 API Key。
- 手机只读是产品交互限制；账号数据隔离由 CloudBase 身份认证和数据库安全规则保证。

## 11. React、扩展与 CloudBase 技术方案

### 11.1 MVP 技术栈

| 模块 | 方案 |
|---|---|
| 开发语言 | JavaScript ES2022+ / JSX |
| 前端 UI | React 函数组件 + Hooks |
| 构建工具 | Vite + npm |
| 扩展规范 | Manifest V3 |
| 扩展本地存储 | `chrome.storage.local` |
| 页面读取 | `activeTab` + `scripting` |
| 解析 | `ParserOrchestrator` + `SiteAdapter` + 通用回退解析器 |
| 云端 SDK | `@cloudbase/js-sdk`，由 Vite 打包到扩展和 Web 产物 |
| 身份认证 | 腾讯云 CloudBase 身份认证，MVP 使用邮箱验证码 |
| 云端数据库 | CloudBase 文档型数据库 `user_snapshots` 集合 |
| 数据权限 | CloudBase 数据库安全规则，仅所有者本人可读写 |
| Web 部署 | CloudBase 静态网站托管 |
| 单元与组件测试 | Vitest + React Testing Library |
| 端到端与响应式测试 | Playwright |

### 11.2 React 组件边界

```text
App
├── AuthGate
├── TopBar
├── TopTabs
├── StatisticsCards
├── RecruitmentView
│   └── CompanyTable / MobileCompanyCard
├── ApplicationsView
│   └── CompanyCard
│       └── ApplicationCard
│           └── ProgressTimeline
├── ProgressEditorModal
├── ApplicationFormModal
├── CompanyFormModal
└── SyncStatus
```

要求：

- `ProgressTimeline`、统计计算、筛选逻辑和公司聚合逻辑在电脑端与手机端复用。
- 写操作组件通过 `mode` 或权限属性控制，不在只读模式挂载。
- 不通过 CSS 隐藏来代替权限判断；只读模式不得创建写操作事件。
- 列表项使用稳定业务 ID 作为 React `key`，不得使用数组索引作为持久记录主键。
- 弹窗临时状态与已保存数据分离，取消操作不得修改 Repository。

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
├── getCompanies()
├── saveCompany()
├── getApplications()
├── saveApplication()
└── exportSnapshot()

CloudBaseSnapshotRepository
├── getSnapshot()
└── replaceSnapshot()
```

模块职责：

- `ParserOrchestrator` 只返回公司级解析结果。
- `CompanyService` 创建和更新 `CompanyRecord`。
- `ApplicationService` 响应用户的投递新增、编辑、删除和进度更新。
- `SnapshotService` 从本地 Repository 生成完整快照并上传 CloudBase。
- React 组件不直接调用 `chrome.storage` 或 CloudBase SDK。
- 手机 Web 只注入具有读取能力的 `CloudBaseSnapshotRepository`。

### 11.5 扩展打包和安全来源约束

- React、React DOM 和 `@cloudbase/js-sdk` 必须由 Vite 打包进入扩展产物。
- Manifest V3 扩展不得从 CDN 加载或执行远程 JavaScript。
- CloudBase API 地址加入最小化的 `host_permissions`。
- 生产包不包含 SecretId、SecretKey、管理员凭证、服务端 API Key 或未使用的权限。
- 开发开始前必须完成 Chrome 扩展安全来源 PoC，验证扩展登录、令牌持久化、上传快照和读取同步状态。
- 如果 CloudBase 安全来源不接受 `chrome-extension://`，则通过 CloudBase HTTP 网关/云函数承接同步请求，并使用托管 Web 登录页完成授权回调。
- 手机 Web 域名必须加入 CloudBase 安全来源白名单。
- 生产自定义域名按要求完成 HTTPS 和 ICP 备案。

### 11.6 建议目录结构

```text
Recruitment-Tracker/
├── dashboard.html                 # 已确认的原型参考
├── src/
│   ├── components/                # 可复用 React 展示组件
│   ├── features/                  # 公司、投递、进度、认证、同步
│   ├── hooks/                     # React 自定义 Hooks
│   ├── repositories/              # 本地与 CloudBase Repository
│   ├── services/                  # 解析、业务和快照服务
│   ├── shared/                    # 模型、统计、格式化和常量
│   ├── extension/                 # Popup、Content Script、Service Worker
│   └── web/                       # 手机只读 Web 入口
├── tests/
├── manifest.json
├── vite.config.js
└── package.json
```

## 12. 数据同步流程

### 12.1 电脑端保存

```text
用户编辑
  → React 表单校验
  → Service 执行业务规则
  → ChromeLocalRepository 保存成功
  → Dashboard 立即更新
  → SnapshotService 延迟合并并上传 CloudBase 完整快照
```

### 12.2 手机端查看

```text
用户打开 CloudBase 静态托管的 Web Dashboard
  → CloudBase 身份认证
  → CloudBaseSnapshotRepository 读取快照
  → React 以 readonly 模式渲染
  → 展示 CloudBase 服务端更新时间
```

### 12.3 同步规则

- 本地保存与 CloudBase 同步分离，本地成功不依赖云端成功。
- 同一时间只执行一个快照上传任务。
- 连续本地修改应合并为一次延迟上传。
- 上传失败可重试，但不得重复创建多份用户快照。
- 手机端不产生业务写操作，因此 MVP 不存在双向冲突。
- 手机端看到的数据可能晚于电脑本地，必须显示最后同步时间。

## 13. MVP 验收标准

### 13.1 React 实现和页面布局

- 正式 Dashboard 使用 React + Vite 实现。
- `PRD.md` 能链接到 `dashboard.html` 原型。
- React 页面与原型的主题色、布局层级和主要交互一致。
- 页面不使用左侧导航栏。
- 顶部存在“招聘信息 / 我的投递”标签切换。
- 两个标签页顶部均有四张对齐的统计卡片。
- 页面在桌面端使用全宽内容布局。
- 窄屏端不出现必须左右滚动才能理解的核心信息。

### 13.2 公司与投递聚合

- 同一家公司在“我的投递”中只显示一行。
- 展开公司后能看到多条投递子记录。
- 每条投递可以在电脑端独立编辑进度。
- 修改一条投递不会影响同公司的其他投递。

### 13.3 进度时间线

- 环节文字位于节点上方。
- 日期位于节点下方。
- 当前环节使用绿色突出显示。
- 已完成环节和未到达环节有明显视觉差异。
- 桌面端时间线能够自适应完整展示，不出现水平滚动。
- 窄屏端时间线自动变为纵向排列。
- 电脑端右上角保留“编辑进度”按钮。
- 右下角不显示重复的“编辑环节、顺序和时间”按钮。

### 13.4 进度编辑器

- 可以新增、删除、重命名环节。
- 可以调整环节顺序。
- 可以填写每个环节的时间。
- 可以设置当前环节。
- 保存只影响当前投递。
- 取消不会保存临时修改。

### 13.5 CloudBase 登录和快照同步

- 电脑扩展和手机网页可以登录同一 CloudBase 账号。
- 电脑本地数据保存后可以生成并上传完整快照。
- 手动“立即同步”能够覆盖 CloudBase 旧快照。
- 同步失败不影响本地数据，且用户可以重试。
- CloudBase 安全规则验证确认用户不能读取或修改其他账号快照。
- 页面和扩展中均不包含 SecretId、SecretKey、管理员凭证或服务端 API Key。
- Chrome 扩展安全来源 PoC 通过；若采用 HTTP 网关方案，鉴权和跨域测试通过。

### 13.6 手机只读 Dashboard

- 手机 Chrome 可以通过 HTTPS 地址打开页面。
- 登录后可以看到与最近一次电脑同步一致的数据。
- 支持两个标签页、统计卡片、搜索、筛选、公司展开和进度查看。
- 页面显示“只读模式”和最后同步时间。
- 页面不显示任何业务写操作入口。
- 在 320px、360px、390px 和 430px 宽度下完成响应式验收。
- 招聘信息、投递信息和时间线均不依赖水平滚动。

## 14. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 公司简称或别名 | 同一公司被拆分 | 规范化匹配、候选提示、用户确认 |
| 同公司多个岗位没有职位名称 | 子项区分困难 | 使用投递链接、地点、日期和备注区分 |
| 自定义环节名称过长 | 时间线排版拥挤 | 环节文字允许换行；窄屏切换纵向布局 |
| 页面窗口较窄 | 组件重叠或被截断 | React 组件采用响应式布局并执行多宽度视觉测试 |
| 用户误以为打开申请页等于已投递 | 产生虚假记录 | 解析器不创建投递，必须由用户主动新增 |
| 公司进度与岗位进度混淆 | 错误更新多个岗位 | 公司只做聚合，更新必须携带 `applicationId` |
| CloudBase 同步失败 | 手机数据不是最新版本 | 本地优先、同步状态提示、手动重试、显示最后同步时间 |
| 快照覆盖错误账号 | 用户数据泄露或错写 | 登录确认、以 CloudBase 用户 ID 作为文档 ID、配置所有者安全规则 |
| 前端泄露高权限密钥 | 云端数据被越权访问 | 只打包客户端可公开配置，禁止打包 SecretId、SecretKey 和服务端 API Key |
| 扩展来源无法直连 CloudBase | 电脑端无法登录或同步 | 开发前完成 PoC；必要时改用 HTTP 网关/云函数和托管登录回调 |
| 自定义域名未备案 | 手机 Web 无法按生产域名上线 | 提前准备域名、HTTPS 证书和 ICP 备案；开发阶段使用 CloudBase 测试域名 |
| React 状态与 Repository 不一致 | 页面显示未真正保存的数据 | 写操作必须等待本地 Repository 成功后提交正式状态 |

## 15. MVP 非目标

以下能力不属于当前 MVP：

- 手机端新增、编辑和删除。
- 手机端修改招聘进度。
- 双向同步和冲突合并。
- 实时 WebSocket 同步。
- 多份历史云端快照和版本恢复。
- PWA 安装和离线编辑。
- 原生 Android / iOS App。
- 自建 Node.js / Express 后端。
- CloudBase PG 模式和关系型业务表。
- 服务端渲染和 SEO。
- Redux、React Router 和大型 UI 组件库。

## 16. 实施顺序

1. 建立 JavaScript + React + Vite 工程和测试基础设施。
2. 建立 CloudBase 测试环境，完成 Chrome 扩展登录、令牌持久化和快照上传 PoC。
3. 从原型提取设计变量、响应式 CSS 和共享 React 展示组件。
4. 实现 `CompanyRecord`、`Application`、本地 Repository 和公司名称规范化。
5. 使用 React 实现顶部标签、统计卡片、公司聚合列表和投递子记录。
6. 实现自适应时间线、快速进度切换和“编辑进度”编辑器。
7. 实现只返回公司字段的通用解析器及站点适配器。
8. 实现 CSV 导入导出和完整本地业务测试。
9. 接入 CloudBase 邮箱验证码登录、`user_snapshots` 集合和数据库安全规则。
10. 实现自动延迟同步、“立即同步”、失败重试和最后同步状态。
11. 复用 React 组件实现手机只读 Web Dashboard。
12. 部署到 CloudBase 静态网站托管，并完成桌面扩展、手机、权限和安全来源端到端测试。

## 17. 最终产品结论

核心闭环为：

> 电脑打开招聘页面 → 解析公司名称和公司招聘链接 → 保存公司招聘信息 → 用户在“我的投递”中按公司新增多个岗位投递 → 展开公司查看各岗位进度时间线 → 使用“编辑进度”维护环节、顺序和时间 → 本地保存后上传 CloudBase 只读快照 → 手机登录响应式 Web Dashboard 查看最近一次同步数据。

最终原则：

- 公司是列表聚合主键。
- 投递是公司下的独立子记录。
- 解析器只维护公司招聘信息。
- 进度时间线属于具体投递。
- 当前进度使用绿色突出显示。
- Dashboard 使用 React + Vite 实现。
- 电脑扩展是 MVP 唯一编辑端，`chrome.storage.local` 是主数据源。
- CloudBase 文档型数据库保存每个用户的一份最新 JSON 快照。
- 手机 Web Dashboard 通过 CloudBase 身份认证读取快照，不参与反向同步。
- 手机网页部署到 CloudBase 静态网站托管。
- 原型页面作为 React 实现的 UI 和交互验收基准。

