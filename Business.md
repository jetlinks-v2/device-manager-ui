# 物联业务说明

本文件用于记录 `iot-ui` 的业务边界与页面入口说明。当前模块以设备运营为主，覆盖设备总览、设备分组、设备列表、设备详情和设备健康分析。

## 最近变更

### 设备批量页接入算法配置（已实施）

- 目标：在设备列表的“批量操作”页中，在现有“插件配置”右侧增加“算法配置”，由 `jetlinks-ai-ui` 注册完整算法中心工作区。
- 影响范围与 owning module：`device-manager-ui` 只调整 `views/device/list/unified/BatchPage.vue` 的扩展页签承载契约；算法页签注册、业务内容、文案和草稿保护由 `jetlinks-ai-ui` 负责。
- 方案档案：沿用“多对象对比页”的高密度矩阵工作区；批量页只增加同级分段入口，不改算法中心的筛选、矩阵、参数面板和保存流程。页签通过现有 `device-list-batch:tabs` 注册表动态装配，以 `menuCode` 复用原页面菜单授权，并缓存已打开工作区以保留未提交草稿。
- 不做：不改 `edge-master-ui`、`jetlinks-web-core`、后端接口、请求体、响应体和依赖锁文件；不将设备列表当前勾选或查询条件转换为算法中心的摄像头范围。
- 实现入口：`views/device/list/unified/BatchPage.vue` 同时识别注册项声明的按钮权限与 `menuCode` 菜单所有权；动态页签组件通过 `KeepAlive + code key` 保留已打开工作区状态。算法模块以 `order=20` 注册，继续排在现有 `order=10` 的插件配置右侧。
- 验证：`pnpm run build:modules device-manager-ui` 通过（9568 个模块）；`git diff --check` 通过，目标 Vue 文件 52 行。完整模块 `vue-tsc` 被既有 `views/link/Certificate/type.d.ts:2` 语法错误提前阻断，本次批量页已由模块构建完成编译验证；未自动发起浏览器交互验证。

### 通用智能体设备分析能力 canonical activation（已实施）

- 目标：让设备分析能力在 `loadAll` 和按当前路由 / 菜单加载时使用同一 canonical activation 语义，避免 legacy loader 只在全局预加载路径稳定生效。
- 影响范围与 owning module：仅 `device-manager-ui/register.ts` 及对应 loader contract test；复用现有 `AgentCapabilityProviderResource` 和 `IOT_DEVICE_MENU_ANCHORS` 的 `path/menuCode`，不改变设备分析工具定义、声明或调用参数。
- 不做：不修改或同步 `runtime-ui`，不增加工具、兼容双轨、场景判断或后端审计例外；`device_property_aggregate` 的 `contract.protocol.forbidden` 若仍出现，只按后端审计返回的精确 `path` 定位陈旧/变形 wire，不放宽 `ToolContractAudit`。
- 实现与验证：legacy function loader 已替换为唯一 `AgentCapabilityProviderResource`，直接复用现有设备菜单 anchors 生成 path/menuCode activation，不保留双轨注册。生产文件最终 SHA-256 为 `90ebf38383d3296e11483d99f2dd0edb765f750d4c6422716f73f402501632f0`；`pnpm --dir jetlinks-web-core test:client-tool-preparation` 6/6 通过，覆盖 canonical path/menu activation、无关路由不激活和 legacy resource 拒绝；主线最小合入后的 `git diff --check` 通过。工具声明、aggregate wire、`runtime-ui` 和后端审计均未修改。

### 通用智能体设备定位与详情交接契约优化（已实施）

- 目标：让“按名称/ID定位设备 -> 使用真实设备 ID继续读取或打开详情 -> 用户确认后导航”的链路完全由 typed
  producer/consumer、结构化业务回执和权威执行结果驱动，禁止模型猜设备 ID，也不把“已同意”当成“已打开”。
