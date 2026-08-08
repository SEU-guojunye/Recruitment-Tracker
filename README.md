# Recruitment Tracker

面向个人使用的求职跟踪器：电脑 Chrome 扩展负责采集、编辑和本地持久化，CloudBase 保存只读快照，手机 Web 登录后查看最近一次同步数据。

## 运行架构

- `apps/extension`：Popup、可编辑 Dashboard、Service Worker 与 offscreen 托管桥接。
- `apps/web`：用户名密码登录、手机只读 Dashboard，以及仅供扩展嵌入的桥接页。
- `packages/core`：领域模型、本地仓库、CSV、统计与同步协调器。
- `packages/ui`：电脑和手机复用的只读展示组件。
- `cloudfunctions/recruitmentSnapshot`：唯一 Event Function；从受信调用上下文取得用户 ID，写入该用户的完整快照。

电脑端 `chrome.storage.local` 是唯一可编辑主数据源。Web 端只注入 `CloudBaseSnapshotReader`，不会把云端数据覆盖回电脑。

## 本地开发

```bash
npm install
npm run dev:web
npm run dev:extension
```

将 `.env.example` 中的公开 CloudBase Web 配置复制到 `apps/web/.env.local`。用户名、密码、Session、SecretId、SecretKey 和服务端 API Key 不得写入环境示例或业务 Repository。

常用校验：

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## 个人安装

1. 解压 `release/recruitment-tracker-extension-0.1.0.zip`。
2. 打开 Chrome `chrome://extensions` 并启用开发者模式。
3. 选择“加载已解压的扩展程序”，指向解压目录。
4. 扩展稳定 ID 为 `jpmabplkjdmlfjpllogjaieehdohkndg`。
5. 在 Dashboard 中登录预先由 CloudBase 管理端创建的个人账号并同步；手机使用相同账号访问 Web 地址。

生产桥接只接受上述扩展 ID，且扩展只允许访问固定 CloudBase Web Origin。迁移到自定义域名或更换扩展 ID 时，通过构建环境变量同时更新双方白名单。

## 数据与恢复

- 本地和单个云快照上限均为 8 MiB。
- CSV 是完整、带 BOM 的 UTF-8 可迁移副本；导入前会全量校验并一次提交。
- 退出账号不会删除本地数据。
- 账号重新绑定或设备接管前，界面强制先导出 CSV 并进行显式确认。
- 云端只保留最近一次完整只读快照，不提供双向合并或历史恢复。

完整验收结果见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。
