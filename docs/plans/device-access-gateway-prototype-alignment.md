# 运行时设备接入网关原型对齐

状态：已按原型重做新增、编辑交互，并完成逐类型回归。兼容边界是保存数据及成功/失败回传语义；操作顺序、步骤跳转、配置展示和概览按原型调整。浏览器证据已更新为使用原生弹窗 footer 的逐类型结果，并补充全部同类配置说明移至右侧、概览长文档和窄屏溢出验证。

卡片只读详情已按确认方案改为 880px 弹窗，复合网关在同一弹窗内按原配置顺序展开各子接入及协议表格。全部 24 类受控浏览器详情、33 个详情契约场景及宽窄屏检查通过；9200 页面恢复后，真实 HTTP/MQTT/GB/复合详情及真实 390px 只读冒烟已补验通过。详情、新增和编辑的 header 均沿用项目默认样式。

## 实施范围与步骤

- 目标与范围：仅 `runtime-ui/modules/device-manager-ui` 的新增、编辑及本轮确认的卡片只读详情；列表布局、删除、后端和 API 不变。
- 接入方式选择按原型每行两项，右侧使用「接入」按钮；移除上轮自行增加的搜索提示，调整弹窗宽度、标题与接入方式标签。
- 普通类型先填写基础配置，再选择网络/协议或插件；Agent 保留原型的网络在前，复合网关保留先添加子接入。左侧步骤与概览的「去配置／去修改」均可切换，常规配置底部固定「取消／确定」，重选位于左下角。
- 中间候选改为原型的单列卡片，右侧按基础配置、网络组件、消息协议等分卡展示；补全说明、业务标识、地址和协议说明。真实平台/SIP/插件动态字段继续绑定原表单，不能用原型静态数据替换业务字段。
- 将界面步骤编排与保存处理分离；确定时补齐原各步骤的必填、选择、SIP配置归一化等前置处理，继续调用原保存函数。返回任一步不得清空草稿或重置插件动态值。
- 验证：逐类型重新操作新增/编辑及特殊变体；与固定基线比较最终保存数据、请求和回传；检查缺项时定位到对应步骤、概览跳转、两列接入、窄屏、构建/类型增量/样式。GB快捷创建既有异常仍单独记录。
- 布局补充：配置弹窗由 1080px 加宽至 1200px；根据最终确认，中间配置区占剩余宽度，右侧概览固定为 20.5rem。所有底部操作统一放入 `a-modal` 的 `footer` 插槽；原生提交表单显式关联 footer 按钮，保持原校验和保存数据。配置概览中的空字段统一显示「未配置」，不写入表单和保存参数。验证覆盖普通、原生表单及复合子编辑的 footer、窄屏与保存契约。
- 概览溢出：限制概览及卡片的最小宽度，长字段自动换行；协议代码块保留缩进并自动换行，文档表格在自身容器内横向滚动，Topic/URL 表格使用 Ant Design 的 scroll 配置（600px 表格宽度、320px 最大内容高度），保留原文和完整列数据。验证真实长文档、表格横向滚动、概览纵向滚动及窄屏边界。
- 数采说明位置：新增通过 `components/Channel/index.vue`、编辑通过 `components/Edge/geteway.vue` 展示；两处「配置说明与协议文档」均通过现有 `GatewayFrame` 的 `summary` 插槽放入右侧概览，中间只保留表单。沿用原说明内容、折叠组件、表单、类型分发和保存处理；共享 Channel 视图的历史 Modbus/OPC UA 同步采用该说明位置。此项为 S 级展示修正，验证新增/编辑的位置、展开阅读、原生提交、历史类型和保存契约。
- 同类说明统一：固定地址视频、Onvif、GB28181、OneNet 新旧版、Ctwing、边缘网关/子设备和复合网关的说明也统一移入右侧 `summary` 插槽，保留原文本、图片、动态展示值和按步骤显示的条件；长文案和说明表格适配右侧宽度。网络类型现有右侧协议文档继续复用。仅调整模板插槽和说明样式，不修改脚本、表单、业务 hook、API 或提交数据；验证位置、展开、步骤切换和受影响的新增/编辑保存，并在真实 OneNet 页面核对桌面与窄屏。
- 复合子网关编辑限制：`gatewayEditorContext.ts` 的内部草稿显式记录 `mode`，`Composite/useCompositeEditor.ts` 从新增/卡片编辑入口分别设置 `create`/`edit`；`useGatewayChildContext.ts` 仅在新增时开放重选按钮和动作。模式只用于界面上下文，不按父网关是否保存或子项 ID 推断，不进入草稿回传或保存参数。共用模板、header、校验和保存逻辑保持原实现。
- 复合新增空态：仅调整 `Composite/index.vue` 与所属样式，改用已有 `CloudEmpty` 描述插槽和原新增按钮；无子网关时不挂载 480px 列表滚动容器，移除该视图遗留的 600px 最小高度与顶部留白。保留有数据列表滚动、搜索无结果空态、权限、添加/校验与保存逻辑，验证空态宽窄屏无多余滚动、添加入口及有子项编辑展示。
- 接入方式图片恢复：`components/Provider/index.vue` 复用原 `data.ts` 的 `BackMap` 图片映射，替换文字徽标，保持两列布局和「接入」按钮；仅改展示，选择事件及全部保存处理不变。验证全部类型的图片加载、MQTT 图片效果及接入跳转，并执行单文件样式和构建/类型增量检查。