- 影响范围与 owning module：`agentCapabilities/deviceAnalysis/tools.ts`、`deviceQuery.service.ts`、
  `deviceNavigation.service.ts`、相关中英文文案和定向工具测试；共享 prepare/confirm/execute、structured navigation 和确认状态机
  由 `ui/jetlinks-web-core`、`ui/modules/jetlinks-ai-agent-ui` owning。后端 FLAT 工具声明投影单独修复，不在本模块兜底。
- 不做：不针对 `JT808`、固定设备、工具 ID、模型或页面写特判；不新增不受支持的查询条件；不改变 AssetsHolder 权限、
  设备详情路由、设备趋势或 presentation 契约；不让 `device_search` 自动跳转、预写 handoff 或输出模型提示词。
- 实施步骤：
  1. 将执行上必须依赖设备/属性标识的 canonical consumer 改为 `required=true + sourcePolicy=EITHER`；显式 ID 仍可直接满足，
     模糊名称必须先由 `device_search` 的 `device-id` lookup 提供事实来源。
  2. 保持 `device_search` 为纯 READ：复用现有 `like$ignoreCase` 查询，返回设备 records、cardinality、唯一 subject 和 structured
     navigation；移除查询阶段的 `prepareDeviceDetailHandoff`、手工 Markdown 链接、`replyPolicy` 和 `instruction`。
  3. `device_open_detail` 采用共享 typed prepare：确认前按设备 ID和当前权限读取真实设备并生成名称/目标页摘要；确认后重校验、
     保存一次性 handoff（仅 `handoff=true`）并导航，成功返回 navigation state-change receipt，失败返回 typed failure。
  4. 搜索零命中、多候选、无效/无权限 ID和 handoff 不可用分别返回结构化状态；模型只能在成功回执后声称已打开详情。
- 风险与兼容：`required=true` 表达逻辑输入必需，不等于强制先调用 producer；`EITHER` 保留用户直接提供真实 ID的路径。
  搜索不再提前写 handoff 后，只有确认执行或用户点击受控详情入口才建立后续设备助手上下文，避免陈旧和未消费记录。
- 验证：`device-manager-ui` 工具契约 20/20 通过，覆盖大小写模糊查询、单/多/零候选、显式与 typed lookup ID、
  确认前目标解析、拒绝和确认后重校验；中英文 JSON 校验和 `device-manager-ui` 窄构建通过（9388 modules）。
  9101 应用内浏览器的新会话仍停留在后端“正在处理平台数据”且未发出客户端确认，待后端/模型轮次恢复后补验真实导航与助手续接。

### 设备模糊查找查询契约统一（已实施）

- 目标：设备查找工具按设备 ID、设备名称、产品名称、厂商和型号进行包含匹配时忽略大小写，保证 `jt808` 能发现
  `JT808`；同时移除设备实例表不支持的 `identifier` 查询条件，避免无效字段让整组 OR 条件失真。
- 影响范围与 owning module：仅修改 `device-manager-ui` 的设备查询 term 构造、通用智能体设备查找、设备首页旧查找工具、
  设备详情 selector 和定向契约测试；后端继续使用 EasyORM `like$ignoreCase` 标准 option 和现有 AssetsHolder 权限注入。
- 不做：不为 `JT808` 或固定产品写特判；不改变设备 ID 的存储、唯一性和精确 `eq` 语义；不新增 PostgreSQL 方言 SQL，
  不把凭证表 `dev_device_principal.identifier` 伪装成设备实例字段，也不改变普通页面的精确筛选口径。
- 实施入口：在 `api/deviceQueryTerms.ts` 建立唯一的设备关键词 OR term 构造器，所有设备查找入口复用
  `like$ignoreCase`；`api/device.ts` 只负责规范化通配符和兼容既有顶层关键词入口，不再递归扩展已经成组的条件。
