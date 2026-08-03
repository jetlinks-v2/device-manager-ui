# 设备健康左侧树 Figma 样式对齐

## 设备健康右侧详情卡片化计划（待确认）

### 当前目标

按 Figma `jetlinks clode Copy` 的设备健康详情节点重组右侧单设备详情区：顶部摘要、基本信息、健康分析、健康分趋势、异常事件和关联告警均为独立单层卡片；原先显示健康分的内容迁入“健康分析”卡片，不新增或改变健康评分、趋势、事件、告警的数据口径。

### 影响范围与 owning module

- Owning module：`ui/modules/iot-ui`
- 页面组合与栅格：`ui/modules/iot-ui/views/device/health/components/IotHealthDetailPanel.vue`
- 顶部摘要、基本信息、健康维度、趋势、异常事件和关联告警：同目录现有 `IotHealthDetailHero.vue`、`IotHealthInfoGrid.vue`、`IotHealthDimensionList.vue`、`IotHealthTrendChart.vue`、`IotHealthEventList.vue`、`IotHealthAlarmList.vue`
- 可能新增一个只承载“健康分析”布局的局部组件；不引入共享组件或第三方依赖。

### 交互方案档案

- `solutionName`：主从详情工作区（左侧健康树定位设备，右侧持续查看单设备健康详情）
- `primaryFilterSurface`：左侧现有设备名称 / ID 搜索；不新增页面级筛选
- `contentSurface`：右侧响应式单层分区卡片，桌面端基本信息与健康分析并列，趋势与异常事件并列，关联告警独占整行
- `detailCarrier`：`IotHealthDetailPanel`
- `editMode`：只读健康监控；不增加设备基础信息编辑入口
- `coreComponents`：保留现有 `CloudEmpty`、`AIcon`、图表与状态样式能力；不假设未核实的 `jetlinks-web-core` API
- `actionPlacement`：不新增动作；事件、告警保留现有行内信息承载
- `densityTarget`：每个分区字段或条目不超过现有数据量；段内不嵌套子卡片，桌面首屏优先展示顶部、基本信息和健康分析
- `sidebarMode`：沿用既有深层健康状态树，不改侧栏
- `confirmationMode`：M 级页面信息架构调整，待确认后实施
- `rejectedAlternatives`：不改为监控感知页（当前对象不是全局态势）、分析钻取页（无新增维度下钻），也不移除左侧树改为独立对象详情页
- `searchShellDecision`：不引入 `ConditionFilter` 或 `ProSearch`；没有新增通用筛选场景

### 明确不做

- 不修改左侧树、设备选择、路由、接口调用、健康分计算、趋势计算、事件和告警数据组装。
- 不修改 `runtime-ui/`、设备列表或其他运营端模块。
- 不引入 Figma 临时图片资源、Tailwind、手写 mock 数据或未验证的共享组件 API。

### 实施步骤

1. 将现有右侧详情区收敛为 Figma 对应的顶部摘要卡，并保持设备名称、健康状态、连接状态和元信息来源不变。
2. 以现有组件为数据展示基础，重组为“基本信息 + 健康分析”“健康分趋势 + 异常事件”“关联告警”三组卡片布局；健康分与维度列表合并到健康分析卡片。
3. 对趋势、事件和告警的空态、溢出与窄屏单栏进行适配，保持 i18n 文案与已有 `CloudEmpty` 机制。
4. 执行类型检查、变更文件行数检查和浏览器桌面 / 窄屏回归，并回填本节验证结果。

### 风险与待确认点

- 当前健康分及趋势来自页面现有派生逻辑；本次仅移动展示位置，不把 Figma 示例数值固化到页面。
- Figma 的关联告警为空态采用静态插画。为避免引入临时资产，拟保留工作区现有 `CloudEmpty` 的统一空态语义。
- 当前页面已具备左侧树和右侧详情的稳定交互，改动将限制在右侧组件树与样式，不改变数据与选择状态。

### 验证方式

- 执行 `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`，区分既有错误与本次影响。
- 执行 `git diff --check -- modules/iot-ui/views/device/health`，并检查新增或改动的 Vue 文件不超过 300 行。
- 在 `http://localhost:9102/ht_device/#/iot-user/device/health` 的桌面与窄屏视口对照 Figma，验证卡片顺序、健康分迁移、趋势 / 事件 / 告警内容与设备切换联动。

### 实施与验证结果

已完成：

