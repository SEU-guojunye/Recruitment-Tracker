# 数据迁移记录

## 2026-08-09：公司分类字段兼容迁移

- 环境：`recuriment-tracker-d4cx9a1dc6d69`（`ap-shanghai`）
- 集合：`user_snapshots`
- 影响：2 个用户快照、2 条公司记录
- 操作：仅为缺失字段补默认值；已有字段和值不覆盖
  - `industryType: ""`
  - `recruitmentBatch: "秋招正式批"`
  - `priority: "P1"`
- 并发保护：每条更新都同时匹配 `_id`、`sourceRevision` 和公司 `id`
- 验证：回读 2 个快照全部通过 v1.6 字段检查；快照修订号、公司数量和申请数量保持不变
- 备份：`.cloudbase-backups/user_snapshots-pre-v1.6-20260809-204643.json`（仅保存在本机并由 Git 排除）
- 备份 SHA-256：`A7FB0F534A0E0FDFC794D4043EFF437142E9AA1A24D88CBD91E57400F8DB5396`

应用层同时保留旧快照读取兼容逻辑，避免旧版 Chrome 本地数据、CSV 或未迁移快照再次触发字段校验错误。