- 风险与验证：定向契约测试覆盖大小写变体、混合大小写、通配符归一化、支持字段集合、无 `identifier`、嵌套条件
  不重复扩展和精确 `eq` 不变，1/1 通过；既有设备智能体工具测试 20/20 通过；`device-manager-ui` 窄构建通过
  （9388 modules）。本机解析到的 EasyORM `4.2.2-SNAPSHOT` 已验证包含 `ignoreCase` option 和 PostgreSQL `ILIKE`
  方言实现。完整 `vue-tsc` 在处理本次文件前被既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断；本次触达文件已通过
  Vite/Esbuild 编译。`%keyword%` 仍属于包含查询，大数据量下的索引优化由数据库规模评估决定，本次不引入方言专属索引。

### 设备时序图表跨日标签统一（已实施）

- 目标：让所有设备时序图在跨午夜或跨年时保留必要的日历上下文，避免仅显示 `HH:mm` 导致时间点歧义。
- 影响范围与 owning module：`device-manager-ui` 的趋势数据归一化、设备工作台、设备详情消息图和属性趋势图；不修改 dashboard 指标口径、工具 ID、后端时间戳或通用智能体 presentation 协议。
- 不做：不按“24 小时”或某个设备场景增加特判，不用固定 `00:00...24:00` 或 `1...7` 伪造时间轴；排序和 tooltip 继续使用真实时间戳。
- 实施入口：在 `api/deviceTrend.ts` 统一根据实际日历跨度与 bucket 粒度选择标签格式；所有图表只消费该格式化结果，缺失时间保留为空而不编造日期。设备详情概览的空数据回退不再补齐 24 个当天小时桶，统计卡片 tooltip 复用真实桶标签。
- 验证：定向契约测试覆盖同日、跨午夜、跨年、日/月 bucket、无效时间值和真实时间戳排序；`device-manager-ui` 窄构建通过。
  同模块审计确认告警趋势、数据能力、CPU/JVM 和属性历史图已保留日期上下文；物联卡流量图、网络监控图的小时级分支同步移除日期裁剪，避免同类问题再次出现。

### 设备趋势查询范围与汇总真实性（已实施）

- 目标：修正设备在线率、消息量 dashboard 趋势被前端静态 `accessProvider` allowlist 过滤成零值的问题；
  趋势默认使用后端资产权限边界，仅传递用户明确选择的分组、空间和时间范围，保证图表与 `messageTotal` claim 来自同一份真实数据。
- 影响范围与 owning module：`device-manager-ui` 的 `api/deviceGroup.ts`、设备趋势查询构建契约、定向测试和本说明；
  不修改通用智能体终答、presentation renderer 或 dashboard 后端指标定义。
- 不做：不隐藏真实的零值汇总，不按设备、工具、模型、时间范围或接入方式写特判；不把设备列表的产品筛选条件机械翻译成历史指标条件。
- 实施入口：`api/deviceTrend.ts` 统一构建 dashboard 查询并归一化趋势点；移除默认 `accessProvider` allowlist；保留显式
  `groupId` / `spaceId` 与时间窗口；缺失或非有限测量不再转成 0，真实零值仍参与趋势和总量汇总。
- 风险与验证：默认全局趋势与 dashboard 的授权设备范围一致，不再与设备列表的展示型 provider 排除规则强耦合。
  定向契约测试通过，覆盖默认无 provider allowlist、显式分组/空间范围、真实零值、缺失/null/非数字桶和空结果；
  `device-manager-ui` 窄构建通过（8115 个模块），完整模块 typecheck 仍被工作区既有 948 条错误阻塞，本次触达文件过滤错误为 0。
  本地 AI 工作台新会话实测生成两张 24 点图表，消息图数据求和与 `消息总量: 22191` 完全一致；刷新后文本、两张图表、顺序和总量保持不变。

### 设备指标时序输出契约迁移（已实施）

