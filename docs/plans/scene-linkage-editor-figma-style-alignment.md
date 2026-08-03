# 场景联动编辑页 Figma 样式对齐

## 当前目标

按 Figma `jetlinks clode Copy` 节点 `6180:6084` 自上而下还原场景联动编辑页的视觉样式与布局，保留现有数据模型、接口、校验、选择器、弹窗和保存行为。

设计依据：

- 整页节点：`6180:6084`
- 顶部操作条：`4785:9684`
- 场景名称：`4758:13686`
- 条件、动作与高级设置区域：`4758:14105`

## 影响范围与 owning module

- Owning module：`ui/modules/iot-ui`
- 页面入口：`views/scene-linkage/editor/index.vue`
- 现有子组件仅作为被页面样式承载的表单控件，不修改其数据和事件契约。

## 交互方案档案

- `solutionName`：场景规则配置页（沿用现有单对象编辑流程）
- `primaryFilterSurface`：无
- `contentSurface`：名称表单与触发条件、附加条件、执行动作、高级设置的连续配置区
- `detailCarrier`：当前编辑路由
- `editMode`：保持已有字段直接编辑及选择器弹窗
- `coreComponents`：现有 Ant Design Vue 输入、选择、开关、单选按钮和页面内业务组件
- `actionPlacement`：取消与保存保留在顶部操作条右侧
- `densityTarget`：桌面宽度下采用 16px 容器内边距、12px 区块间距、32px 表单控件高度
- `sidebarMode`：无页面内侧栏
- `confirmationMode`：Figma 已指定唯一设计稿，按仓库 M 级任务门禁等待实施确认
- `rejectedAlternatives`：不改为配置向导、对象详情工作区、主从详情或表格页
- `searchShellDecision`：无搜索层

## 明确不做

- 不改接口、表单字段、校验规则、保存和返回行为。
- 不修改选择器、设备范围弹窗及其他子组件的对外契约。
- 不新增统计、帮助、侧栏、步骤条或设计稿外的业务内容。
- 不修改 `runtime-ui/` 或其他页面。

## 实施步骤

1. 将顶部改为设计稿的导航与操作条，保留既有取消、保存事件。
2. 将场景名称调整为独立表单容器，并保持现有输入绑定和校验信息。
3. 对齐触发条件、附加条件、执行动作及高级设置的区块层级、间距、圆角、边框、内层编辑行和添加按钮。
4. 对现有输入、选择、开关、单选、删除和范围选择控件施加限定作用域的视觉样式，不改变模板数据流或组件事件。
5. 补充桌面与窄屏约束，避免现有动态条件行、错误文案和操作按钮重叠。

## 风险与待确认点

- `index.vue` 已有 1500 余行且包含两段历史样式；本次只收敛与编辑页相关的样式，避免业务重构或无关清理。
- 设计稿展示的是设备属性触发和设备指令动作示例；其他现有触发/动作类型沿用同一视觉体系，不按示例删减功能。
- 设计稿使用固定 1250px 宽度；实现将以页面实际可用宽度为上限，并保留窄屏换行与横向可用性。

## 验证方式

- 执行 iot-ui 最小可用的类型检查或构建命令，并记录结果。
- 在 `http://localhost:9102/ht_device/#/iot-user/scene-linkage/editor` 检查顶部、名称、各编辑区、动态条件行、展开高级设置和保存/取消操作。
- 使用浏览器截图与 Figma 节点进行桌面和窄屏视觉对比，检查间距、边框、圆角、控件高度、溢出及遮挡。

## 实施与验证结果

已完成：

- `views/scene-linkage/editor/index.vue`：将页面内三段 `scoped style` 合并为单一外部样式入口 `SceneLinkageEditor.css`，保持既有 CSS 加载顺序和视觉行为不变；后续样式去重与组件拆分均以该文件为唯一入口。
- `views/scene-linkage/editor/SceneLinkageEditor.css`：颜色、容器、边框、状态色优先复用 `jetlinks-web-core/src/style.css` 的语义变量；选择器宽度与网格尺寸等局部布局约束保留在页面样式中。
- `views/scene-linkage/editor/index.vue`：编辑页标题与场景名称字段统一从 `locales/lang/zh.json`、`locales/lang/en.json` 的 `IotSceneLinkage` 资源读取。
- `views/scene-linkage/editor/index.vue`：顶部替换为带返回、标题、规则摘要和取消/保存操作的设计稿操作条；原有返回与保存事件保持不变。
- `views/scene-linkage/editor/index.vue`：场景名称改为独立表单容器，保留原有 `v-model`、占位文案与校验信息。
- `views/scene-linkage/editor/index.vue`：在现有编辑器作用域内对触发条件、附加条件、执行动作、高级设置、表单控件和添加按钮统一对齐设计稿的容器、间距、边框、圆角和控件高度。
- 窄屏：编辑器保留 `62.5rem` 的最小配置宽度，避免项目侧栏未收起时将场景规则、字段和操作按钮压缩换行；外层承载横向可视区域。

验证结果：

- `git -C ui diff --check -- modules/iot-ui/views/scene-linkage/editor/index.vue modules/iot-ui/views/scene-linkage/editor/SceneLinkageEditor.css`：通过。
- 编辑器 SFC 静态检查：只保留一个 `scoped` 外部样式入口；`SceneLinkageEditor.css` 不包含 SFC 样式标签。
- `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过，输出约 698 条工作区既有类型错误，主要位于 `jetlinks-web-core`、设备列表与场景联动既有组件；本次模板和样式变更未出现新的模板解析错误。
- 浏览器视觉检查：已在 `http://localhost:9102/ht_device/#/iot-user/scene-linkage/editor` 对比 Figma 节点 `6180:6084`。桌面首屏及高级设置展开态确认顶部操作条、名称区、配置容器、添加按钮和高级设置没有遮挡或溢出；窄屏确认编辑内容不再被压缩换行。
