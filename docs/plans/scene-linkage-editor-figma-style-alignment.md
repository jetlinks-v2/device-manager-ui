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
- `views/scene-linkage/editor/SceneLinkageEditor.css`：补齐设备上线、设备离线、设备状态变化等非属性设备触发的产品选择框宽度，使其与属性触发共用 `--scene-linkage-resource-select-width`，避免回落到通用 `132px` 选择框宽度。
- `views/scene-linkage/editor/SceneLinkageEditor.css`：主触发行的产品选择框增加直接子选择器兜底，不再依赖 `scene-editor__trigger-row--device` class；首个触发选择为设备上线、设备离线或设备状态变化时同样保持 `21rem`。
- `views/device/alarm/components/IotAlarmTargetSelect.vue`：富选项模式的产品 / 设备下拉宽度固定为 `21rem`，不再跟随窄选择框收缩；该组件也被组合触发、附加条件、告警触发 / 条件和设备动作复用，可一并规避同类富选项名称截断问题。
- `views/scene-linkage/editor/components/MultiTriggerCard.vue`、`views/scene-linkage/editor/components/AlarmTriggerRow.vue`：组合触发卡片和告警触发行的产品选择框改为同一 `--scene-linkage-resource-select-width`，与主触发、附加条件和设备动作保持一致。

验证结果：

- `git -C ui diff --check -- modules/iot-ui/views/scene-linkage/editor/index.vue modules/iot-ui/views/scene-linkage/editor/SceneLinkageEditor.css`：通过。
- 编辑器 SFC 静态检查：只保留一个 `scoped` 外部样式入口；`SceneLinkageEditor.css` 不包含 SFC 样式标签。
- `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过，输出约 698 条工作区既有类型错误，主要位于 `jetlinks-web-core`、设备列表与场景联动既有组件；本次模板和样式变更未出现新的模板解析错误。
- 浏览器视觉检查：已在 `http://localhost:9102/ht_device/#/iot-user/scene-linkage/editor` 对比 Figma 节点 `6180:6084`。桌面首屏及高级设置展开态确认顶部操作条、名称区、配置容器、添加按钮和高级设置没有遮挡或溢出；窄屏确认编辑内容不再被压缩换行。
- `git -C ui/modules/device-manager-ui diff --check -- views/device/alarm/components/IotAlarmTargetSelect.vue views/scene-linkage/editor/SceneLinkageEditor.css`：通过。
- `PATH=/Users/hukaiyu/.nvm/versions/node/v22.18.0/bin:$PATH pnpm --filter jetlinks-web-core build -- --module-name device-manager-ui`：通过；仍有既有资源路径、CSS `//background` 注释和大 chunk warning。
- `git -C ui/modules/device-manager-ui diff --check -- views/scene-linkage/editor/components/MultiTriggerCard.vue views/scene-linkage/editor/components/AlarmTriggerRow.vue docs/plans/scene-linkage-editor-figma-style-alignment.md`：通过。

### 设备范围选择语义修正

- 目标：场景联动选择设备弹窗中，区域分组和设备分组允许多选用户显式勾选的节点，但不做父子级联和设备展开；自定义只选择具体设备。区域与设备分组提交多个 `selectorValues` 时，设备上报侧需要为设备当前所属区域 / 分组补充绑定 topic，避免动态范围无法命中。
- 影响范围与 owning module：`ui/modules/device-manager-ui/views/scene-linkage/editor/components/DeviceScopeModal.vue`、`ui/modules/device-manager-ui/api/deviceGroup.ts`，后端 `modules/jetlinks-components/rule-engine-component` 的设备选择器注册，以及 `modules/device-manager` 的设备消息 header 重构。
- 关键实现：区域分组按空间树展示，用户勾选哪一级就保存哪一级；设备分组按业务分组平铺展示，不展示下级，不做层级级联。编辑旧场景时保留已保存的多个区域或分组 ID；自定义页继续通过设备分页列表提交 `fixed` 设备 ID。
- 自定义筛选：输入关键字后自动防抖刷新；查询按 `productId = 当前产品` 且 `(name like %关键字% or id like %关键字%)` 组织条件，`or` 放在关键字条件组内，避免放宽为同产品其它设备也返回。
- 后端执行：`space` selector 复用现有 `space-bind$device` 条件，按前端保存的区域 ID 查询设备；`device-group` selector 注入 `dev-group` 条件，仅匹配当前业务分组。设备绑定生命周期会把设备级区域分组写入设备 `bindings.space`，把业务分组写入 `bindings.device-group`，设备上报时由 `DeviceMessageConnector` 读取并传递这些维度，使 `/space/{id}/device/...` 与 `/device-group/{id}/device/...` 订阅可命中；带 `channelId` 的通道级区域绑定不写入设备级 `bindings`。场景触发器 SQL 中多个 selector value 会暂时表现为 `/space/a,b/device/...` 这类 topic，运行时进入 `DeviceTriggerProvider.subscribe` 后由 `TopicUtils.expand` 展开为多个真实订阅 topic。执行任务时由选择器动态查询设备，不保存展开后的固定设备。
- 验证结果：`git -C modules/jetlinks-components diff --check -- rule-engine-component/src/main/java/org/jetlinks/pro/rule/engine/executor/device/DeviceSelectorProviders.java` 通过；`git -C modules/device-manager diff --check -- src/main/java/org/jetlinks/pro/device/message/DeviceMessageConnector.java src/test/java/org/jetlinks/pro/device/message/DeviceMessageConnectorTest.java` 通过；`git -C ui/modules/device-manager-ui diff --check -- views/scene-linkage/editor/components/DeviceScopeModal.vue views/scene-linkage/editor/components/MultiTriggerCard.vue views/scene-linkage/editor/index.vue views/scene-linkage/utils.ts api/deviceGroup.ts docs/plans/scene-linkage-editor-figma-style-alignment.md` 通过；`mvn -DskipTests compile` 在 `modules/device-manager` 通过；`mvn -Dtest=DeviceMessageConnectorTest test` 在 `modules/device-manager` 未进入用例执行，模块既有测试源码存在 `DeviceCommandSupportTest`、`DeviceObjectProviderTest`、`ProductObjectProviderTest` 与当前依赖 API 不匹配的 testCompile 错误；`PATH=/Users/hukaiyu/.nvm/versions/node/v22.18.0/bin:$PATH /Users/hukaiyu/.nvm/versions/node/v22.18.0/bin/node /usr/local/bin/pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 通过，仅保留既有资源路径、CSS `//background` 注释、visualization 资源目录、Rollup output option 和大 chunk warning。

