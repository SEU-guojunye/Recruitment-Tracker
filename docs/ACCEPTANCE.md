# Recruitment Tracker PRD v1.6 本地验收记录

验收日期：2026-08-09。验收基准：`PRD.md` v1.6 与 `dashboard-tdesign.html`；使用范围：个人单账号、单编辑设备。代码验收完成后已重新部署只读 Web 与扩展桥接页，浏览器扩展发布包未重新制作。

## 产品闭环

- [x] Popup 从当前招聘页提取公司级信息，用户确认后只保存公司，不自动创建投递。
- [x] 公司支持行业类型、招聘批次和 P0/P1/P2 优先度；Popup 新建公司时使用空行业、秋招正式批和 P1 默认值。
- [x] 电脑 Dashboard 完成公司、同公司多投递、进度流程和级联删除的本地闭环。
- [x] 每条投递可在电脑端独立维护岗位名称；共享展示、搜索和只读 Web 均能读取该字段。
- [x] CSV 覆盖全部公司和投递；新增分类列参与往返，弃用的 `companyNotes` 兼容列始终导出为空且导入时不覆盖历史值。
- [x] 本地变更保留 dirty 修订，Service Worker 使用 `chrome.alarms` 延迟合并上传。
- [x] 手机 Web 必须有非匿名真实 Session，且只读取当前用户最近一次快照。

## 数据、安全与冲突

- [x] 公司名规范化、稳定 ID、关联完整性、日期、URL、布尔值、字段长度和派生进度字段均校验。
- [x] 本地写入、级联删除与 CSV 导入均为原子操作；超过 8 MiB 时在写前拒绝。
- [x] CSV 使用 UTF-8 BOM、严格固定表头、逐行错误定位和可逆公式注入防护。
- [x] `user_snapshots` 只允许非匿名所有者读取，客户端创建、更新和删除均禁用。
- [x] Event Function 从平台身份取得 owner，拒绝未登录、跨 owner、另一设备和修订回退。
- [x] 账号错配和设备冲突不会静默覆盖；清空重绑或接管前必须导出并再次确认。
- [x] 扩展不包含 CloudBase Web SDK、高权限密钥、远程脚本或通配 API Host 权限。
- [x] 生产桥接校验固定扩展 Origin、父窗口、消息来源、channel、requestId 和超时。
- [x] 公司图标由招聘链接的 hostname 在渲染时派生，按 FaviconKit、Tomba、Brandfetch（可选）顺序发送 hostname；不存储图标 URL、二进制或独立域名字段，失败时保留首字回退。

## 只读与响应式

- [x] 无 Session 时不读取快照；匿名 Session 被拒绝。
- [x] 无快照、网络失败、Session 过期和不支持的 schemaVersion 分别展示不同状态。
- [x] 手机组件树不存在公司/投递/进度/CSV/同步上传写事件。
- [x] 320、360、390、430 px 下无横向溢出；桌面和手机均保持六列横向 Steps，手机端允许环节名称换行。
- [x] 手机公司列表与招聘信息列表转为卡片布局，投递信息采用双列元数据，并保留当前环节的 `aria-current="step"`。
- [x] 招聘信息最近更新仅展示日期，操作收敛为“投递 / 编辑 / 删除”；分类字段可点击并聚焦到对应编辑项。
- [x] 招聘信息支持搜索、优先度、行业三者 AND 组合筛选；只读 Web 仅暴露浏览与筛选控件。
- [x] 顶部统计卡片使用统一风格的 SVG 线性图标，替换简陋字符图标。
- [x] 公司图标请求 128 px 源图并保持 34 px 展示尺寸；图标加载后隐藏首字回退，避免透明区域透出文字。
- [x] 投递详情不再提供额外进度下拉菜单；编辑与删除操作位于投递岗位信息同一行的“操作”列。
- [x] 公司、投递与招聘列表按字段职责重新分配列宽；所有列表表头及移动端字段标签使用 600 粗体。
- [x] 原型使用的 Noto Sans SC Variable 已作为本地生产依赖打包，不再依赖 Google Fonts 在线加载。

## 恢复与工程