## 目标与范围

- 对齐原型 https://jetlinks-ai-new.ez7268-453.workers.dev/midhub/ops/component/gateway 的新增/编辑弹窗、分组接入选择、步骤导航、配置区、只读概览和卡片详情弹窗。
- Owning module：`runtime-ui/modules/device-manager-ui`；M 级；仅迁移本任务界面改动，运行时原有 locale 等独立差异均保留。
- 列表布局、删除、启停、权限、后端、API 请求与保存语义不改。列表仅保留新增/编辑返回刷新接线。

## 详情弹窗改造（已确认并实现）

### 原型与当前事实

- 已通过浏览器查看原型 HTTP、MQTT、插件、GB28181 和复合网关详情，并在真实 9200 页面打开 HTTP 与复合网关抽屉，仅执行读取与关闭。
- 原型为 880px、内容区可滚动、无底部操作的只读弹窗。标题依次展示名称、接入方式标签和状态；基础配置包含名称、接入方式、唯一业务标识、创建时间、说明。正文按类型展示网络组件、消息协议/认证说明/路由表、插件信息或 SIP 信令配置。
- 原型复合网关先展示父网关基础配置，再按配置顺序直接展示「1. 接入方式 + 通道名称」「2. 接入方式 + 通道名称」等完整分区。每项显示通道配置及其协议表格，全部位于同一弹窗内。
- 改造前卡片入口为 `views/link/AccessConfig/index.vue` 的 `handleEye`，详情壳为 `Outline/index.vue` 的 700px `a-drawer`；正文分发到 `Outline/components/FirstKind.vue` 至 `SeventhKind.vue`。普通类型缺少统一基础配置和标题状态；协议说明未展示。
- 改造前复合类型 `SeventhKind.vue` 查询 `getCompositeProviderDetail(configuration.gateways)` 后渲染子卡片，再递归打开 `Outline`。`components/Composite/index.vue` 也复用 `Outline` 预览未保存子配置，因此详情不能假设所有输入都有独立网关 ID。

### 方案与边界

