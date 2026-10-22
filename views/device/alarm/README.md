# 物联告警规则与记录工作区

## 通知对象已选人员名称回显修复

- 目标与 owning module：修复运行时设备详情、产品详情编辑设备告警时，已选通知对象不在人员首屏数据中便显示用户 ID 的问题；统一显示人员名称。
- 影响范围：仅 `runtime-ui/modules/device-manager-ui` 的设备详情、产品详情告警配置入口及告警工作区定向测试，复用告警主页面已有的“人员首屏 + 按已选 ID 查询 + 按 ID 合并”逻辑。
- 明确不做：不修改后端接口、通知配置结构、人员权限、分页交互、告警保存链路及页面样式，不修改运营端 `ui/`。
- 实施步骤：打开编辑器时提取已保存的 `userIds`，并行查询人员首屏和已选人员详情，合并后再传给通知对象选择框；滚动加载继续按 ID 去重合并。
- 验证结果：`node --test tests/alarmWorkspaceView.test.mjs` 4/4 通过，`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 在 Node 22.18.0 下构建通过（共转换 10297 个模块），`git diff --check` 通过。9200 运行页面实测确认：设备详情编辑告警时，原 UUID 标签已回显为人员名称，同时保留人员本身为数字的名称。

## 告警自动解除 V1

- 目标与 owning module：在 `modules/device-manager` 和 `runtime-ui/modules/device-manager-ui` 现有设备属性预处理告警中增加“自动解除告警”开关；开启后以告警匹配条件的严格反向条件执行解除。物联告警、产品详情和设备详情复用同一公共编辑弹窗与配置协议。
- 配置契约：关闭时继续保存已发布的 `simple` 结构；开启时保存为 `composite`，其中一个 `simple` 分支使用原 `number-range` 条件执行 `device-alarm` 及可选 `notify`，另一个 `simple` 分支反转 `not` 后执行 `device-alarm-relieve`。不额外持久化 `autoRelieve` 字段，编辑时由解除分支反推开关状态。
- 后端落点：在 `modules/device-manager/src/main/java/org/jetlinks/pro/device/message/preprocessor/` 增加 `DeviceMessageAlarmRelievePreprocessor`，注册到 `DeviceMessagePreprocessorConfiguration`，复用 `RelievedAlarmCommand` 和规则引擎已有解除、幂等、历史及事件能力。`DeviceAlarmPreprocessService` 同时兼容从 `composite` 解析通知配置。
- 前端落点：`views/device/alarm/components/DeviceAlarmEditorModal.vue` 在告警条件预览与通知配置之间增加开关和实时解除条件预览；`types.ts` 与 `utils.ts` 统一读写新旧配置。设备库本期不展示开关，但编辑、发布、安装和还原时保留已有 `composite` 解除分支。
- 明确不做：不新增数据库字段或 REST 接口，不修改规则引擎告警状态核心，不配置独立解除阈值、回差、延时解除或解除通知，不处理设备消息乱序，不修改运营端 `ui/modules/device-manager-ui` 边界。
- 兼容与风险：历史 `simple` 配置不迁移；解除和触发共用同一 `alarmConfigId` 及目标标识，无活动告警时由已有规则服务按无效解除处理。编辑端只接管历史 `simple` 和本功能生成的标准双分支 `composite`，其他复合预处理器不进入编辑链路，避免保存时丢失未知分支。V1 保持当前消息到达/处理顺序语义，乱序上报仍是剩余风险。
- 联调修复：真实设备恢复消息触发解除时，规则服务在写解除历史处因 `alarmTime` 为空发生拆箱异常。公共告警上下文与自动解除处理器统一沿用有效的设备消息时间，并以同一事件时间填充 `alarmTime` 与 `relieveTime`；规则服务继续据此拒绝早于当前告警的历史或乱序恢复消息。消息时间无效时保持为空，由规则服务按既有处理时间逻辑兜底。修复位于 `modules/jetlinks-components/things-component/src/main/java/org/jetlinks/pro/things/impl/preprocessor/internal/AbstractMessageAlarmPreprocessor.java` 与 `modules/device-manager/src/main/java/org/jetlinks/pro/device/message/preprocessor/DeviceMessageAlarmRelievePreprocessor.java`，未修改规则引擎核心。
- 验证结果：`iot-service` Reactor 编译 52/52 模块通过；后端 3 个定向测试类共 20 项通过，覆盖公共告警上下文的消息时间透传、无效时间回退、自动解除命令参数、原消息返回及错误向上游传播。公共告警命令方法使用 `Command<Mono<R>>` 强类型执行，不再依赖运行时 `Class.cast`。前端定向测试覆盖 `simple`/`composite` 回显、区间内外两类 matcher 严格互补、关闭后回归 `simple`、非标准 `composite` 不进入编辑链路，以及触发与解除分支共用告警名称/等级、设备库 `composite` 内两个告警处理器名称的递归本地化。Node 22 下 `device-manager-ui` 运行时模块构建通过，中英文 locale JSON 解析、构建产物中的开关与 `device-alarm-relieve` 配置检查及 `git diff --check` 通过。模块级 `vue-tsc` 仍被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断，本次未修改该文件。真实设备恢复消息的服务重载与再次上报验证仍待部署后复核。

## 新增/修改弹窗对齐视觉告警

- 目标与 owning module：将 `runtime-ui/modules/device-manager-ui` 的物联告警新增/修改弹窗改造成与视觉告警新增/修改弹窗一致的三栏配置工作区；物联告警主页面、产品详情和设备详情继续复用 `views/device/alarm/components/DeviceAlarmEditorModal.vue`。
- 任务级别：M。属于已有弹窗壳层和信息架构调整，方案已确认并完成页面、国际化和测试变更。
- 参考对象：`runtime-ui/modules/jetlinks-ai-ui/views/visual-alarm-preview/components/VisualAlarmRuleDialog.vue`。两者的共同任务都是围绕单条告警规则完成多组强校验配置；只借鉴大弹层、顶部标题说明、左侧基础配置与分区导航、中间编辑区、右侧摘要和底部操作栏，不复制视觉算法、摄像头、时间计划或通知业务实现。

### 交互方案档案

- `solutionName`：视觉告警式三栏配置工作区，对应“配置向导 / 能力开通页”的单页分区变体；配置项之间没有强制先后关系，因此使用分区导航，不增加步骤提交语义。
- `primaryFilterSurface`：无。
- `contentSurface`：左侧承载告警名称、告警等级和“告警对象 / 触发与解除 / 通知配置”导航；中间将互补的触发条件与自动解除放在同一配置面板。
- `detailCarrier`：右侧实时规则摘要，展示当前告警对象、属性、触发条件、解除条件和通知状态，不引入虚构统计数据。
- `editMode`：新增、编辑继续共用完整配置弹层；名称、等级与各分区直接编辑，不新增独立路由。
- `coreComponents`：继续复用 Ant Design Vue 表单控件、现有 `j-card-select`、`RegistryComponent`、`DeviceAlarmNotificationConfig` 和 `IotAlarmTargetSelect`；实施时核验当前工作区是否已有合适的固定底部操作组件，没有则沿用弹层 footer。
- `actionPlacement`：右下固定“取消 / 保存”，保持现有保存事件和校验入口。
- `densityTarget`：左栏紧凑；中栏每个分区只展示当前任务字段；右栏摘要不超过 8 项，长文本省略并提供完整提示。
- `sidebarMode`：仅为弹窗内部配置导航，不新增应用级侧栏；选中态使用完整描边或弱底，不使用单侧彩色线条。
- `confirmationMode`：按本计划确认后实施。
- `rejectedAlternatives`：不直接导入 `jetlinks-ai-ui` 私有组件；不抽取跨模块公共三栏弹窗并同步重构视觉告警；不保留 `720px` 单列长表单；不把无强顺序的配置拆成多步提交。
- `searchShellDecision`：不涉及搜索页壳；对象选择继续使用现有远程选择组件。

### 首屏结构

```text
┌ 标题：新增/编辑告警 · 一句配置说明                         [×] ┐
├──────────────┬────────────────────────┬──────────────────────┤
│ 基础配置      │ 当前配置面板            │ 规则摘要             │
│ 告警名称      │                        │ 告警对象             │
│ 告警等级      │                        │ 触发条件             │
│              │                        │ 解除条件             │
│ [告警对象]    │ 对象 / 触发与解除 /     │ 通知状态             │
│ [触发与解除]  │ 通知的当前编辑内容       │                      │
│ [通知配置]    │                        │                      │
├──────────────┴────────────────────────┴──────────────────────┤
│                                             [取消] [保存]     │
└──────────────────────────────────────────────────────────────┘
```

### 实施边界与步骤

1. 仅重构 `DeviceAlarmEditorModal.vue` 的弹层壳层、字段分区、当前分区状态和摘要展示，保留现有 `props`、`emits`、表单 model、校验和保存契约。
2. 保留 `RegistryComponent page-code="device/alarm" code="alarm-editor"`、产品/设备固定范围与只读逻辑、自动解除配置和通知配置；通知区是否可用继续服从现有注册扩展能力。
3. 在 `locales/lang/{zh,en}.json` 增加弹窗说明、三个配置分区、规则摘要及摘要字段文案，用户可见文本不在组件内硬编码。
4. 宽屏采用三栏；中等宽度降级为两栏并让摘要下沉；窄屏使用全屏单栏，保持字段和底部操作可滚动、可触达。
5. 扩充 `scripts/test-alarm-workspace.mjs` 对应结构测试，覆盖三栏壳层、分区导航、摘要、自动解除、通知扩展锚点及三个既有入口继续复用同一弹窗。

### 明确不做

- 不修改后端、REST 接口、配置 JSON 协议、数据库、权限、菜单和路由。
- 不修改运营端 `ui/`，不改视觉告警模块，不新增跨模块直接依赖。
- 不改变自动解除 V1 的 `simple` / `composite` 兼容逻辑，不增加独立解除阈值、回差或延时能力。
- 不顺带重构物联告警列表、记录卡、查询、处理和历史弹窗。

### 风险与验证

- 风险：同一弹窗在主页面、产品详情和设备详情三种上下文复用，必须验证固定产品范围、只读设备范围和普通可选范围；自定义大弹层还需验证遮罩关闭、焦点、滚动和窄屏操作区。
- 验证：运行 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs`、中英文 locale JSON 解析、`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 和 `git diff --check`；补充大/中/小视口的新增与编辑交互检查。
- 已知限制：模块级 `vue-tsc` 可能继续被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断；若仍发生，只记录为既有阻塞并提供本次定向验证结果。

### 实现与验证结果

- `DeviceAlarmEditorModal.vue` 已改为最大 `100rem` 的三栏配置工作区：左侧保留名称、等级和“告警对象 / 触发与解除 / 通知配置”三个入口，中间将触发条件与自动解除合并编辑，右侧仍分别展示触发和解除摘要；取消、保存及关闭行为继续沿用原事件契约。
- 新增 `DeviceAlarmEditorModal.less` 承载弹层壳层、选中态与宽屏三栏 / 中屏两栏 / 窄屏全屏单栏响应式样式。标题区仅保留平台 `.ant-modal-title` 的统一分隔线，不再给 `.ant-modal-header` 叠加通栏边框；构建产物已核对 `.device-alarm-editor-modal-wrap .ant-modal-*` 后代选择器，避免 scoped LESS 将 Modal 样式错误压平到遮罩容器。
- 中英文资源保持 `DeviceAlarm.editor.*` key 对称，触发分区文案已表达触发与解除的合并关系；用户可见说明、导航、摘要与关闭状态均未在组件中硬编码。
- `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 通过，共 13 项，新增覆盖三栏结构、三分区、触发与解除合并、通知扩展锚点、响应式断点和三个入口继续复用公共弹窗。
- Node `22.18.0` 下 `pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过；仅有既有资源路径、浏览器基线数据、Rollup output、CSS 注释和 chunk 体积警告。`git diff --check` 通过。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断，本次未修改该文件。当前无登录态浏览器环境，真实新增/编辑、三个入口及大中小视口的目视交互仍待部署后复核。
- 交付：实现提交 `498855d`；[前端 PR #340](https://github.com/jetlinks-v2/device-manager-ui/pull/340)，目标分支 `2.20`。

## 左栏前三排复用视觉告警样式（已完成，2026-09-23）

- 目标与 owning module：在 `runtime-ui/modules/device-manager-ui` 中让物联告警左侧标题、搜索框和“全部告警”前三排复用视觉告警的尺寸、间距与视觉规格，确保两个页面切换时这三排没有位置跳动；视觉告警同时移除入口右侧数量，关联计划记录在 `runtime-ui/modules/jetlinks-ai-ui/docs/plans/visual-alarm-preview.md`。
- 影响范围：仅调整 `views/device/alarm/index.vue` 的标题行结构、搜索框和“全部告警”入口局部样式、现有告警工作区定向测试和本文档；两个模块继续各自维护样式，不新增跨模块组件或依赖。
- 明确不做：不改规则列表卡片、规则/记录查询、搜索、筛选、默认范围、选中态语义、接口、权限、路由、文案或运营端 `ui/`。
- 实施步骤：1. 标题行复用视觉告警的 `2rem` 行高、标题/数量基线结构、`--fs-18`/`700` 标题和 `--fs-12` 数量规格；2. 搜索框复用相同的 `2rem` 高度，左栏三排继续统一采用 `--space-4` 间距；3. 为现有 `AlertOutlined` 增加同规格图标容器，并将按钮布局、标题、最小高度、内边距、列间距、边框、悬浮/焦点和选中态完整对齐；4. 保留 `showAllRecords()`、`aria-pressed` 和键盘操作；5. 扩充定向测试覆盖结构和关键尺寸。
- 实现结果：`index.vue` 为标题增加与视觉告警一致的内层基线容器，统一 `2rem` 标题/搜索行、`--space-4` 排间距和标题/数量字体规格；“全部告警”采用相同的两列结构、`3.5rem` 最小高度、`0.875rem` 内边距、1.5rem 主色图标、14px/600 标题以及一致的悬浮、焦点和选中反馈。查询、默认范围和 `showAllRecords()` 保持不变。
- 验证结果：`node scripts/test-alarm-workspace.mjs` 10/10、`pnpm exec vue-tsc --noEmit --pretty false`、`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 与模块 `git diff --check` 通过；模块独立类型检查仍被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断。构建仅保留既有资源路径、浏览器基线、Rollup 输出选项、CSS 注释及大 chunk 警告；`index.vue` 为 210 行。登录态下跨页面切换、不同数量宽度和浏览器缩放档位仍需目视确认。
- 交付：实现提交 `139abd8564713438ef81c9cd397ac292e4ea0014`；Pull Request：`https://github.com/jetlinks-v2/device-manager-ui/pull/311`。