- [x] 扩展页面重载和浏览器进程重启后，本地数据与稳定扩展 ID 保持不变。
- [x] 离线同步失败保留本地数据；协调器重建后依据 dirty 修订恢复并可重试成功。
- [x] 上传期间继续编辑不会由旧修订错误清除 dirty 状态。
- [x] lint、单元/组件测试、生产构建和 Chromium E2E 均执行真实脚本。
- [x] 历史 v0.1.2 发布时已回读 CloudBase 环境、认证方式、NoSQL 规则、函数权限和函数可用状态；本次未改变云端配置。
- [x] CloudBase 代码审查确认 Web 使用 `getSession()` 守卫、拒绝匿名 Session、检查 Auth error，未使用废弃登录 API。

## 历史 v0.1.2 发布产物（本次未重新发布）

- 扩展 ID：`jpmabplkjdmlfjpllogjaieehdohkndg`
- 扩展包：`release/recruitment-tracker-extension-0.1.2.zip`
- 扩展包 SHA-256：`a2647a322f93acbf822665ff5d8fd881f1d759e8ecb5690e366dfd41674a288c`
- Web 静态包：`release/recruitment-tracker-web-0.1.2.zip`
- Web 静态包 SHA-256：`29a886f9d46bc1f72acc9dc28a2ce48d81fdcda0b4c5370c750a167d91ff0ae4`
- CloudBase 环境：`recuriment-tracker-d4cx9a1dc6d69`（`ap-shanghai`）
- Event Function：`recruitmentSnapshot`（Node.js 18.15，Event，Active/Available）
- Web Service：`recruitment-tracker`
- Web URL：`https://recruitment-tracker-recuriment-tracker-d4cx9a1dc6d69.webapps.tcloudbase.com`
- Web Version：`recruitment-tracker-003`
- Web Build ID：`2601563472`（`SUCCESS`）

## 当前 v1.6 CloudBase Web 部署

- CloudBase 环境：`recuriment-tracker-d4cx9a1dc6d69`（`ap-shanghai`）
- Web Service：`recruitment-tracker`
- Web URL：`https://recruitment-tracker-recuriment-tracker-d4cx9a1dc6d69.webapps.tcloudbase.com/`
- Web Version：`recruitment-tracker-007`
- Web Build ID：`2601573518`（`SUCCESS`）
- 首页与 `/extension-bridge.html` 均返回 HTTP 200，并引用本次构建的新资源哈希。
- 新 CSS、JS 与 Noto Sans SC WOFF2 字体文件均返回 HTTP 200；生产资源包含粗体表头和 128 px 图标请求。
- 线上 CSS 已确认包含移动端岗位详情两列布局与岗位名称整行规则。
- 静态托管首页与错误页均配置为 `index.html`。
- 已登录线上会话成功读取迁移后的快照；招聘信息页正常显示默认行业、招聘批次和优先度，控制台无错误。
- `user_snapshots` 的 v1.6 字段迁移和备份信息见 [MIGRATIONS.md](MIGRATIONS.md)。

## 历史 v0.1.2 线上发布验证

- [x] CloudBase 应用详情回读为 `LatestVersionName=recruitment-tracker-003`、`LatestStatus=SUCCESS`。
- [x] 生产首页返回 HTTP 200，并包含 Web 应用挂载节点。
- [x] `/extension-bridge.html` 返回 HTTP 200，并加载生产桥接模块和只读快照模块。
- [x] 真实 Chromium 打开生产首页后正常显示非匿名账号登录页、用户名和密码输入框及登录按钮。
- [x] 发布域名与扩展 `host_permissions`、CSP `frame-src`、offscreen 桥接地址和桥接页 Origin 白名单完全一致。

## 自动化结果

- ESLint：通过。
- Vitest：14 个测试文件、90 个测试通过。
- 生产构建：Web 与 Extension 均通过；仅有 CloudBase SDK 共享 chunk 大小提示，无功能或安全错误。
- Playwright：9 个 Chromium E2E 通过；1 个需要临时 QA 凭据的真实 CloudBase 账号测试按设计跳过。
- 浏览器手工复核：390 × 844 登录页无横向溢出，TDesign 移动布局正确铺满，控制台无应用错误或警告。
- npm 生产依赖审计：0 个已知漏洞。