1. **目标与 owning module**：仅 `runtime-ui/modules/device-manager-ui` 的只读详情；采用已明确要求的「对象详情弹窗」。首屏为对象名称、接入方式/状态与基础配置，后续纵向分区阅读；沿用 Ant Design Vue 与当前模块样式 token。继续从卡片点击进入、关闭回原列表，不新增编辑/启停/删除动作。
2. **壳层和字段**：`Outline/index.vue` 改为居中的 880px `a-modal`，窄屏自适应；保留原关闭回调和列表上下文，隐藏 footer。按原型使用标题标签、状态、分区标题及只读字段，空配置显示「未配置」，保留 0/false；长字段、Markdown 与路由表保留全文并在自身区域处理溢出。按用户补充要求，详情与新增/编辑弹窗均移除局部 header 背景、边框和间距覆盖，沿用项目默认 header；本次仅删除样式覆盖，标题内容、正文布局和保存处理保持一致。
3. **各类型内容**：继续使用真实 provider、网关详情、网络/协议、插件元数据和 SIP 配置。补齐基础信息；网络展示名称/地址/说明，协议展示真实名称/说明/文档及后端路由表，插件、云平台、Agent、GB28181、数采/历史通道、边缘类型沿用各自真实配置。原型中的固定示例或缺少真实数据来源的表格不进入产品。
4. **复合网关**：`outlineSections.ts` 按 `configuration.gateways` 原顺序展开子接入分区，显示序号、接入方式、通道名称及网络/插件和协议等配置；原 `SeventhKind.vue` 的递归子卡片展示已由统一只读模型替代。复用普通类型的字段/协议展示，补全响应即使顺序不同也不会改变配置顺序。复合子项及编辑中的草稿直接使用已有配置和资源查询，不调用不存在的子网关详情 ID，也不修改草稿。
5. **实现边界**：在 `Outline` 内将受影响的数据加载、派生字段及异步状态整理到 composable，展示组件只接收数据；复用已有 `a-modal`、项目层 `ContentPanel`/`KvGrid`、Ant Design 表格/状态组件和 `JMarkdown`。必要文案沿用中英文 locale。API 文件、创建/更新参数、业务保存 hooks、校验、列表布局/筛选/分页、删除/启停、权限及后端均不修改。
6. **风险处理**：覆盖无 ID 子配置、缺失/失效网络或协议、空子项、共享/独立 SIP、插件动态值，以及关闭/重新打开时过期请求和错误回退；失败或空数据不伪造成功配置。详情只使用原有查询端点，不调用创建、更新、启停或删除端点。
7. **验证**：逐类型覆盖全部 24 类详情及复合内嵌预览；重点验证多子项/混合网络与插件/无 ID 草稿、顺序、各子项协议不串数据、一次只出现一个详情弹窗、关闭保留列表状态、配置不被修改。核对真实 9200 页面、880px 桌面与 390px 窄屏、长文档/路由表，执行样式、构建与类型增量检查。创建/更新逻辑及相关依赖指纹不变时复用现有 132 个保存契约证据，存在实际影响时只补受影响的回归。最终结果回填本节及既有 `tests/gateway/browser-results.json`。

### 实现与验证

