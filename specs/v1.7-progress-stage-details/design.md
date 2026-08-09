# Recruitment Tracker v1.7 进度节点详情设计

## 架构与模块边界

- `packages/core`：定义 `progressStage.note` 默认值、兼容归一化、校验与工作流复制规则。
- `apps/extension`：在 `ProgressEditorDialog` 中维护每个节点的备注输入并通过现有 `replaceProgress` 服务保存。
- `packages/ui`：让 `ProgressTimeline` 管理单个展开节点，安全分段渲染普通文本与 HTTP/HTTPS URL。
- `apps/web`：继续只读消费 CloudBase 快照；共享时间线自动获得节点详情能力，不增加写入口。
- CSV 与 CloudBase 快照：仍序列化整个 `progressStages` 数组，无需新增列、集合或权限。

## 数据模型

节点结构扩展为：

```js
{
  id: "stage-1",
  name: "技术一面",
  phase: "interview",
  isTerminal: false,
  date: "2026-08-12",
  note: "面试官：张老师\n会议：https://meeting.example.com/abc"
}
```

`note` 是必备但可为空的字符串字段。默认节点、新增节点和 CSV 回退生成的单节点工作流都写入空字符串。`applyDatasetCompatibilityDefaults` 对所有 application 节点执行非破坏性补值，使 schemaVersion=1 的历史数据可继续使用。

## 编辑器设计

现有环节行由固定六列扩展为“首行控制字段 + 次行备注”的两层布局。备注输入独占整行，最小高度 64px，可垂直调整；标签为“备注或面试链接”，辅助文案说明可填写会议链接、反馈或准备事项。保存前仅裁剪首尾空白，不改动内部换行和 URL。

## 时间线详情交互

每个节点使用原生 `button` 作为点击与键盘触发面。标记和名称继续沿用现有 Steps 视觉状态；`aria-expanded` 指示是否展开，`aria-controls` 指向时间线下方唯一详情面板。

详情面板包含：

- 左侧状态强调条和节点名称；
- 日期字段，空值显示“未填写”；
- 备注正文，空值显示“暂无备注”；
- 备注中的 HTTP/HTTPS URL 使用安全外链，保留换行并禁止 HTML 注入。

切换节点只更新 `ProgressTimeline` 的本地展示状态，不触发业务写入。若应用数据刷新后当前节点已不存在，详情自动收起。

## 视觉系统

延续 TDesign 品牌蓝 `#0052D9`、浅品牌底 `#F2F3FF`、主文字 `#1D2129`、次级文字 `#4E5969` 和分割线 `#E7E7E7`。详情面板使用开放式浅灰背景和左侧品牌线，不嵌套厚重卡片；字体继续使用项目打包的 `Noto Sans SC Variable`。

公司图标失败态复用原有 34px 识别区，使用 6px 圆角、浅品牌底、主题蓝 18px/700 公司名称首字。成功态恢复透明容器并显示原图，保证失败回退不会改变表格列宽或公司名称对齐。

## 安全与兼容

- React 文本节点负责转义备注，禁止 `dangerouslySetInnerHTML`。
- URL 仅识别 `https?://`，外链统一 `target="_blank" rel="noopener noreferrer"`。
- 兼容补值不覆盖已存在的 `note`，无论其为空还是有内容。
- 校验层拒绝非字符串备注，避免旧数据兼容掩盖损坏数据。
- 不变更 CloudBase 权限、集合结构、函数公开范围或部署配置。

## 测试策略

- Core：默认值、旧数据补值、类型/长度校验、工作流复制、CSV JSON 往返和快照兼容。
- Extension：备注输入回填、修改、保存、新增环节默认值和失败提示。
- Shared UI：节点按钮无障碍属性、单面板切换、空态、日期、换行与安全外链。
- E2E：电脑扩展保存后重新打开仍可见；只读 Web 展开详情；320–430px 无横向溢出。
- Final：lint、93+ 单元测试、构建、完整 Playwright、公司图标失败态、实际浏览器控制台与相邻招聘信息页回归。