- 目标：让设备在线率和消息量时序按通用 typed field contract 明确区分时间值、显示标签和度量值，
  使后端 canonical presentation compiler 生成一条连续曲线，不再把每个时间标签当成独立系列。
- 影响范围与 owning module：仅修改 `agentCapabilities/deviceAnalysis/tools.ts` 的 renderer-neutral output declaration 和相关契约测试；
  通用字段角色和分系列策略分别由 `ui/jetlinks-web-core` 与 `modules/jetlinks-ai-agent` owning。
- 不做：不修改 dashboard API、指标数值、时间粒度、工具 ID、shape 或图表组件；不在公共层加设备、在线率、24h
  或字段名特判。
- 实施入口：`timestamp` 声明为时间轴，格式化的 `label` 声明为行级显示标签，`value` 保留
  measure/unit/aggregation；两类时序都声明按 `timestamp asc` 的 producer-guaranteed ordering；数值字段通过模块 i18n
  提供完整用户展示名，canonical unit 只保留为机器语义，不再向图表泄漏 `count`、`percent` 等内部标识。
- 验证：后端 canonical presentation 定向矩阵 87 个测试通过，其中 `PresentationCompilerTest` 12 个测试通过；
  中英文指标展示名契约测试、设备趋势 scope 契约测试、`jetlinks-web-core` client-tool contract 59 个测试和
  client-tool typecheck 通过；`device-manager-ui` 窄构建通过（8115 个模块）；四个 owning worktree 的
  `git diff --check` 均通过。父 UI catalog 测试直接由 Node 启动时仍受工作区 `@jetlinks-web-core/*` alias 无法解析阻塞，
  相关字段断言已更新且已由窄构建覆盖编译。
- 2026-08-05 本地 AI 工作台的双趋势、单在线率趋势新会话均在 presentation 生成前被既有终答一致性校验停止；
  未再展示错误的多 series 图表，但也未能完成运行态 canonical option 验收。待该独立问题解除且服务加载本次代码后，需复验
  一条 series、全部时间点和无单系列图例。
- 2026-08-24 字段元数据收敛：在线率的业务标签保持无单位文本（`在线率` / `Online rate`），百分比语义只由
  `format: percent` 和 `unit: percent` 声明；状态统计与趋势因此共享同一 typed measure contract。健康摘要保留
  `lastSeen` 作为展示标签，并声明映射记录中已有的 `lastSeenTimestamp` 为 `timestamp` /
  `temporal_dimension` / `epoch-millis`，由通用 presentation 层格式化，不解析或猜测显示字符串的时区。

### 设备告警自定义通知内容（已实现）

- 目标：在设备告警编辑弹窗的通知配置中支持“平台默认内容 / 自定义内容”切换；自定义内容只作用于当前设备、当前属性的告警配置，并作为统一 `${message}` 发送给站内信及已选通知渠道。
- 影响范围与 owning module：仅修改 `ui/modules/iot-ui`，主要入口为 `views/device/alarm/components/DeviceAlarmNotificationConfig.vue`、`views/device/alarm/components/DeviceAlarmMessageTemplateConfig.vue`、`views/device/alarm/utils.ts` 以及中英文语言资源；设备详情告警配置与告警配置管理页继续复用同一编辑器。后端 `device-manager` 已支持 `parameters.template.message` 渲染，本次不新增接口、数据库字段或发送链路。
- 不做：不修改通知中心平台模板；不为邮件标题、短信模板编码或不同渠道分别建立设备级模板；不改变告警触发、首次告警判断和通知对象/渠道选择规则；不调整页面壳层、列表或详情信息架构。
- 实现入口：通知配置在设备级告警下提供内容模式切换，支持 `targetName`、`alarmConfigName`、`propertyName`、`propertyValue`、`level`、`alarmTime` 变量的光标位置插入与示例预览。自定义内容保存到 `parameters.template.message`；切回默认时仅移除根消息模板字段，保留各通道的 `templateId`、`notifierId` 等参数。两个保存入口都校验自定义内容不为空且最长 1024 字符。
- 风险与兼容：存量配置没有 `parameters.template.message` 时继续使用后端默认消息；平台外部渠道模板必须引用 `${message}` 才能展示设备级内容；设备级配置优先于产品级配置，编辑产品继承项时仍按现有逻辑生成设备级覆盖。
- 验证：中英文 JSON 语法校验通过；基于真实 `buildPreprocessPayload` 的静态请求校验已确认自定义内容保存/回显、切回默认和通道参数保留；使用 Node 22 执行 `pnpm --filter jetlinks-web-core build -- --module-name iot-ui` 通过（7911 个模块，退出码 0）。新增消息编辑组件 148 行，复用的通知配置组件 188 行；`IotDeviceAlarmConfigTab.vue` 与 `useDeviceAlarmPage.ts` 为已有超 300 行文件，本次仅窄范围接入校验并清理未接通的模板通道残留。实际外发联调仍需确认平台邮件等模板已引用 `${message}`。
- 交付：commit `a34049e6fb626b01c2b4fe6d048d302a833f3f8c`；Pull Request `https://github.com/jetlinks-v2/cloud.jetlinks.ui/pull/318`。