- `Outline/index.vue` 仅承载弹窗与加载/错误/重试；`loadOutline.ts` 只使用原查询 API，区分顶层实体、复合子配置和草稿，按本次打开缓存重复资源请求。`useGatewayOutline.ts` 负责派生状态并在关闭/切换对象后丢弃过期响应。
- `outlineSections.ts` 统一基础、网络、协议、插件动态字段、云平台及 SIP 共享/独立配置；`OutlineSection.vue` 复用 `ContentPanel` 和 `KvGrid`，`OutlineProtocol.vue` 展示真实 Markdown 和 Topic/URL 路由。复合项只显示各自路由表，认证 Markdown 保留在普通详情中；连续分组才合并行。原七个只读类型组件已被替代并移除。
- 24 类详情均通过受控浏览器验证：880px、一个详情弹窗、无 drawer/footer、真实字段/空值、关闭后列表状态保留、错误与写入均为 0。另覆盖 GB 独立配置、空复合、缺网络/协议、网络/实体/子项补全失败后重试共 7 个变体，以及复合编辑中的无 ID 子配置预览。MQTT/HTTP/插件混合复合网关的三个子项顺序、资源与协议隔离均通过。
- `node tests/gateway/outline-contract.cjs` 通过 24 类、33 个场景；深冻结原配置检验只读，覆盖 0/false/数组、共享/独立 SIP、无 ID 草稿、失败重试及关闭/切换后的过期响应。HTTP 边界允许原有 POST 查询端点，拒绝保存、启停和删除。
- 受控浏览器使用真实 Markdown：桌面内容区宽/滚动宽均为 817px，820 字符代码块均为 809px；390×844 下文档宽/滚动宽均为 390px，弹窗均为 358px、内容区与代码块均为 295px。表格在自身 295px 区域承载 720px 内容，实测横向滚动 425px；临时 viewport 已恢复。证据与截图索引追加到原 JSON 的 `outlineModal` 项，原 52 个保存场景及 14 个特殊项完整保留。
- 保存兼容：与改造前 64 个非 Outline 文件快照比对，仅 Composite 模板追加 `draft` 及两个 locale 各追加 20 个 key；Composite script 逐字一致、旧 locale 值完整保留，其余 61 个业务文件指纹一致。API、校验、保存 hooks 和相关依赖未变，复用原 132 个保存契约证据，未重建基线。
- 构建通过（2m18s、exit 0），4 个实际改动 Vue 文件样式检查及 `git diff --check` 通过。模块类型检查 exit 2，当前 1829 条存量诊断；相比此前 1838 条无新增，减少的 9 条全部来自已移除的旧 SeventhKind。没有抑制诊断。
- 真实 9200：首次收尾时曾因页面重载后空白而中断，页面恢复后已补验真实 HTTP/MQTT/GB28181/复合详情，无加载警告；真实网络、协议 Markdown、URL 表格、SIP 共享配置和复合两个子项均正确展示。390×844 下文档宽/滚动宽均为 390px、弹窗均为 358px、内容区均为 299px，保留两个子项；viewport 已恢复，未保存真实记录。
- 复合空态修正：使用现有 `CloudEmpty` 的 description/default 插槽，保留原提示及同一新增按钮；无子项时不挂载空列表滚动容器，所属 Less 移除 600px 最小高度与 20px 顶部留白。真实 1280×720 页面修正前外层可视高 547px、内容高 948px，其中空滚动容器占 480px；修正后空态可视高/内容高均为 448px，列表滚动容器为 0。1533×899 和390×844下同样均为448px，页面宽度无溢出。空态下一步拦截、添加/返回、已有两个子网关编辑列表及原480px列表滚动均正常，默认 header 保留，真实写入为0，viewport已恢复。真实 SFC 脚本/模板与两个样式块编译、两文件样式检查和 diff 检查通过；脚本与保存相关文件指纹不变，复用既有保存契约及未受影响的构建/类型证据，未重复执行全模块检查。证据追加至 `compositeCloudEmpty`。
- 复合子项重选限制：16 个真实 hook/操作入口场景通过，覆盖父网关新增/编辑、网络/插件、有 ID/临时 ID/无 ID 子项；已有子项隐藏并拦截重选，新增继续开放，取消保留原项，确定原样回传数据。受影响的复合新增/编辑及失败响应共 4 个保存契约与固定基线一致，未重建基线；API、网络/插件保存 hook 和草稿回传 hook 与本轮修改前字节一致。受控浏览器验证已有网络子项取消/确定、新建复合内插件添加后再编辑、网络新增重选，以及无 ID 的 MQTT/HTTP/插件编辑；子项确定时写入为 0，父网关最终 POST/PATCH 各 1 次，插件 0/false 正常回显。真实 `sy_复合` 的 WS 子项无重选按钮，footer 仅取消/确定；默认 header 渐变与 `24px 24px 0px` 间距保留，仅查看并取消，未保存。类型检查 `pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` exit 2，1829 条存量诊断，与上轮按文件/诊断码/消息比较无新增或减少；三处修改已由真实 Vite 页面和契约编译加载，`git diff --check` 通过。未改模板、样式或构建配置，复用此前全模块构建与样式检查结果；模块无独立 lint 脚本，本轮未宣称全量类型或 lint 通过。证据追加至 `compositeChildReselectRestriction`。
- header 恢复：仅删除 `Outline/index.vue` 与 `Detail/index.vue` 两处局部覆盖。真实详情、新增和编辑的 header 均为项目默认 118deg 渐变，padding 为 24px 24px 0px，底边框为 0；标题内容与正文布局保留。两文件样式检查与 `git diff --check` 通过；模板、脚本和 API 不变，复用已有保存/详情契约及构建/类型证据。新证据追加到 `gatewayDefaultHeader`，原逐类型保存/详情记录保留。

## 实际实现与关键落点