## 处理记录详情告警名称补齐

- 目标：修复处理记录接口未返回 `alarmName` / `alarmConfigName` 时，详情中的告警名称统一显示 `—`。
- 影响范围与 owning module：仅运行时前端 `runtime-ui/modules/device-manager-ui` 的告警历史查询 hook、定向测试与本文档；不修改后端接口、数据表、页面结构或运营端 `ui/`。
- 明确不做：不按当前规则配置反查名称，不覆盖接口未来可能返回的行级快照名称，不改告警日志和处理记录的查询、分页、权限与展示字段。
- 实施：历史行缺少名称时，使用打开弹窗时已选告警记录的触发快照名称补齐；接口已有 `alarmConfigName` 或 `alarmName` 时保持原值。
- 风险与验证：依赖父告警记录携带快照名称；通过定向测试覆盖处理历史缺名回退、接口名称优先及已有异步隔离，并执行模块构建、类型检查与 `git diff --check`。
- 验证结果：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 与 `git diff --check` 通过。构建仅保留已有的依赖数据提示、资源路径、Rollup output、CSS 注释和 chunk 体积警告。本次未修改 Vue 文件，`useDeviceAlarmHistory.ts` 56 行；模块级 `vue-tsc` 仍被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断。运行时工作区没有 `check:ui-style` 命令，且未在登录环境复核真实处理记录；剩余风险是极早期异常告警记录本身也不携带名称时仍会显示 `—`。
- 交付：实现提交 `4b81414`；[PR #308](https://github.com/jetlinks-v2/device-manager-ui/pull/308)，目标分支 `2.12-uat-next`。

## 规则卡图标与操作展示统一

- 目标与范围：物联告警左侧规则卡统一使用视觉告警“全部告警”的 `AlertOutlined` 图标，并让右上角编辑/删除操作入口默认隐藏、悬停卡片时显示；仅调整 `views/device/alarm/components/DeviceAlarmRuleCard.vue` 的图标与局部样式，不改规则筛选、数量、选中态、接口或权限。
- 实施：移除规则卡原内联警灯 SVG 及渐变圆形底，复用现有 `AIcon`，尺寸、字号和主色与 `VisualAlarmCategorySidebar.vue` 的“全部告警”图标保持一致。操作入口通过卡片 `hover` 或 `focus-within` 显示，触屏设备保持可见，兼顾键盘与无悬停设备操作。
- 验证：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（仅有既有资源路径、CSS 注释、Rollup output.input 与 chunk 体积警告）；`git diff --check` 通过。修改后的 `DeviceAlarmRuleCard.vue` 共 136 行，未新增组件、业务逻辑或需要解释的复杂分支。
- 交付：实现提交 `55d7dc69f9a5fa1baa662b905b749fc4d2abc554`，Pull Request：`https://github.com/jetlinks-v2/device-manager-ui/pull/306`。

## 左侧“全部告警”入口

- 目标：在运行时物联告警规则侧栏的搜索框下方增加“全部告警”入口，从单条规则范围返回全部告警记录；默认范围呈选中态。
- 范围与落点：仅 `runtime-ui/modules/device-manager-ui/views/device/alarm/index.vue`、本模块中英文 locale 与定向测试。复用现有 `showAllRecords()` 和右侧记录查询；不修改 `ui/`、接口、权限或菜单。
- 方案：沿用规则筛选与记录处置工作台。左侧“标题 → 搜索 → 全部告警 → 规则卡”，右侧保持 `ConditionFilter` 和记录卡；入口仅切换规则范围，保留左右搜索。采用当前规则卡的完整描边、弱底选中反馈，不新增页面壳、统计区或编辑弹窗。
- 实施：`index.vue` 在搜索下方用可键盘操作的按钮和 `aria-pressed` 表示范围，点击复用 `showAllRecords()`；中英文文案位于 `locales/lang/{zh,en}.json`。记录范围测试按实际 `JProTable.request` 契约发起查询，覆盖默认、选规则、保留搜索返回全部及过期响应。
- 验证：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm run build:modules device-manager-ui` 通过（已有资源路径、CSS 注释及 chunk 体积警告）；`git diff --check` 通过，`index.vue` 184 行。`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断；当前运行时工作区无 `check:ui-style` 命令。未在登录页面核验真实权限及数据，部署后需手动检查入口默认选中、选规则、返回全部及搜索保留。
- 交付：实现提交 `6a09587`；[PR #302](https://github.com/jetlinks-v2/device-manager-ui/pull/302)，目标分支 `2.12-uat-next`。

## 运营端编辑时新增按钮闪烁修复

- 目标与范围：仅调整 `ui/modules/device-manager-ui/views/device/alarm/index.vue` 的新增按钮状态绑定，编辑规则期间保持按钮外观稳定。
- 实施：移除新增按钮对公共 `busy` 的原生 `disabled` 绑定，保留 `creating` 加载状态；并发操作继续由 `hooks/useDeviceAlarmWorkspace.ts` 的 `create()` → `run()` 和 `if (busy.value) return` 拦截。保持页面布局、接口、权限及编辑流程不变。
- 验证：`pnpm check:ui-style -- --files modules/device-manager-ui/views/device/alarm/index.vue` 通过；模块内 `node scripts/test-alarm-workspace.mjs` 8 项通过；`ui/` 下 `pnpm run build:modules device-manager-ui` 通过。构建仍有资源路径、Rollup output.input、混合导入、CSS 注释及 chunk 体积警告。代码核对确认编辑不写入 `creating`，新增仍经过 `run()` 互斥；页面 180 行，未新增组件或抽象。
- 未验证：未运行独立 typecheck，模块无统一 lint 脚本；浏览器实际交互待验证，应检查编辑打开前后新增按钮外观稳定、编辑资源加载期间点击新增不会覆盖编辑表单、新增自身加载反馈正常。
- 交付：修复提交 `cd68dc4`；[PR #280](https://github.com/jetlinks-v2/device-manager-ui/pull/280)，合入 `2.12-uat-next`。PR 已按当前底部按钮布局更新，替代旧版标题行按钮方案。

## 右侧记录卡改用 CardBox

- 目标：`DeviceAlarmRecordCard.vue` 的骨架由 `EntityCard` 换成 `jetlinks-web-core` 的 `CardBox`，对齐用户提供的记录卡截图。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui/views/device/alarm/components/DeviceAlarmRecordCard.vue`；不改 CardBox 源码、不改 `index.vue`、不改查询/分页/hook、不改接口与 i18n。
- 为什么是 CardBox：截图里的两条特征就是 CardBox 的内置行为，不是需要另写的装饰——左上角状态色渐变条来自 `.card-top-line`（`linear-gradient(90deg, var(--card-status-color-solid), var(--card-status-color))`），右上角浅色斜角状态位来自 `.card-state-row` + `.card-state`（`clip-path` 斜角）；`getHexColor(code, pe = 0.1)` 默认返回 `rgba(...,0.1)`，正好是截图里的浅色斜角，传 `1` 就是那条实心色条。
- 组装方式：`status` / `status-text` / `status-names` 走内置状态位（`statusNames = { warning: 'error' }`，其余状态由 `getHexColor` 回退灰色）；`#content` 放「标题 + 等级 StatusTag + 2×2 字段网格」；`#bottom-tool` 放「告警日志 / 处理记录 + 告警处理」。`--panel-padding: 1.25rem` 复用 CardBox 自带的内边距变量。
- 需要注意的 CardBox 行为（已在消费侧处理，未改 core）：默认 `contentList` 是单行等分 `a-col`，做不出截图的 2×2，因此走 `#content` 插槽；不传 `#img` 时 `.card-content-main` 的 flex `gap` 会留下空位，用 `display:none` 去掉空头像位；`.card-warp` 恒定 `cursor: pointer`，记录卡不可点，覆盖为 `default`；`#bottom-tool` 渲染在 `.card-warp` 之外，底栏自带 padding 与上边框；`statusText` 默认是硬编码 key，必须显式传。
- 保留的行为：四个字段仍是快照字段（告警设备 / 最近告警时间 / 告警原因 / 持续时长），`canHandleRecord` 继续控制「告警处理」禁用；卡片改为 flex 列布局，双列网格下底栏贴底等高。
- 文案：沿用现有语义（`最近告警时间` / `告警处理`），未照搬截图里的「告警时长」（其值是时间戳，语义不自洽）与「处理告警」。
- 验证：`node scripts/test-alarm-workspace.mjs` 8 项通过；`pnpm run build:modules device-manager-ui` 通过。用构建产物 `dist/assets/style.*.css` 直接渲染手写 DOM fixture（带真实 `data-v-*` scope）并截图，核对顶部色条、右上斜角状态位、标题+等级、2×2 字段与底栏按钮的位置与配色。
- 未验证：无登录环境，未在真实应用里确认 antd 运行时样式、`j-badge-status` 与 `j-ellipsis` 的实际渲染；fixture 里的 antd 基础样式是静态近似（antd v5 为运行时 CSS-in-JS）。

## 左侧规则列表高保真还原与滚动加载

- 目标：按用户提供的高保真截图重做 `/alarms/rules/iot` 左侧规则列表，页脚分页改为滚动到底自动加载下一页，“新增告警”从标题行移到列表底部通栏按钮。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui`，落点 `views/device/alarm/{index.vue,components/DeviceAlarmRuleCard.vue,hooks/useDeviceAlarmPage.ts,hooks/useDeviceAlarmWorkspace.ts}` 与 `locales/lang/{zh,en}.json`；不改接口、权限、菜单和右侧告警记录栏。
- 视觉：标题行保留 `DeviceAlarm.workspace.rules` 与 `DeviceAlarm.workspace.total`（“告警规则 共 N 条”，数量超长时省略并保留 title），新增按钮按截图移到列表底部；搜索框圆角与卡片对齐；卡片为白色圆角块 + 蓝色渐变圆形告警灯图标 + 名称 + 单行摘要（Tooltip 全文）+ 状态/等级两枚 StatusTag，右上角 ⋮ 菜单承载编辑/删除；选中态为蓝色描边 + 主色浅底。
- 图标：截图造型为“警灯”（穹顶 + 底座 + 五道光束），Ant Design 与仓库 iconfont 均无对应字形，因此在 `DeviceAlarmRuleCard.vue` 内联固定 SVG；⋮ 复用 `MoreOutlined` 旋转 90°。
- 滚动加载：`useDeviceAlarmPage` 拆出 `fetchRulePage`，`tableRequest` 仍为替换语义，新增 `appendRulePage`（追加下一页，按稳定 key 去重）与 `reloadRuleRange`（编辑/删除后重取已加载 0..N 页，保留滚动深度）。`useDeviceAlarmWorkspace` 新增 `loadingMore`/`loadMoreError`/`hasMore` 与 `loadMore()`；服务端返回空页时置 `exhausted` 立即停止，避免偏移分页在总数不一致时反复请求。
- 状态隔离：`searchKey`（搜索/首次加载，回到第一页）与 `reloadKey`（编辑/删除，保留范围）分成两个信号，替代原 `tableParams`。告警数量改为增量合并（`mergeCounts` 只保留当前列表仍显示的规则），追加页的并发结果不会被更早的全量结果抹掉；失败仍显示“状态未知”而不是 0。
- 删除确认：删除动作由卡片菜单直接 emit，确认交给页面 `Modal.confirm`（复用 `DeviceAlarm.confirm.delete`），保持卡片为无副作用展示组件。
- 明确不做：不改右侧告警记录栏及其分页、不改接口契约、不新增后端能力、不改 `ui/`。
- 与截图的有意差异：搜索占位仍为语义正确的 `DeviceAlarm.workspace.keywordSearch`（“搜索产品、设备或属性标识”），未照搬原型里属于视觉告警页的“搜索建筑、楼层或区域”；状态文案沿用既有 `告警中 {count}`，未改成原型的“告警 N”；摘要沿用 `ruleSummary` 真实内容而非原型里的产品名。
- 验证：`node scripts/test-alarm-workspace.mjs` 8 项通过；`pnpm run build:modules device-manager-ui` 通过（仅既有资源路径/chunk 体积警告）。另用与 `DeviceAlarmRuleCard.vue`、`StatusTag/index.vue` 逐行同源的 CSS 在 340px 侧栏宽度渲染静态 fixture 并用 Chrome 截图，核对标题、搜索、卡片、选中态、标签、⋮ 与底部新增按钮的位置与配色。
- 未验证：无登录环境，未做真实数据下的滚动加载、删除确认、增量数量合并联调；模块级 `vue-tsc` 仍受既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断。

## 规则关键词搜索

交付入口：[前端 PR #275](https://github.com/jetlinks-v2/device-manager-ui/pull/275)。

- 左侧保留 a-input-search，提示“搜索产品、设备或属性标识”，不再显示字段/运算符/条件标签。沿用视觉告警搜索控件和当前标题布局，右侧继续使用 ConditionFilter。
- `hooks/useDeviceAlarmRuleSearch.ts` 区分输入草稿与已提交文本，回车/搜索提交，清空恢复全部规则，重复提交相同值不重复请求；提交时规则分页回到第一页，不改变已选规则或右侧搜索。
- `hooks/useDeviceAlarmRuleSearch.ts` 将一个关键词组合成三项 OR 条件：`templateId/product-info` 内的产品 `name like`、`thingId/dev-instance` 内的设备 `name like`、`property like`。`hooks/useDeviceAlarmPage.ts` 保持整个搜索组与附加条件隔离，继续使用现有分页接口 `POST /message/preprocessor/device-alarm/_query`；不发送虚拟 keyword，不新增后端条件或数据库专用查询。
- 复用共享 escapeLikeValue 对百分号和反斜杠的转义，补充下划线字面匹配，不重复编码。范围沿用原筛选器的产品名称、设备名称、属性标识；配置 JSON 中的告警名称与通知文本不属于该搜索范围。后端保留通用查询与既有资产权限，只需发布 runtime-ui。
- 验证：更新后的 `node scripts/test-alarm-workspace.mjs` 8项测试与 `pnpm run build:modules device-manager-ui` 通过；真实前端 hook 输出交由既有 product-info/dev-instance/like 查询组件执行，独立 PostgreSQL 11 临时库10项断言通过，覆盖三字段、中文与通配符、空查询、附加条件隔离、count/list与分页。未使用已撤回的后端关键词类。
- 搜索框与按钮结构未改，复用此前浏览器 fixture 的300/260px宽度、长输入、回车、清空、标题按钮同排与无脚本错误验证。完整登录页面联调仍待执行。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍被既有 Certificate/type.d.ts:2:30 的TS1005阻断；未修改该文件。当前模块无统一lint脚本，diff --check通过。未新增页面组件或跨模块抽象，改动Vue文件不足300行；已有大型useDeviceAlarmPage仅替换搜索职责并抽出独立hook，未扩展其他业务。

## 规则栏局部修复（已确认实施）

- 目标：修复点击编辑时新增按钮触发加载动画的问题；标题与新增按钮同排；移除左侧搜索与规则列表之间的“全部规则”按钮。
- 范围与入口：仅 runtime-ui/modules/device-manager-ui/views/device/alarm/index.vue 及 hooks/useDeviceAlarmWorkspace.ts；用户已确认实施，沿用当前规则筛选与记录处置工作台。
- 根因与修复：index.vue 的新增按钮原使用共享 busy 作为 loading，而编辑、删除、保存同样调用 run 切换 busy。现在 create() 复用 run 的操作互斥，新增加载状态 creating 仅在新增动作期间开启，并在 finally 中复位；其他动作期间新增按钮禁用但不显示加载动画。加号改用按钮 icon 插槽，加载时由组件替换图标。
- 布局：告警规则标题、现有数量与“新增告警”同排；下一行为关键词搜索框，随后直接展示规则卡片。参考 runtime-ui/modules/jetlinks-ai-ui/views/visual-alarm-preview/components/VisualAlarmCategorySidebar.vue 的标题/操作排列，复用现有 Ant Design 按钮、AIcon 及 DeviceAlarm.action.create 文案；不引入视觉告警业务逻辑。
  ```text
  告警规则 共 N 条     [+ 新增告警] | 告警记录
  [筛选规则                   ] | [记录搜索]
  [规则卡片                   ] | 查询范围 [已选规则 ×]
  ```
- 保持紧凑规则卡、状态与等级位置、原编辑弹窗及双栏布局；不改 ui、后端、接口、权限和时长计算。
- 实现：已分离新增加载状态并保留重复点击保护；标题、数量和按钮同排，数量过长时省略并保留 title；已删除左侧全部入口及废弃样式。未新增组件或跨模块抽象，模板无新增复杂业务逻辑，状态隔离原因已在 hook 注释。
- 验证：node scripts/test-alarm-workspace.mjs 的 7 项测试通过，包括规则范围切换保留记录搜索。另用真实 useDeviceAlarmWorkspace 与 Vue renderer、模拟页面异步依赖核验：编辑/删除/保存不触发 creating，新增期间重复点击和其他操作被拦截，失败后 busy/creating 均复位。git diff --check 通过；index.vue 共149行；按钮复用键的中英文解析正常。
- 构建：runtime-ui 下 pnpm run build:modules device-manager-ui 通过；存在资源路径与 chunk 体积等已有警告。
- 验证限制：pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json 被既有 views/link/Certificate/type.d.ts:2:30 的 TS1005 阻断；模块暂无统一 lint 脚本。未进行登录页面的浏览器验证，仍需核验真实页面编辑前后按钮位置、标题/按钮同排与窄屏无溢出，以及关闭右侧规则标签后返回全部记录。

## 已确认方案与实施边界
用户已确认最新 HTML 原型并授权生产实现。本次为 runtime-ui 单模块页面改造，入口仍为 /alarms/rules/iot，componentCode 为 device/alarm。

采用规则筛选与记录处置工作台：
```
告警规则 数量 新增  | 告警记录
规则搜索           | 记录独立搜索 / 当前规则范围 / 返回全部
名称 状态数量 等级  | 名称 等级 状态
产品设备阈值摘要…   | 设备 / 最近告警时间 / 持续时长 / 原因
编辑 删除          | 告警处理 / 告警日志 / 处理记录
规则分页           | 记录分页
```

- 默认查询全部设备属性预处理告警；点击规则按稳定 alarmConfigId 过滤。两边搜索、分页彼此独立，规则搜索不自动选中首条或清除右侧范围。
- 左侧摘要合并产品、设备范围和实际区间内/外条件，单行省略，Tooltip全文；状态及数量在等级左侧。数量来自当前页规则的服务端 COUNT 聚合，失败显示未知，不能把失败当成0。
- 右侧宽屏双列卡片，记录区域不超过760px时单列，状态优先，无统计面板与彩色侧条。独立 ConditionFilter，过滤字段只使用真实记录字段。
- 编辑梯度：规则新增/编辑沿用原720px弹窗与34.75rem表单，条件配置需要完整校验；记录处理就近打开说明弹窗，直接填写并确认。历史按recordId分页，在弹窗展示。
- 处理后重新查询服务端记录和规则数量；不乐观删除记录，normal状态仍保留历史。切换查询与弹窗时作竞态保护。
- 不新增后端接口，不改ui，不增加启停、还原配置、批量、视频或AI。历史快照不能用当前规则覆盖。

## 分解与复用
- index.vue：页面组合及两栏布局；DeviceAlarmRuleCard.vue：紧凑规则摘要；新增 DeviceAlarmRecordCard.vue：复用 EntityCard / StatusTag / AIcon / j-ellipsis 展示卡片。
- hooks/useDeviceAlarmWorkspace.ts：规则选择、分页加载、当前页状态汇总；保留 useDeviceAlarmPage.ts 的查询构造和完整编辑逻辑。
- hooks/useDeviceAlarmHistory.ts：仅记录历史查询；新增 hooks/useDeviceAlarmRecords.ts：记录独立筛选与分页；新增 hooks/useDeviceAlarmHandling.ts：表单提交状态；新增 DeviceAlarmHandleModal.vue：无请求的表单展示。
- workspaceApi.ts / workspaceTypes.ts / workspaceUtils.ts：接口、真实字段和展示转换；中英文文案与菜单权限在本模块维护。
- 核验了 jetlinks-web-core 的 EntityCard、SelectableListCard、StatusTag 导出与实现，复用 EntityCard 插槽组合。规则卡继续现有独立选择按钮，避免把嵌套操作放进整块键盘点击的 SelectableListCard。
- 目录已有 components、hooks、API/types 的职责边界，继续归入这些目录，不新增跨模块深引用。

## 接口与权限
- POST /message/preprocessor/device-alarm/_query：规则搜索，保留产品/设备/属性字段。
- POST /alarm/record/device/_query：固定 alarmConfigSource=device-property-preprocessor，可选 alarmConfigId，服务端分页。
- POST /alarm/record/device/_aggregation：仅当前页规则ID、warning状态，按alarmConfigId分组COUNT。
- POST /alarm/history/alarm-record/{recordId}/_query：告警日志。
- POST /alarm/record/{recordId}/handle-history/_query：处理记录。
- POST /alarm/record/device/_handle：复用 handlePreconditioning，参数 alarmRecordId / alarmConfigId / alarmTime / describe / type=user / state=normal。2.12控制器此方法为SaveAction，需要alarm-record:save；在使用此页面的菜单中补充该既有权限。
- GET /alarm/config/default/level：原等级配置。EnumDict显示text，业务比较value；normal不等同本地虚构handled状态。

## 验证范围
接口契约测试覆盖来源与规则范围、搜索隔离、按记录处理、历史分页隔离、聚合COUNT、空ID与错误响应、过期请求；结合模块构建、针对性类型检查、diff --check、真实Vue组件fixture浏览器检查。全模块vue-tsc被views/link/Certificate/type.d.ts既有语法错误阻断。登录环境联调仍需验证真实权限和数据；原型截图不充当生产验证。

## 本次验证结果

- `node scripts/test-alarm-workspace.mjs`：7项通过，覆盖真实ConditionFilter查询构造、单次通配符编码、规则范围、默认全部、按记录处理与历史路由、聚合数量及失败处理、过期响应。
- `pnpm run build:modules device-manager-ui`：最终构建通过；存在已有资源路径、Rollup output.input、CSS注释和chunk体积警告。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`：仍被既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断。告警目录定向vue-tsc中本目录无诊断；依赖展开仍有共享代码类型错误，未宣称全模块类型检查通过。
- 本模块没有统一lint脚本；`git diff --check`通过。所有新增/修改Vue组件不超过300行。现有大型useDeviceAlarmPage仅修正搜索接收逻辑，不进行无关重构。
- 浏览器使用真实index.vue、规则卡、EntityCard记录卡、处理弹窗、历史组件、原编辑弹窗和FullPage，业务接口由fixture替代：默认全部、规则选择、摘要Tooltip、必填说明、按记录处理、处理历史隔离、编辑720px、1920/1327/390px视口与无脚本错误检查通过。
- 额外装配真实ConditionFilter并用浏览器操作搜索：右侧名称查询、与规则范围AND组合、返回全部仍保留搜索，左侧产品搜索不触发右侧请求、通配符只转换一次、桌面与窄屏搜索输入与操作按钮不重叠，均通过。
- 搜索兼容修正：ConditionFilter.change.filter/terms已是服务端条件，右侧直接使用filter；左侧继续从modelValue原始条件构造查询，不再重复转义like通配符。左侧只按容器压缩输入最小宽度并使用简短提示，复用原搜索组件而不改共享源码。
- 仍待登录环境联调：菜单权限同步（两处device/alarm入口均增加alarm-record:save）、真实资产可见性、处理后再次触发、规则删除后的历史、多设备同规则、大数据分页。未调用真实处理接口；此前403不通过前端绕过。

## 记录卡片视觉调整
按用户最新截图改为宽屏双列、窄栏单列；卡片顶部名称与等级、右上状态角标，主体按设备/原因/告警时间/时长纵向排列，底部保留三个真实操作。复用EntityCard、StatusTag与本模块设备图标；只改展示布局，不改变查询、处理与历史接口。验证双列对齐、长文案、状态角标、单列降级和原操作。

卡片调整验证：模块构建通过，diff --check通过；真实Vue组件在1920/1327宽度双列、900/390宽度单列，状态角标对齐、字段顺序、无横向溢出检查通过。告警处理/历史隔离/编辑弹窗等既有浏览器回归通过，无脚本错误。未新增行为测试，沿用既有功能回归。
本次定向类型检查：告警目录无诊断，依赖共享代码仍有既有类型错误；全模块检查限制同上。
