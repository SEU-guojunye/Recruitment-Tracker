# Recruitment Tracker v0.1.0 验收记录

验收基准：`PRD.md` v1.5；使用范围：个人单账号、单编辑设备，保留账号适配器、版本化模型和 Reader/Writer 边界以便扩展。

## 产品闭环

- [x] Popup 从当前招聘页提取公司级信息，用户确认后只保存公司，不自动创建投递。
- [x] 电脑 Dashboard 完成公司、同公司多投递、进度流程和级联删除的本地闭环。
- [x] CSV 覆盖全部公司和投递，可无损往返，自定义流程、备注和多行文本不丢失。
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

## 只读与响应式

- [x] 无 Session 时不读取快照；匿名 Session 被拒绝。
- [x] 无快照、网络失败、Session 过期和不支持的 schemaVersion 分别展示不同状态。
- [x] 手机组件树不存在公司/投递/进度/CSV/同步上传写事件。
- [x] 320、360、390、430 px 下无横向溢出；时间线由桌面横向切换为手机纵向。

## 恢复与工程

- [x] 扩展页面重载和浏览器进程重启后，本地数据与稳定扩展 ID 保持不变。
- [x] 离线同步失败保留本地数据；协调器重建后依据 dirty 修订恢复并可重试成功。
- [x] 上传期间继续编辑不会由旧修订错误清除 dirty 状态。
- [x] lint、单元/组件测试、生产构建和 Chromium E2E 均执行真实脚本。
- [x] CloudBase 环境、认证方式、NoSQL 规则、函数权限和函数可用状态已通过管理面回读。

## 发布产物

- 扩展 ID：`jpmabplkjdmlfjpllogjaieehdohkndg`
- 扩展包：`release/recruitment-tracker-extension-0.1.0.zip`
- 扩展包 SHA-256：`e14b3e68890d745b6ea53c24d7ed2e6d1cc9bef21e19ae5058c34a49fb272d88`
- Web 静态包：`release/recruitment-tracker-web-0.1.0.zip`
- Web 静态包 SHA-256：`27db0416e7b985e4fe7d966f3a566763a285e092c85ffab96f80088d8000505e`
- CloudBase 环境：`recuriment-tracker-d4cx9a1dc6d69`（`ap-shanghai`）
- Event Function：`recruitmentSnapshot`（Node.js 18.15，Event，Active/Available）
- Web Service：`recruitment-tracker`
- Web URL：`https://recruitment-tracker-recuriment-tracker-d4cx9a1dc6d69.webapps.tcloudbase.com`
- Web Version：`recruitment-tracker-002`
- Web Build ID：`2601563207`（`SUCCESS`）

## 线上发布验证

- [x] CloudBase 应用详情回读为 `LatestVersionName=recruitment-tracker-002`、`LatestStatus=SUCCESS`。
- [x] 生产首页返回 HTTP 200，并包含 Web 应用挂载节点。
- [x] `/extension-bridge.html` 返回 HTTP 200，并加载生产桥接模块和只读快照模块。
- [x] 真实 Chromium 打开生产首页后正常显示非匿名账号登录页、用户名和密码输入框及登录按钮。
- [x] 发布域名与扩展 `host_permissions`、CSP `frame-src`、offscreen 桥接地址和桥接页 Origin 白名单完全一致。

## 自动化结果

- ESLint：通过。
- Vitest：14 个测试文件、84 个测试通过。
- 生产构建：Web 与 Extension 均通过；仅有 CloudBase SDK 共享 chunk 大小提示，无功能或安全错误。
- Playwright：9 个 Chromium E2E 通过；1 个需要临时 QA 凭据的真实 CloudBase 账号测试按设计跳过。
- npm 生产依赖审计：0 个已知漏洞。