1. 运行时网关原业务源码与此前 ui 基线一致；使用运行时固定提交 `53aa23bacb20f550f11383609417ad04e1b224a3` 重新生成 132 个保存契约基线，未沿用运营端的测试结果作为运行时结论。
2. `index.ts`、`views/link/AccessConfig/GatewayWorkspace.vue`：主列表和原详情 URL 使用同一局部宿主，详情以弹窗承载。sourceId/provider/save 外部入口不加载背景列表；普通返回仅调用原列表的 reload。列表文件只增加注释和 defineExpose 两行，原模板字节一致。
3. `Detail/index.vue`、`Detail/useGatewayDetail.ts`、`gatewayEditorContext.ts`：保留 provider 加载、编辑回显、产品绑定检查、类型分发和原 URL/query 语义；增加弹窗取消、重选上下文和 footer 宿主注入。`GatewayFrame.vue`、复合子接入选择页通过 Teleport 将原操作渲染到 `a-modal` 的 `footer` 插槽。取消不调用成功回传。
4. `components/Provider/index.vue`：真实 providers 分组、原型排序与原 `BackMap` 接入方式图片（80×80、等比显示）；桌面每行两项，右侧「接入」按钮。选择弹窗宽 920px、居中且内容滚动；配置弹窗宽 1200px，中间配置占剩余宽度、右侧概览为 20.5rem。弹窗 header 沿用项目默认渐变与间距，不添加局部覆盖。新增中英文文案沿用原模块扁平 key，保留所有已有资源文本及格式。
5. `GatewayFrame.vue`、`GatewayOverview.vue`、`useGatewayWizard.ts` 及类型 wizard：复用运行时布局组件，实现原型的步骤切换、中间配置、分卡概览和弹窗底部「取消／确定」。常规网络为基础配置→网络组件→消息协议，插件为基础配置→插件选择，GB 为基础配置→信令配置；Agent 为网络组件→基础配置。所有表单保持挂载，左侧步骤及概览「去配置／去修改」直接切换。确定时依次验证真实表单并定位缺项，再调用原保存函数。空字段仅在概览显示「未配置」，保留 0/false；GB 地址缺项同样仅做展示处理。
6. `components/{Network,Plugin,Cloud,Media,Channel,Edge,Composite}/use*Editor.ts`：从原 SFC 抽取原保存参数构建、API 调用和回传处理。调整协议说明及插件元数据加载时机，避免自由导航依赖旧的下一步；插件元数据随选择加载并在提交前等待，切换步骤不重置 0/false。GB 提交前继续执行原信令归一化。保存兼容以固定基线契约为证据，不将已改变的完整导航控制器描述为 AST 一致。
7. 长模板按已有步骤和说明拆出 `OneNetServiceForm`、`Gb28181SignalForm`、`Gb28181ClusterForm` 及各类型 Guide。子视图共享原 refs，未复制表单状态；所有新增/实质改造的新增编辑 Vue 文件小于 300 行。既有列表仍超过 300 行，因为本次只接线，不重构列表。
8. `Channel/index.vue`、`Media/Onvif.vue`、`Media/index.vue`、`Edge/geteway.vue` 的原生表单均通过显式 `id`/`form` 关联 footer 中的提交按钮，保留原 `@finish` 和校验。Edge 的表单仍位于原基础配置步骤，网络搜索回车不提交。GB 独立配置字段采用响应式列，窄屏概览排列在表单下方。
9. `Composite/GatewayChildEditor.vue`、`useGatewayChildContext.ts`、`useGatewaySaveBack.ts`：复合网关先显示空态，在当前弹窗内选择、配置及编辑子接入；使用 Vue Router 的局部上下文与注入式草稿回传复用原网络、插件保存分支，不新开标签、不写后端。父基础信息第二步整体保存，保留最多 10 个及空子项拦截。
10. `GatewayOverview.vue`、`Network/NetworkGuide1.vue`：概览、卡片和字段值限制最小宽度，长字段及协议代码保留完整内容并换行；Markdown 表格独立横向滚动，Topic/URL 表格使用 `scroll: { x: 600, y: 320 }`。概览自身只纵向滚动，不改变协议文档、列定义或数据。
11. `Channel/index.vue`、`Edge/geteway.vue`：数采新增通过 channel 分发、编辑通过 provider 对应组件分发，两处说明均使用 `#summary` 放入右侧概览。只调整插槽位置，原说明文本、分发逻辑、表单绑定、校验和保存处理保持不变；共用 Channel 的历史 Modbus TCP/OPC UA 采用相同位置。
12. `Media/{index,Onvif,GB28181}.vue`、`Cloud/{OneNet,Ctwing}.vue`、`Edge/index.vue`、`Composite/index.vue`：所有同类说明使用 `#summary` 放入右侧。云平台保留基础/网络步骤对应说明，协议步骤不显示；GB 保留基础步骤说明；边缘网关保留基础步骤及子设备原显示条件，复合网关保留子接入数量概览。`GatewayGuide.vue` 统一约束说明宽度、长文案/代码/徽标换行及表格容器，移除 GB 说明的固定高度以适配右侧滚动。上述 8 个 Vue 文件脚本与本轮修改前逐字一致，24 个业务逻辑/API 文件指纹一致。

