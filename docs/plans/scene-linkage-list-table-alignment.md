# 场景联动列表表格对齐

## 当前目标

将场景联动列表中的触发方式从场景列拆分为独立列，并按 Figma `jetlinks clode Copy` 节点 `4747:11717` 对齐场景单元格。

## 影响范围与 owning module

- Owning module：`ui/modules/iot-ui`
- 页面入口：`views/scene-linkage/index.vue`
- 不修改接口、筛选条件、场景状态切换、执行记录和编辑/删除操作。

## 实施计划

1. 保留当前 `a-table`、`ConditionFilter` 和既有 i18n 键，将触发方式渲染迁移到独立的 `trigger` 列。
2. 依据 Figma 节点的 `40px` 圆形标识、`12px` 间距和 `14px/20px` 名称样式，调整场景单元格。
3. 执行最小类型检查与浏览器视觉检查，确认列宽、换行和现有操作区无回归。

## 交互方案

- `solutionName`：标准管理表格页。页面首要任务是按条件检索并横向比较多个场景，保留现有标题、`ConditionFilter`、表格和分页。
- `contentSurface`：场景、触发方式、场景规则、状态和操作五列；状态继续位于独立开关列，单条操作继续在行内。
- `editMode`：状态走行内切换；完整规则编辑保留既有独立配置页。
- `coreComponents`：既有 `ConditionFilter`、`a-table`、`a-switch`、`a-tag` 和权限操作按钮。
- `actionPlacement`：新增位于页头，单条操作位于行末；信息密度保持 5 列紧凑表格。
- `confirmationMode`：用户已明确指定列调整与 Figma 单元格参考，默认采用该方案直接实施。
- `rejectedAlternatives`：不改为资产卡片台账、筛选工作台或处置工作台，不增加 KPI、侧栏或额外 banner。

## 风险与验证

- `index.vue` 已超过 300 行，本次为单一表格单元格的窄改，不新增组件或重构既有流程。
- `pnpm --filter iot-ui build`：通过。构建保留工作区既有的 Rollup `input` 配置警告、CSS `//` 注释警告及大 chunk 警告。
- 浏览器：已在 `http://localhost:9102/ht_device/#/iot-user/scene-linkage` 检查。表头含独立的“触发方式”列；场景单元格显示 40px 圆形首字标识和名称，触发方式标签不再位于场景列；规则、状态和操作列未出现遮挡。