- `IotHealthDetailPanel.vue`：右侧改为顶部摘要卡、“基本信息 + 健康分析”、“健康分趋势 + 异常事件”和“关联告警”的响应式单层卡片编排；窄右栏按容器宽度切换单列。
- `IotHealthDetailHero.vue`：移除健康分展示，仅保留设备名称、健康与连接状态、产品、标识、接入方式和最近上报时间。
- `IotHealthAnalysisCard.vue`：新增健康分析分区，复用现有健康分与四项维度数据，不改变评分或趋势计算。
- `IotHealthAnalysisCard.vue`、`IotHealthDimensionList.vue`：健康分析图表更新为 Figma 对应的外圈刻度、按四项权重分段的彩色环和端点圆标；链路、数据、时延、供电在图表与紧凑维度列表中固定使用 `#1E72F0`、`#1593FF`、`#11C6B7`、`#FAA12D`，不改变评分、权重或趋势数据。
- `IotHealthDetailPanel.vue`、`IotHealthTrendChart.vue`：趋势卡列宽与健康分析一致；趋势图按 Figma 改为 `0-100` 分段、浅灰虚线网格、青色平滑面积线与实线悬浮指示器。既有阈值线数值和行为保持不变。
- `IotHealthInfoGrid.vue`、`IotHealthDimensionList.vue`、`IotHealthDetailSection.vue`：分别调整为标签-值密集信息、分析卡紧凑维度列表和独立分区卡片；极窄右栏时维度辅助信息自动换行。
- `locales/lang/zh.json`、`locales/lang/en.json`：补充“健康分析”和“健康得分”的双语文案。
- `locales/lang/zh.json`、`locales/lang/en.json`：补充趋势图单位和健康分数图例文案。

验证结果：

- `git diff --check -- modules/iot-ui/views/device/health modules/iot-ui/locales/lang/zh.json modules/iot-ui/locales/lang/en.json`：通过。
- 双语 locale JSON 解析：通过；新增或改动的 Vue 文件均不超过 300 行。
- `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过，错误来自既有的 `jetlinks-web-core`、设备列表和场景联动等模块；健康页本次改动文件未出现在检查输出中。
- 健康分析图表静态检查：`git diff --check -- modules/iot-ui/views/device/health` 通过；`IotHealthAnalysisCard.vue`（248 行）和 `IotHealthDimensionList.vue`（236 行）均未超过 300 行。再次执行 `vue-tsc` 时仍受工作区既有错误阻断，健康页仅报告未改动的 `useIotDeviceHealthPage.ts` 中 `IotEvent.timestamp` 字段类型不匹配；本次两个组件未出现诊断。
- 健康分趋势静态检查：趋势卡已与健康分析采用相同的 `1.2fr` 宽度；`git diff --check` 和双语 locale JSON 解析通过，`IotHealthTrendChart.vue`（177 行）及 `IotHealthDetailPanel.vue`（172 行）均未超过 300 行。`vue-tsc` 过滤结果仅保留未改动 `useIotDeviceHealthPage.ts` 的两处 `IotEvent.timestamp` 类型错误，趋势图组件与详情栅格未出现诊断。
- 趋势图运行时修复：当前 ECharts 版本不能将 CSS 新式 `rgb(... / ...)` 渐变色解析为动画所需的 RGBA 数组，会触发 `interpolate1DArray` 的 `undefined.length` 错误；已改为兼容的 `rgba(...)` 色值并关闭配置切换动画，保留曲线、渐变、tooltip 与数据口径不变。
- 趋势图浏览器回归：重新加载 `http://localhost:9102/ht_device/#/iot-user/device/health` 后，趋势图正常渲染；控制台在重载后未记录新的错误。
- 浏览器桌面回归：确认五个目标卡片均已渲染，切换到“主机房地板下水浸 01”后顶部设备名和全部卡片同步更新。
- 待复验风险：本地浏览器策略在最终窄屏回归时阻止继续访问 `localhost:9102`。需在可访问该地址的环境下以 `390px` 宽度确认右侧详情容器无横向滚动，重点检查健康分析的维度辅助信息换行。


## 当前目标

按 Figma `jetlinks clode Copy` 的 Sidebar 节点 `4698:6026` 还原设备健康页左侧设备健康树，仅调整视觉呈现，不改变设备搜索、展开、选中和详情联动行为。

## 影响范围与 owning module

- Owning module：`ui/modules/iot-ui`
- 页面组合：`ui/modules/iot-ui/views/device/health/components/IotDeviceHealthView.vue`
- 左侧树容器与 Ant Tree 覆盖样式：`ui/modules/iot-ui/views/device/health/components/IotHealthTree.vue`
- 树节点标题、状态图标和计数：`ui/modules/iot-ui/views/device/health/components/IotHealthTreeTitle.vue`

## 交互方案档案