13. `Outline/{index.vue,loadOutline.ts,useGatewayOutline.ts,outlineSections.ts}` 及两个展示组件：统一只读详情模型，替代旧七类组件；弹窗按原型展示基础和类型分区，复合子项直接展开。`Composite/index.vue` 只为预览追加 `draft`；无保存脚本变化。

## 保存兼容边界

- API 文件 `api/link/accessConfig.ts` 无 diff；新增仍为 `POST /gateway/device`，编辑仍为 `PATCH /gateway/device`。
- 保留 name、description、bizKey、i18nMessages、provider、protocol、channel、channelId、transport、configuration、原编辑合并字段，以及未传/空字符串/0/false/空数组的区别。概览展示字段不进入提交参数。
- 网络类型映射、存量选中项、协议锁定、产品绑定、插件动态配置、Agent HTTP/MQTT 推导、GB 共享/独立配置、历史类型和复合子项限制均沿用原流程。
- 复合子配置继续移除 bizKey 并只回传；父配置才整体保存。sourceId、save、provider、data、type、view 及新增哨兵 `:id` 保留。
- 未修改后端、共享 hook、全局路由、权限、运行时 core、列表呈现、删除或启停。

## 验证结果

| 验证 | 结果和边界 |
| --- | --- |
| 保存契约 | 最新 `2.20`（`bdb0c5f1`）交付复核：24 类型、132 个用例通过；真实业务 hooks 和 API 在 Vue 生命周期中运行，使用真实 Ant Design Vue Form.useForm，对实际序列化 method/URL/body、次数、回调和返回顺序与固定保存基线逐项比较。包含失败响应和特殊配置分支 |
| 浏览器逐类型 | footer 改造后重新完成 52 个不同正常保存场景，覆盖 22 种现有新增入口、全部 24 种编辑，以及 Agent HTTP/MQTT 和 GB 共享/独立变体；逐项确认提交按钮位于 `.ant-modal-footer`、原生 form 关联正确、仅一次正确请求及返回后列表状态保留。请求证据位于 `tests/gateway/browser-results.json` |
| 数采说明位置 | 补测数采新增/编辑和历史 Modbus TCP/OPC UA 编辑共 4 个受控浏览器场景：中间说明数量为 0，右侧为 1；展开可阅读完整内容，无横向溢出，footer 表单关联正确，POST/PATCH 正常，数采新增空名称仍阻止写入。真实 9200 仅展开阅读、不保存：桌面概览宽/滚动宽均为 315px，说明均为 291px；390×844 下文档宽/滚动宽均为 390px，概览均为 292px、说明均为 268px，footer 可见，临时 viewport 已恢复。证据追加到同一 JSON 的 `collectorGuideRight` 特殊项 |
| 全部同类说明位置 | 12 类、24 个受控新增/编辑保存场景通过，包含 GB 共享/独立及历史类型编辑；86 次位置/展开/步骤检查确认所有说明均在右侧，中间无残留，无横向溢出；原生 form/footer 关联、POST/PATCH 单次请求及列表状态保留正常，复合子配置回传草稿时后端写入为 0。真实 OneNet 新版基础/网络说明在右侧正确切换，桌面概览宽/滚动宽均为 315px、说明均为 291px，可纵向滚动；390×844 下文档宽/滚动宽均为 390px、概览均为 297px、说明均为 273px，footer 可见，viewport 已恢复，真实后端写入为 0。证据追加到 `allGuidesRight`，原 52 个正常场景保留 |
| 接入方式图片恢复 | 原 24 个 provider 图片映射及资源文件完整；真实 9200 当前返回的 20 个可选类型均加载原图（80×80），文字徽标为 0，桌面每行两项，卡片滚动区宽/滚动宽均为 861px，右侧仍为「接入」按钮。MQTT 点击可进入配置，取消正常关闭，未提交真实保存。业务逻辑/API 共 24 个文件指纹与本轮修改前一致，复用既有 132 个保存契约证据，未重复执行。证据追加到 `providerOriginalImages` |
| 特殊交互 | 基础/网络/协议缺项定位及零写入、概览修改跳转与草稿保留、原生空名称、插件 0/false 和步骤切换、失败不关闭/不回传、绑定产品协议锁定、取消及重选、复合空子项、内嵌子配置取消/重选/新增/编辑零写入均已验证 |
| 真实 9200 页面 | 已核对真实运行时新增弹窗、服务端网络/协议候选、编辑名称回显、协议禁用、文档展开和取消返回。真实长协议在 1200px 弹窗中配置区 624px、概览 328px；概览滚动区宽/滚动宽均为 315px，卡片均为 289px，长代码均为 265px。Topic 表格在自身 253px 可视区内展示 600px 内容，实测可横向滚动 347px，表头同步、概览不横向移动。未点击真实保存或修改真实后端记录 |
| 窄屏 | 实际 9200 页面在 390×844 下无横向溢出（文档宽/滚动宽均为 390px）；配置区底部和概览顶部均约为 656.47px，无重叠。概览宽/滚动宽均为 297px，长代码均为 247px；footer 和取消/确定均在可视区内（footer 底部约为 809.44px）；临时 viewport 已恢复 |
| 样式 | 交付复核借用已有 `ui/scripts/check-ui-style.mjs` 只读检查当前 40 个变更 Vue/Less 文件，全部通过；没有修改共享脚本或依赖。工作区和模块未配置独立 lint 脚本 |
| 构建 | 最新 `2.20` 交付复核失败（52.51 秒，11,601 个模块完成转换）：未改动的 `views/link/RuntimeMonitor/nodeBufferOverview.ts` 引用当前 `jetlinks-web-core/src/components/RuntimeDiagnostics/index.ts` 未导出的 `createBufferHistoryProjection`。此前网关改造阶段的 2m18s 构建通过仅为历史证据；当前整模块需先对齐该共享导出再重跑构建 |
| 类型检查 | 最新基线 `bdb0c5f1` 为 1869 条，当前为 1850 条。使用仓库外的基线源码副本、同一依赖与相邻模块检查；归一化路径、行列号，并将 GB28181／网络／插件拆分文件映射回原组件后，无新增诊断，减少 19 条。完整类型检查仍未通过，未用 ignore 或大范围断言抑制错误 |
| 详情弹窗 | 交付复核：24 类、33 个只读详情契约场景通过。复用 `tests/gateway/browser-results.json` 提供的 24 类受控浏览器、7 个变体及草稿预览、宽窄屏和真实页面只读冒烟记录，本次交付未重跑浏览器。复合顺序、资源与协议隔离、无 ID 草稿、零写入、重试、缺失资源及过期响应均由当前自动回归覆盖 |
| 静态边界 | API 无 diff、列表模板字节一致、新增/实质改造的新增编辑 Vue 文件均不超过 300 行、`git diff --check` 通过；ui 误改目录状态已恢复干净 |