### 设备分组侧栏统计口径修正

- 目标：修正设备分组页左侧底部统计口径；“共 X 个分组”不把“全部区域”这类总览节点计入已建分组，“覆盖 X 台设备”在区域视图固定展示“全部区域”的设备总数，父节点统计包含子节点设备数量。
- 影响范围：`ui/modules/iot-ui/views/device/groups/components/useIotDeviceGroupsPage.ts`
- 实现入口：区域分组数量直接取 `areaSettings.areas` 的真实区域节点数；底部覆盖数在区域视图优先复用 `ALL_AREA_GROUP_ID` 的 summary 结果，业务分组视图仍沿用当前选中业务分组的汇总值；`未绑区域` 节点数量按“项目设备总数 - 全部区域设备数”派生，不再使用 mock 列表长度或单独的未绑区域 summary 返回值。设备分组页区域视图设备基数改为直接调用真实 `queryRuntimeDevices_api`，不再经过 `iotDeviceService.getGroups()` 的 mock fallback。概览里的“核心状态分布”优先复用当前分组真实 summary，展示在线、离线、禁用；禁用优先读取 `notActive`，旧 summary 未返回时按“设备总数 - 在线 - 离线”兜底。
- 验证：新增 `ui/tests/unit/iotDeviceGroupsPage.utils.spec.ts` 覆盖在线 5、离线 0、禁用 1 的统计口径；`vue-tsc -p modules/iot-ui/tsconfig.json --noEmit` 当前仍被仓库既有类型问题阻塞，本次改动文件在该输出中未命中错误。

### 设备日志时间筛选确认行为

- 目标：对齐设备日志页的筛选字段与接口参数，移除无效的方向筛选，并统一时间、内容字段命名。
- 影响范围：`ui/modules/iot-ui/views/device/list/components/device-detail/IotDeviceLogsSearchTableTab.vue`
- 实现入口：筛选项移除 `direction`，时间字段改为 `timestamp`，内容字段改为 `content`，同时同步调整筛选占位文案。
- 验证：本轮完成静态代码检查，运行时页面联调待执行。

### 设备日志方向筛选

- 目标：在设备日志列表增加方向筛选，并与列表中的方向展示保持同一套解析口径。
- 实现入口：方向筛选使用虚拟 `direction` 字段，选择后按 `DeviceLogType` 的上行/下行类型集合转换为 `type in (...)` 查询条件；列表方向优先按日志类型集合判断，未知或本地兜底日志继续使用内容关键词解析。
- 验证：完成静态类型检查、差异检查和 UTF-8 无 BOM 检查；运行时页面联调待执行。