### 设备范围回显与规则摘要优化

- 目标：设备触发、设备附加条件和设备动作选择区域分组或设备分组后，确认按钮不再只显示“范围选择”，而是显示“区域分组：xxx”或“设备分组：xxx”；鼠标悬停按钮、顶部规则摘要片段或保存后返回列表的规则摘要时展示完整范围名单；顶部场景规则摘要同步带出产品对应的设备范围，便于编辑和列表查看时确认触发和动作影响范围。
- 影响范围与 owning module：`ui/modules/device-manager-ui/views/scene-linkage/editor`、`ui/modules/device-manager-ui/views/scene-linkage/index.vue`，涉及主触发、组合触发、设备附加条件、设备动作、`SceneRuleSummary` 和列表规则列的展示文案；不改 `DeviceScopeModal` 保存契约、后端选择器、接口字段或执行逻辑。
- 实施步骤：新增本地范围文案工具，复用已有 `selectorValues.name` 与 `scopeOptions.names`；按钮短文案展示首个名称与数量，`title` 展示完整名称列表；顶部摘要短文案保持紧凑，摘要片段 `title` 展示完整范围；保存时在 `options.summary` 外补充完整摘要 `options.summaryTitle`，列表继续展示紧凑摘要并用 `summaryTitle` 作为悬停完整内容；对没有 `summaryTitle` 的旧数据，列表页从 `trigger.device`、`branches.then.actions` 中的设备选择器和 action options 反推完整范围，避免 hover 仍显示“等 N 个”；在中英文 `IotSceneLinkage` 资源补充区域分组、设备分组、产品范围摘要文案；编辑旧数据缺少名称时回退到已选数量或 ID。
- 补充提示：`DeviceScopeModal.vue` 在区域分组和设备分组页签下展示面向配置人员的范围说明，强调按显式勾选的分组维度生效，不自动包含下级区域 / 设备或展开为固定设备清单；底部统计按当前选择类型显示“已选 N 个区域分组 / 已选 N 个设备分组 / 已选 N 台设备”，避免把分组数量描述为设备台数。
- 验证结果：`node -e "JSON.parse(...zh/en...)"` 通过；`git -C ui/modules/device-manager-ui diff --check -- views/scene-linkage/editor/deviceScopeLabel.ts views/scene-linkage/editor/components/MultiTriggerCard.vue views/scene-linkage/editor/components/DeviceActionRow.vue views/scene-linkage/editor/components/SceneConditionRow.vue views/scene-linkage/editor/components/SceneRuleSummary.vue views/scene-linkage/editor/index.vue views/scene-linkage/index.vue views/scene-linkage/utils.ts locales/lang/zh.json locales/lang/en.json docs/plans/scene-linkage-editor-figma-style-alignment.md` 通过；补充 hover 完整名单、分组选择说明和列表规则列完整摘要后复跑 `PATH=/Users/hukaiyu/.nvm/versions/node/v22.18.0/bin:$PATH /Users/hukaiyu/.nvm/versions/node/v22.18.0/bin/node /usr/local/bin/pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 通过，仅保留既有资源路径、CSS `//background` 注释、visualization 资源目录、Rollup output option 和大 chunk warning。`PATH=/Users/hukaiyu/.nvm/versions/node/v22.18.0/bin:$PATH /Users/hukaiyu/.nvm/versions/node/v22.18.0/bin/node /usr/local/bin/pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json --pretty false` 未通过，先被既有 `modules/device-manager-ui/views/link/Certificate/type.d.ts:2` 的 TS1005 语法错误阻断，未进入本次范围回显文件检查。`DeviceActionRow.vue`、`SceneConditionRow.vue`、`DeviceScopeModal.vue`、编辑器 `index.vue` 和 `utils.ts` 为既有超过 300 行文件，本次只做范围回显、提示文案与列表 hover 窄改，未扩大组件职责。