### 逐类型矩阵

“契约通过”包含新增、编辑、失败响应与原实现一致；浏览器保存使用真实业务组件和受控 HTTP 边界，不代表真实设备已联调。

| 类型 | provider | 浏览器新增 | 浏览器编辑 | 保存契约 | 详情（受控浏览器） |
| --- | --- | --- | --- | --- | --- |
| MQTT 服务 | `mqtt-server-gateway` | 通过 | 通过 | 通过 | 通过 |
| MQTT 客户端 | `mqtt-client-gateway` | 通过 | 通过 | 通过 | 通过 |
| WebSocket | `websocket-server` | 通过 | 通过 | 通过 | 通过 |
| CoAP | `coap-server-gateway` | 通过 | 通过 | 通过 | 通过 |
| TCP | `tcp-server-gateway` | 通过 | 通过 | 通过 | 通过 |
| UDP | `udp-device-gateway` | 通过 | 通过 | 通过 | 通过 |
| HTTP | `http-server-gateway` | 通过 | 通过 | 通过 | 通过 |
| 网关子设备 | `child-device` | 通过 | 通过 | 通过 | 通过 |
| Agent 设备 | `agent-device-gateway` | HTTP/MQTT 通过 | HTTP/MQTT 通过 | 通过 | 通过 |
| Agent 视频 | `agent-media-device-gateway` | HTTP/MQTT 通过 | HTTP/MQTT 通过 | 通过 | 通过 |
| 插件 | `plugin_gateway` | 通过 | 通过 | 通过 | 通过 |
| 视频插件 | `media-plugin` | 通过 | 通过 | 通过 | 通过 |
| 固定地址视频 | `fixed-media` | 通过 | 通过 | 通过 | 通过 |
| Onvif | `onvif` | 通过 | 通过 | 通过 | 通过 |
| GB28181 | `gb28181-2016` | 共享/独立通过 | 共享/独立通过 | 普通保存通过；快捷创建见既有异常 | 通过 |
| OneNet 旧版 | `OneNet` | 通过 | 通过 | 通过 | 通过 |
| OneNet 新版 | `OneNet-platform` | 通过 | 通过 | 通过 | 通过 |
| Ctwing | `Ctwing` | 通过 | 通过 | 通过 | 通过 |
| 数采 | `collector-gateway` | 通过 | 通过 | 通过 | 通过 |
| Modbus TCP（历史） | `modbus-tcp` | 原无入口，组件测试通过 | 通过 | 通过 | 通过 |
| OPC UA（历史） | `opc-ua` | 原无入口，组件测试通过 | 通过 | 通过 | 通过 |
| 边缘网关 | `official-edge-gateway` | 通过 | 通过 | 通过 | 通过 |
| 边缘子设备 | `edge-child-device` | 通过 | 通过 | 通过 | 通过 |
| 复合网关 | `composite-device-gateway` | 通过 | 通过 | 通过 | 通过 |

