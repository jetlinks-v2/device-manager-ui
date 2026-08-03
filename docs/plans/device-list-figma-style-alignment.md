# 设备列表 Figma 样式对齐

## 当前目标

严格按照 Figma `jetlinks clode Copy` 中的设备列表设计还原运营端设备列表样式，保持现有查询、批量操作、分页、详情跳转和新增设备等功能行为不变。

设计依据：

- 列表主体：Figma 节点 `4664:13662`
- 状态胶囊：Figma 节点 `4664:15384`
- 风险等级标签：Figma 节点 `4722:11054`
- 页面级画布：Figma 节点 `4541:3845`（仅用于确认全局视觉背景，不从其中引入其他业务页面结构）

## 影响范围与 owning module

- Owning module：`ui/modules/iot-ui`
- 页面入口：`ui/modules/iot-ui/views/device/list/index.vue`
- 列表组合：`ui/modules/iot-ui/views/device/list/components/IotDeviceAssetListView.vue`
- 表格主体：`ui/modules/iot-ui/views/device/list/components/IotDeviceAssetTable.vue`
- 状态样式：`ui/modules/iot-ui/views/device/list/components/IotDeviceStatusPill.vue`
- 公共状态标签：`ui/jetlinks-web-core/src/components/StatusTag/index.vue`
- 页面样式：`ui/modules/iot-ui/views/device/list/styles/device-list-view.less`
- 表格样式：`ui/modules/iot-ui/views/device/list/styles/device-list-table.less`

## 交互方案档案

- `solutionName`：标准管理表格页（沿用现有设备资产列表结构）
- `primaryFilterSurface`：现有 `ConditionFilter`，保持结构和样式不变
- `contentSurface`：现有 `j-pro-table`
- `detailCarrier`：保持现有详情路由和操作弹层
- `editMode`：保持现有新增/编辑抽屉及操作入口
- `coreComponents`：`ConditionFilter`、`j-pro-table`、`j-permission-button`、Ant Design Vue 基础组件
- `actionPlacement`：新增设备位于标题行右侧；批量操作位于列表工具栏；单条操作位于行末
- `densityTarget`：表头约 `3rem`、数据行约 `4rem`，保留 6-10 个核心信息列及横向滚动能力
- `sidebarMode`：无页面内侧栏
- `confirmationMode`：Figma 已指定唯一视觉方案；按仓库 M 级任务门禁等待实施确认
- `rejectedAlternatives`：不改为卡片台账、筛选工作台、主从详情或监控看板
- `searchShellDecision`：继续使用现有 `ConditionFilter`，本次不修改搜索

## 明确不做

- 不修改搜索组件、筛选字段、查询参数或路由回显。
- 不修改接口、状态管理、权限、国际化文案和业务事件。
- 不新增统计卡、说明横幅、侧栏或其他 Figma 页面中的无关区块。
- 不修改 `runtime-ui/`，不把改动扩散到其他设备页面。
- 不因样式对齐重构现有业务逻辑或替换组件库。

## 实施步骤

1. 对照 Figma 子节点核对标题区、批量工具栏、表格表头/行、设备图标、状态胶囊和分页的尺寸与间距。
2. 仅在必要模板节点补充样式类或图标槽位，事件、props、slots 和调用链保持不变。
3. 使用现有 `--jet-theme-*`、`--space-*`、`--fs-*`、`--r-*` 等变量映射设计色彩与排版；现有变量无法表达的局部尺寸按 `16px` 基准换算为 `rem`。
4. 将标题行、批量操作行、表格容器、表头/数据行、分页及状态胶囊调整到设计稿节奏；搜索区域不改。
5. 检查窄屏和横向滚动，不让按钮、表格文字或分页发生遮挡。

### 风险等级标签局部修正

1. 为 `IotDeviceStatusPill.vue` 增加仅由风险列启用的展示变体，保持在线、离线等状态胶囊不变。
2. 按 Figma 使用 `0.875rem` 图标、`0.8125rem` 中等字重文字、`0.125rem` 间距、`0.25rem 0.625rem` 内边距和 `0.6875rem` 圆角。
3. 无风险使用现有主题主色与弱背景，有风险统一使用现有警告色与警告背景；不写入固定色值。

## 风险与待确认点