- `solutionName`：主从详情工作区（保持既有左侧设备定位、右侧单设备健康详情）
- `primaryFilterSurface`：左侧单行设备名称 / ID 搜索，保持现有过滤逻辑
- `contentSurface`：Ant Design Vue `a-tree`，保持现有展开与选中事件
- `detailCarrier`：右侧 `IotHealthDetailPanel`，不修改
- `editMode`：只读健康监控，不新增编辑入口
- `coreComponents`：`a-input-search`、`a-tree`、`j-ellipsis`、现有 `AIcon`
- `actionPlacement`：设备选择仍在树节点行内
- `densityTarget`：`240px` 宽度、`16px` 容器内边距、约 `36px` 树节点行高
- `sidebarMode`：深层健康状态树；选中节点采用 Figma 的 2px 主色短条、弱底和主色文字
- `confirmationMode`：Figma 已指定唯一视觉方案；按仓库 M 级任务门禁等待实施确认
- `rejectedAlternatives`：不改为卡片台账、筛选工作台、监控总览或新的侧栏组件
- `searchShellDecision`：不引入 `ConditionFilter`；现有树内单字段搜索是确定的局部过滤能力

## 明确不做

- 不修改右侧详情、健康分计算、设备数据接口、树数据层级、搜索匹配规则、选中 / 展开逻辑或国际化文案。
- 不修改 `runtime-ui/`、设备列表或其他运营端页面。
- 不引入新的共享组件、设计资源或硬编码的用户可见文本。

## 实施步骤

1. 将树容器、标题区和搜索框的尺寸、描边、圆角、间距映射到 Figma 节点；保留现有主题变量作为色彩来源。
2. 移除 Figma 未包含的连接线、设备图标与状态圆点、数字胶囊、底部平均健康分，并保留状态分类图标、名称截断和右对齐数值。
3. 将选中态收敛为 2px 左侧主色短条、弱底和主色文字；异常、关注和健康仅通过图标与右侧文本色表达状态。
4. 在桌面与窄屏验证搜索、展开、选中详情联动、长名称截断和滚动，无重叠或横向溢出。

## 风险与待确认点

- Figma 不展示当前底部的平均健康分；为严格还原节点，本次拟移除该展示，但不会删除健康分计算或树 `summary` 中仍用于标题总数的数据。
- Figma 中设备叶子项不显示当前的磁盘图标和状态圆点；本次拟移除其视觉元素，但保留父节点状态图标与现有语义信息。
- `a-tree` 内部 DOM 样式依赖当前 Ant Design Vue 版本，深层样式将限制在 `.iot-health-tree` 作用域。

## 验证方式

- 执行 `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`，记录与本次文件有关的结果。
- 执行目标文件 `git diff --check`。
- 在 `http://localhost:9102/ht_device/#/iot-user/device/health` 的桌面与窄屏视口对照 Figma：容器尺寸、搜索框、层级缩进、选中态、异常 / 关注 / 健康图标、长名称截断及搜索 / 详情联动。

## 实施与验证结果

已完成：

- `IotDeviceHealthView.vue`：将左侧承载宽度从 `19.25rem` 收敛为 Figma 节点对应的 `15rem`（`240px`）。
- `IotHealthTree.vue`：移除底部平均健康分与树连接线；按设计调整容器、标题、搜索框、行高与层级缩进；默认仅展开“全部设备”，搜索时展开匹配路径；选中态改为 2px 蓝色短条、`#E2EDFF` 弱底和 `#1E72F0` 标题色。
- `IotHealthTreeTitle.vue`：移除叶子设备图标、状态圆点和数字胶囊，保留分类状态图标、名称截断与右侧纯文本计数。

验证结果：

- `git diff --check -- modules/iot-ui/views/device/health/...`：通过。
- 浏览器桌面回归：在 `http://localhost:9102/ht_device/#/iot-user/device/health` 确认左栏为 `240px`、仅“全部设备”默认展开、选中项唯一、搜索图标在输入框左侧，且选中态颜色与 Figma 节点一致。
- 搜索回归：输入“主机房”后，仅保留匹配设备及其异常归类路径；清空输入后恢复初始树展示。
- `npx vue-tsc --noEmit -p modules/iot-ui/tsconfig.json --pretty false`：未通过，输出为 `jetlinks-web-core`、设备列表和场景联动等既有类型问题；本次三个设备健康组件未出现在错误输出中，页面热更新与浏览器交互正常。
- 窄屏回归：`390px` 视口下左侧树可收缩、文本保持截断且无组件内重叠；全局运营端导航壳使文档宽度为 `479px`，保留既有横向溢出，不在本次左侧树样式任务中修改全局布局。