### 可重复验证入口

从聚合工作区根目录运行：

```sh
node runtime-ui/modules/device-manager-ui/tests/gateway/save-contract.cjs
node runtime-ui/modules/device-manager-ui/tests/gateway/known-defects.cjs
node runtime-ui/modules/device-manager-ui/tests/gateway/outline-contract.cjs
pnpm -C runtime-ui exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json
pnpm -C runtime-ui -F jetlinks-web-core build -- --module-name device-manager-ui
pnpm -C runtime-ui exec vite --config modules/device-manager-ui/tests/gateway/browser/vite.config.mjs
```

浏览器验证页为 `http://127.0.0.1:9310/`；具体 fixture 参数与边界见 `tests/gateway/README.md`。样式门禁从 runtime-ui 目录运行 `node ../ui/scripts/check-ui-style.mjs --files <37 个实际改动样式文件>`。两边 package.json 均未提供本次可用的独立 lint 脚本，样式/构建不能描述为 lint 通过。

## 既有问题与剩余验证边界

- `Media/useGb28181Editor.ts` 中原 `route.query.save` 快捷创建成功分支仍调用 `onBack(rsp)`，局部响应变量实际为 resp。`known-defects.cjs` 已在运行时改造前后分别复现 `rsp is not defined`。该路径可能已创建后端记录但没有成功回传，未计入正常通过用例；普通新增/编辑通过。本次按保持保存逻辑的范围，不夹带修复。
- 保存契约测试的模板 validate 使用受控替身，浏览器另验证真实表单事件。HTTP、菜单、跨标签 hooks 及轻量表格承载采用 fixture。真实跨标签消息、真实分页/筛选保留、权限拒绝态、资源新建后回选及完整英文页面仍需运行时环境验证。
- 实际 9200 的冒烟只读取真实数据、打开/取消表单；未对真实后端写入。真实网络、协议、插件、媒体和设备联调未执行，不能由受控请求等价推断完成。
- 真实详情只读冒烟已在页面恢复后补验 HTTP/MQTT/GB28181/复合与390px；没有修改真实服务配置或重启服务，真实设备联调仍不在该只读验证结论内。
- 交付采用 `codex/device-access-gateway-2.20` 分支，PR 目标为 `2.20`；上述 `53aa23ba` 固定提交仅标识保存对照基线。当前阻塞项是整模块共享导出不匹配、既有类型诊断及 GB28181 快捷创建异常，不能据此宣称完整构建或全部分支正常。