- Figma 节点 `4541:3845` 是包含大量页面的画布节点，无法作为单个组件直接生成上下文；本次只采用明确的设备列表和状态节点，不推测画布中其他页面设计。
- `IotDeviceAssetTable.vue` 当前已超过 300 行。本次是纯视觉窄改，不增加业务逻辑；若模板改动不可避免，只做最小样式挂点，不发起与需求无关的结构重构。
- `j-pro-table` 内部 DOM 依赖当前版本，必要的深层样式将限定在 `.iot-device-list` 作用域内，避免影响其他表格。

## 验证方式

- 执行 iot-ui 相关 lint/typecheck；若仓库脚本不支持模块级命令，记录实际可执行的最小命令和结果。
- 在 `http://localhost:9102/ht_device/#/iot-user/device/list` 验证标题、按钮、工具栏、表头、行高、状态、横向滚动和分页。
- 使用桌面与窄屏视口截图对照 Figma，确认搜索区域未变化、主题色随现有 CSS 变量生效、页面无重叠或溢出。
- 回归新增设备、批量按钮禁用态、行选择、详情入口和分页，确认只发生视觉变化。

## 实施与验证结果

已完成：

- `IotDeviceAssetListView.vue`：隐藏路由图标，保留标题与新增设备操作，不改变点击行为。
- `IotDeviceAssetTable.vue`：批量操作补充语义图标；通过 `paginationRender` 将总数和已选数量移至表格底栏，保留页大小选择、快速跳转和翻页回调。
- `useIotDeviceAssetTableColumns.ts`：按 Figma 列宽使用 `rem` 对齐设备、产品、厂商、型号、状态、设备类型、设备分组、风险等级和操作列。
- `device-list-view.less`、`device-list-table.less`：使用现有主题变量调整标题、按钮、表头、`4rem` 数据行、`2.5rem` 设备图标、边框、悬停态和分页布局。
- `IotDeviceStatusPill.vue`：按 Figma 状态组件调整为 `1.5rem` 胶囊，状态色、弱背景和描边均由现有主题变量派生。
- 风险等级标签：仅风险列启用独立 `risk` 变体，按节点 `4722:11054` 增加蓝色勾选/橙色感叹号图标，并对齐标签间距、内边距、字号和圆角；其他状态胶囊保持原样。
- `IotDeviceAssetTable.vue`：状态与风险等级列统一改用全局 `StatusTag`；状态的在线/离线或停用/维护分别映射到 `success/disabled/processing`，风险的无风险/有风险分别映射到 `info/warning` 或 `error`，风险图标仍通过组件的 `icon` 插槽保留且不显示边框。接口字段、状态文案、筛选和业务事件均未改动。
- 搜索组件 `IotDeviceAssetSearchBar.vue` 未修改。

验证结果：

- `pnpm -F jetlinks-web-core build`：通过，Vite 完成 `19163` 个模块转换并成功生成生产构建。
- `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过；输出包含 `698` 行仓库既有类型错误，主要位于 `jetlinks-web-core`、场景联动和设备详情等代码。本次修改的六个实现文件未出现在错误列表中。
- 目标文件范围 `git diff --check`：通过；全仓检查仅命中 `modules/system-setting-ui/views/Dashboard/index.vue` 中与本任务无关的既有尾随空格，本次未触碰。
- 硬编码扫描：本次修改的样式、状态组件和列配置未新增 `px`、十六进制颜色或 `rgba()`。
- `StatusTag` 列级替换：在 `http://localhost:9102/ht_device/#/iot-user/device/list` 刷新后已确认，状态列以 `StatusTag` 正确展示 Figma 在线绿 `#06C170`；风险等级列以无边框 `StatusTag` 和 `icon` 插槽正确展示 Figma 无风险蓝 `#1593FF`。
- `pnpm --filter iot-ui build`：已启动并进入 Vite `transforming...` 阶段，但当前受控命令窗口未返回最终退出码；浏览器热更新和刷新后的页面渲染正常。
- `pnpm exec vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过，错误来自 `jetlinks-web-core`、设备详情和场景联动等既有类型问题；本次 `IotDeviceAssetTable.vue` 未出现在检查输出中。
- 浏览器视觉回归：已在当前桌面视口刷新并检查状态与风险等级两列；未执行窄屏、分页和批量操作的完整回归。
