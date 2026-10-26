# 集群仪表盘与独立运行诊断

## 当前结论与目标

### 火焰图阅读与诊断导出（已实现并完成集中检查）

目标：大量样本 / 深调用栈仍能迅速辨认热点、阅读调用路径并保存诊断证据。Owning module 为 core `RuntimeDiagnostics/FlameGraphViewer.vue`、`flameGraph.ts`、`flameGraphHtml.ts` 与宿主 `diagnostics/useJvmDiagnostics.ts`，沿用现有 JFR 样本、权限与主题。本阶段不改变采样口径，不将样本占比表示为精确 CPU 耗时，不增加监控历史持久化或服务端 PDF 服务。

已确认现状：布局按调用路径聚合，宽度为包含样本；筛选仅将不匹配帧降到 0.22 透明度，不压缩调用路径。现有图内已有 overflow:auto 和固定层高，但系统浮动滚动条不可发现，没有显式缩放；帧优先显示完整包名，窄帧存在文本外溢风险。当前 HTML 已冻结并内嵌样本，支持离线交互；尚无 PDF 导出。图二体现的是更紧凑的短方法名、库调用折叠和实色块，不能据截图断定两者采样口径相同。

建议布局：

```text
查找类名或方法     返回上层   缩小 100% 放大 适应   全屏   ⓘ   导出
┌──────────────────────────────────────────────────────────┐
│ 实色调用块；短类名.方法为主；选中路径强调；全文在悬停中展示 │↕
│ 根调用保留在底部；固定层高；连续库调用可按 +N 折叠 / 展开   │
└──────────────────────────────────────────────────────────┘
                 横向导航 / 缩放范围
全部  网络通信  平台业务  GC  响应式操作符  其他
```

步骤：1）先修正文字裁剪及实色 / 选中层次，短名称为主、包名作为详情；2）保留内部纵向滚动并提供可见导航，支持横向缩放 / 平移、点击聚焦、上一级和适应，快捷键仅图表获焦时生效（+ / - 放缩、0 适应、Esc 返回；修饰键 + 滚轮只在图内生效）；3）增加可展开的连续库调用折叠，保留真实父子路径、样本分母和原始帧，不以分类筛选制造虚假调用边；4）对仅存在本页内存的诊断数据增加信息 icon，明确刷新 / 关闭后的丢失边界及服务端历史可回读范围；5）导出默认当前节点已采集的诊断快照，提供交互 HTML、原始 JSON 与可打印 PDF 报告。PDF 冻结采集时间、节点、采样范围与限制，深栈分段、明细分页，包含当前已取得的线程 / 火焰图 / 分配证据，不以屏幕截图代替全部数据；尚未采集项标注，不擅自执行堆转储或跨节点重新采集。是否扩大为所有已观测节点需用户确认。

用户已确认并实施当前节点导出范围与两个页签：**实时分析 / 诊断快照**。节点外层仍为“运行概览 / 性能剖析 / MBean / 日志”。实时分析上方展示火焰图，下方展示同一次 JFR 采集的内存分配信息，不再将内存分配单独切换，也不混入线程或堆转储操作。诊断快照集中提供“采集线程栈”和“导出堆快照”，两项均由用户显式点击执行，线程结果原位展开；进入页签本身不触发采集，开始实时分析也不额外采集线程。堆快照操作展示已有影响说明和确认，保留存活对象选项。沿用 `tool=jvm` 与现有权限，切换页签或节点不销毁已取得证据，实时采样状态持续可见；各区域标明自己的采集时间。旧线程偏好映射到诊断快照，旧内存偏好映射到实时分析。

方案档案：`solutionName=既有节点工作台内的分析钻取`；`primaryFilterSurface=帧搜索＋既有分类`；`contentSurface=实时分析中火焰图与内存分配上下排列，诊断快照中按需采集并展示线程证据`；`detailCarrier=图内聚焦、热点证据与原位线程展开`；`editMode=只读诊断＋显式采集操作`；`coreComponents=JvmDiagnosticPanel、FlameGraphViewer、AllocationRanking、ThreadViewer、Ant Design Tabs/Tooltip/Button`；`actionPlacement=实时分析工具栏控制统一采样，诊断快照工具栏提供线程采集与堆导出，当前节点导出入口保持统一`；`densityTarget=两个清晰页签，实时分析一张主图，下方紧凑分配明细，辅助说明收纳到 icon`；`sidebarMode=保留既有节点栏`；`confirmationMode=阅读、当前节点导出和两页签布局均已确认`；`rejectedAlternatives=线程与内存成为节点外层Tab、三类证据全部堆在一页、点击页签直接堆转储、截图冒充完整报告、默认跨节点采集`。只读诊断不增加编辑壳或管理表格，不叠加 KPI 卡与大段说明。

最新布局实施与验收计划：1）在 core `RuntimeDiagnostics/JvmDiagnosticPanel.vue` 收敛为两个页签，默认实时分析，复用宿主已有节点数据和事件；2）将 `AllocationRanking.vue` 放到火焰图下方，明确内存分配为采样估算，处理只有分配样本而没有执行样本的状态；3）将 `ThreadViewer.vue` 与显式堆导出放到诊断快照，移除开始采样时顺带采线程的行为，保留每项已有授权与失败反馈；4）在宿主 `NodeDiagnostics.vue` / `useJvmDiagnostics.ts` 核对采样持续、节点隔离与导出范围；5）集中运行 core / host 相关测试、类型检查与模块构建，再进行两轮浏览器走查，覆盖空态、采集中切换、历史结果恢复、窄容器、键盘和堆导出确认。不新增后端接口、权限、菜单或持久化策略。风险是旧模式偏好映射与隐藏页签中的采样可见性，须验证旧偏好不会导致空白或额外请求；堆操作保持显式确认，不在走查中无故生成真实大文件。

风险与验证：服务器本身截断的栈不能在前端还原，折叠必须保留原始路径；浏览器 PDF 是静态报告，原始样本及离线分析由 JSON / HTML 保存。集中验证深栈 / 大样本、短帧文字边界、折叠可逆、缩放定位、Tab 恢复与键盘作用域，至少两轮真实 UI 走查，并验证多页 PDF 无截断、分页与导出期间采样快照一致。

实施结果：`JvmDiagnosticPanel.vue` 负责两页签与显式操作，`FlameGraphViewer.vue` 保留缩放、聚焦和搜索，组合布局内热点明细默认收起、图高随视口调整，下方 `AllocationRanking.vue` 原位展示分配；`ThreadViewer.vue` 使用内部滚动和原位展开。宿主 `NodeDiagnostics.vue` / `useJvmDiagnostics.ts` / `preferences.ts` 对接受控页签与旧偏好迁移。客户端生成的 HTML / JSON 通过 `saveDiagnosticBlob` 保存，服务端二进制响应仍由 `saveDiagnosticFile` 拒绝错误 JSON；导出冻结当前节点授权证据，取消或过期导出失败不能污染新节点反馈。

集中检查：core 209/209、host 289/289 通过；core 诊断类型检查 0 错误，host 仍为 167 个既有类型诊断，按路径和行列归一化后新增 0。模块最终构建成功（35.97 秒），保留已有 chunk / re-export 警告；无独立 lint 脚本，SFC 编译检查由回归覆盖。两轮真实 UI 走查覆盖 1396×984 与 1060×853，窄屏自动收起节点栏且无页面横向溢出；实时采样时切换快照、搜索和 150% 缩放恢复、253 线程按栈深排序及展开保留、file-service / IoT 往返恢复均已验证。堆快照仅验证确认与存活对象选项，未执行真实堆转储。日志为 `/private/tmp/runtime-profile-{core-tests,host-tests,core-types,host-types,build}.log`；截图为 `runtime-ui/output/playwright/runtime-profiling-final.png`、`runtime-profiling-narrow.png`、`runtime-diagnostic-snapshots.png`。

真实 JSON 下载成功并解析，包含 IoT 节点 251 线程、277 调用帧、421 分配类型。相同报告生成器用这份真实证据经 Chrome 打印为 137 页 A4 横向 PDF，核对首页、分配与线程页中文、完整明细及分页，无空白页；PDF 为浏览器打印能力，不是服务端直出文件。IAB 中点击 PDF 入口后没有可观测的新报告 Tab，原生打印窗口的完整端到端流程尚未确认，不能将分页夹具当作该交互已通过。本轮未启停服务、提交或更新 PR。

完整 HTML 导出方案（已实现并完成真实下载验收）：默认导出“交互诊断报告.html”，当前节点证据冻结后内嵌，沿用实时分析 / 诊断快照两页签。火焰图复用既有离线运行时，保留搜索、缩放、聚焦、分类与库调用折叠；下方内存分配支持搜索和排序，线程支持名称 / 状态筛选、按栈深排序和完整栈展开。元信息包含节点、导出时间、各证据采集时间及采样口径，采集状态明确标为“导出时状态”；报告离线只读，无外部资源、请求或凭据。JSON 保留原始证据，打印 / PDF 留作次要入口；完整 PDF 已出现 137 页，阅读和查找体验弱于 HTML。

本次方案档案：`solutionName=节点分析钻取的离线报告`；`primaryFilterSurface=火焰图帧搜索、分配类型搜索、线程名称与状态`；`contentSurface=实时分析上图下分配，诊断快照原位线程展开`；`detailCarrier=聚焦路径与原位展开`；`editMode=离线只读`；`coreComponents=复用 flameGraphHtml 的分析及交互片段、allocation 与 thread 格式化、原生语义化控件匹配 Ant 风格`；`actionPlacement=默认 HTML 下载，更多菜单 JSON 与打印`；`densityTarget=一个主图、紧凑辅助明细和元信息`；`sidebarMode=无侧栏`；`confirmationMode=用户已执行确认`；`rejectedAlternatives=截图报告、远程 CDN、另起火焰图算法、自动补采、导出账号状态`。

实施步骤与边界：只改 core `RuntimeDiagnostics` 报告生成 / 离线运行时与宿主 `useJvmDiagnostics.ts`、`NodeDiagnostics.vue`、中英文文案和相关测试；抽取可嵌入火焰图片段，生成完整离线报告，接入默认下载并保留现有导出权限和取消隔离。重点防止脚本闭合注入、动态文本 HTML 注入、大列表阻塞与筛选改变样本分母。集中验证安全转义、完整数据、冻结与取消、英文 / 空态、核心与宿主类型及构建，再以真实导出进行离线交互和宽窄屏两轮走查。不改后端、菜单、权限、设备会话、采集口径或持久化策略，不启停服务或提交 PR。

完整 HTML 实施结果：core `jvmDiagnosticHtml.ts` / `jvmDiagnosticHtmlRuntime.ts` 生成自包含报告，`flameGraphHtml.ts` 抽取共享片段，宿主默认下载按钮调用 `exportReportHtml()`，JSON 与打印入口移至相邻更多菜单。全部授权证据嵌入文件，内存分配与线程首屏分别有界展示 100 / 60 条，加载更多可访问全部，搜索与排序始终覆盖全量；线程展开与页签状态独立保留。中英文报告、安全转义、最小化生产 bundle 执行、证据冻结、撤权和取消隔离均有回归覆盖。

本阶段集中验证：core 214/214、host 291/291 通过（`/private/tmp/runtime-html-{core,host}-tests.log`）；最终“导出时状态”文案修正后，受影响 core 33/33、host 25/25 再次通过（`/private/tmp/runtime-html-{core,host}-final.log`）。core 诊断类型检查 0 错误，宿主最终仍为 167 条既有诊断，归一化对比新增 0（`/private/tmp/runtime-html-host-final-types.log`）；最终模块构建成功，38.59 秒（`/private/tmp/runtime-html-final-build.log`），保留既有 chunk 警告。两个模块 `git diff --check` 通过；未配置独立 lint 命令，未宣称全量类型或 lint 通过。

用户重启前端后，真实页面完成线程采集、JFR 实时更新、停止与默认 HTML 下载，实际文件含 IoT 节点 250 线程、367 调用帧、602 分配类型，41 个执行样本。两轮 IAB 走查覆盖 1396×984 与 680×853、中文及英文：搜索 / 分类、缩放及 0 复位、调用聚焦与 Esc、连续库调用折叠、分配全量分母和加载更多、线程名称 / 状态筛选、完整栈与页签往返保留均已核验，页面无横向溢出。报告加载后通过浏览器断网设置再次验证交互，不依赖账号、API 或外部资源，控制台无错误。浏览器工具不允许直接导航 file 协议，因此以现有开发服务的 @fs 路径打开同一份实际下载文件后断网验收，未声称完成 file 协议端到端测试。报告及截图为 `runtime-ui/output/playwright/runtime-diagnostic-report.html`、`runtime-diagnostic-report.png`、`runtime-diagnostic-report-narrow.png`、`runtime-diagnostic-report-threads-narrow.png`。本轮未启停服务、执行真实堆转储、提交或更新 PR。

PR 隔离交付核验：沿用 [core#195](https://github.com/jetlinks-v2/jetlinks-web-core/pull/195) 与 [host#352](https://github.com/jetlinks-v2/device-manager-ui/pull/352)，本次增量仅同步性能剖析阅读、两页签、当前节点离线报告及相关回归，其他未提交功能继续留在原开发工作区。隔离工作区 core 217/217、host 264/264 通过（`/private/tmp/runtime-html-pr-{core,host}-tests.log`）；合入最新 `origin/2.20` 后，基线没有修改这些测试及其诊断实现，复用该回归证据。最终 core 类型检查 0 错误，host 166 条既有类型诊断，按错误身份与开发环境基线比较新增 0；组合生产构建成功，28.18 秒（`/private/tmp/runtime-html-pr-{core-types,host-types,build}.log`），两个边界 diff 检查通过。宿主仍无独立 lint 命令；PDF 原生打印窗口与 file 协议端到端限制沿用上述边界。

### 历史趋势时间联动修复（已完成）

同节点、同时间范围的资源历史图保持悬停时间游标和缩放范围联动；各图图例独立，设备运行和 Buffer 近实时趋势不加入本组。旧实现只在属性更新后扫描一次 DOM，隐藏容器延迟初始化时没有实例可注册；改由共享 ECharts 的 ready / dispose 信号注册、释放历史区实例，KeepAlive 暂停和恢复成对处理，不增加轮询或改动数据采集。入口为 core `history/useLinkedHistoryCharts.ts`、`HistoryMetricCharts.vue` 与 ECharts 生命周期；定向验证覆盖延迟初始化、实例重建、时间对齐、缩放单次提交、独立图例和 Tab 恢复，真实浏览器验收由总控集中执行。

定向验证：`node --test tests/runtimeHistoryLinking.test.mjs tests/runtimeDiagnosticsHostPresentation.test.mjs` 10/10 通过，其中 6 项以真实 ECharts SVG SSR 实例验证时间联动；`pnpm exec vue-tsc -p tsconfig.runtime-diagnostics.json --noEmit` 通过（0 错误），`git diff --check` 通过。悬停按时间值同步，不复制样本下标或像素；同一范围刷新不重置缩放，进入新的查询范围才复位。原生工具栏显隐也不再将缩放重置到 0–100%。没有重跑全量构建，也未把 SSR 结果当作真实浏览器验收结论。

集中交付验证：以最新 `origin/2.20` 的隔离工作树执行 core 回归 200/200、host 回归 254/254，core 诊断类型检查 0 错误；host 为 167 个既有类型错误，归一化路径及基线移动的行号后与 UI-R4 错误身份完全一致，新增 0。最终 device-manager-ui 模块构建成功（31.87s），日志为 `/private/tmp/runtime-pr-{core-tests,host-tests,core-types,host-types,ui-build}.log`。真实 IAB 验收确认五张有数据的资源历史图同刻游标、读数及 Ctrl 滚轮缩放同步，MBean / 概览往返仍联动且保留范围；无数据的业务流量图继续显示空态。验收后恢复原时间范围，截图为 `runtime-ui/output/playwright/runtime-history-linked-final.png`。

最新后端基线集中验证：common 65/65、gateway 8/8（`/private/tmp/runtime-pr-components-tests.log`），device-manager 生产 / 测试源码编译及通信 Monitor 定向测试 20/20（`/private/tmp/runtime-pr-device-tests.log`）。设备模块首次编译遇到本地 Things 旧依赖缺少新基线方法，编译安装同一 2.20 的 Things 依赖后通过；未修改该依赖源码或启停应用服务。真实业务负载下的吞吐开销仍未验证。

### UI-R4：缓存辅助行与 Buffer 趋势收敛（已完成）

沿用现有概览工作台，将属性缓存压成“属性缓存 34条 · 待落盘 0条”的辅助行；仅缓存名称为原生 Ant link，原位进入对应 MBean，不再单列“查看详情”。`DirtyCount` 来自 `LocalFileThingsDataManager.dirtyKeys`，按物实例－属性记录等待刷盘的修改项；`QueueDepth` 来自 `dirtyQueue`，不是全部缓存数，均只在真实属性存在时显示。QueueDepth 的真实读数、完整含义与最近刷盘时间只放在说明中；普通瞬时等待不标为异常，不增加重复黄色提示。缓存读数维持 13px / 500，保留会话能力前置门禁、精确值、缺测与陈旧语义。

Buffer 已将堆积与吞吐合并为数量 / 速率双轴，移除顶行模式控件，分组、刻度与采集设置收进更多操作，保留 ECharts 多选及偏好；同集合队列以互斥五色区分，失败使用红线。入口为 host `DeviceRuntimeTrend.vue` / `overview/useOverviewTrends.ts`、core `buffer/BufferOverviewChart.vue` / `buffer/history.ts` 及中英 locale。未调整后端、采集与权限。

集中验证：缓存行为回归 21/21（`/tmp/ui-r4-cache-host-tests.log`）、Buffer / popup / JVM 回归 29/29（`/private/tmp/ui-r4-buffer-tests.log`）、SFC / JSON 校验通过。core 类型检查 0 错误（`/tmp/runtime-ui-r4-core-types.log`）；host 仍为 167 个既有错误，`/tmp/runtime-ui-r4-host-types.log` 与 `/tmp/runtime-ui-layout-r3-host-types.log` 逐字一致，新增 0。最终模块构建成功，耗时 43.62s（`/tmp/runtime-ui-r4-build.log`）；目标模块无 lint 脚本。

两轮真实 IAB 走查通过：缓存名称直达 `LocalFileThingsDataManager`，返回概览保留趋势；Buffer 汇总 / 按队列、五色区分、Esc 关闭并回到触发点正常。1626 / 1218 / 760px 整页均无横向溢出，760px 时内容内宽为 464px；两图均为 240px，SVG 宽度等于容器。正式组件合成夹具 `runtime-buffer-preview.html` 另验证失败数 3 的红线、英文、图例全关空态、原生图例恢复单队列、压缩刻度下同 scope 四项 Tooltip 保留原值；合成样本不作为真实节点证据，未对集群执行 reset。截图为 `runtime-ui/output/playwright/runtime-ui-r4-overview.png`、`runtime-ui/output/playwright/runtime-ui-r4-buffer-fixture-en.png`。

真实请求期间曾短暂 15s 超时，页面保留旧值并断线，后续轮询已恢复；本轮不宣称修复网络或后端。验收后已恢复默认视口与汇总偏好，关闭临时夹具页并保留真实页面。

### UI-COMPACT-R3：概览标题与趋势统一（实现、集中验证及两轮 UI 走查完成）

沿用现有运行监控工作台，仅收敛设备运行与 Buffer 区块的排版、文案和图表比例。标题、说明图标和核心读数放入同一可换行页头，主读数统一为 16px / 600，操作靠右；两张趋势图高度统一约 240px，保留至少 145px 有效绘图区。设备突出设备会话、通信 QPS、上行消息；Buffer 突出待处理、写入和处理尝试速率，失败与陈旧状态继续可见，覆盖范围和累计含义放入说明或既有明细。

范围为 host `DeviceRuntimeTrend.vue`、core `buffer/BufferOverviewChart.vue` / `BufferQueues.vue` 及对应中英文文案；设备连接的 `device-sessions/DeviceObservationChart.vue` 仅统一 16×2 彩色短线图例。`TraceViewer.vue` 实际使用的空态文案统一为“未找到该链路”，说明记录可能过期、因负载淘汰或未采集，引导使用最近产生的 Trace ID；只改中英 i18n，不改查询或错误状态。不调整数据源、采集、权限、图例选择 / 缩放、旧服务降级、原仪表盘和历史六图。设备趋势实际绘图区为 152px；Buffer 分队列模式约 156px，聚合模式更宽裕。Buffer 隐藏常驻圆点，单个有效样本仍提示等待采样；处理尝试继续明确包含失败、取消和重试，不能视为成功量。

定向验证：host 设备运行 / QPS / 累计历史 24/24、core Buffer / 浮窗交互 24/24、设备连接观测 9/9 通过；4 个 SFC 的模板、脚本、样式编译及 4 份中英 JSON 校验通过，两个代码边界的 diff 检查通过。日志为 `/tmp/ui-compact-r3-host-tests.log`、`/tmp/ui-compact-r3-core-tests.log`、`/tmp/ui-compact-r3-observation-tests.log`、`/tmp/ui-compact-r3-sfc.log`。

链路空态文案补验证：core JVM / Trace 现有回归 22/22、host 链路工作区现有回归 15/15 通过，中英 JSON 解析通过；仅变更 `runtimeDiagnostics.noTraceRecords` / `noTraceRecordsHint` 两个既有键，未增加镜像文案测试。日志为 `/tmp/ui-compact-r3-trace-empty-core-tests.log`、`/tmp/ui-compact-r3-trace-empty-host-tests.log`、`/tmp/ui-compact-r3-trace-empty-json.log`。

MBean 语义指标同步统一主辅层级：真实页面主值为 16px / 600，辅助时间为 14px / 400，完整日期保持整项显示。相关行为回归 22/22（`/private/tmp/mbean-semantic-ui-type-r3-tests.log`）、core 诊断类型检查 0 错误（`/private/tmp/mbean-semantic-ui-typecheck.log`）。最终模块构建成功，耗时 40.44s（`/tmp/runtime-ui-layout-r3-build.log`）；host 类型检查仍为 167 个既有错误，当前 `/tmp/runtime-ui-layout-r3-host-types.log` 与基线 `/tmp/device-qps-final-host-types.log` 逐条一致，新增 0。目标模块没有 lint 脚本，未宣称 lint 通过。

两轮真实 IAB 走查覆盖：概览、线程已采样、性能采样空态、MBean、已加载 500 条的日志、居中链路搜索及 Chrome 获取 ID 引导、过期链路空态、设备连接。HTTP / 异常 Span 展开另用正式组件的合成夹具验收，不作为真实有记录链路的证据。第二轮在 1626 / 1218 / 760px 整页宽度下均无横向溢出；概览两个页头宽屏同为一行（26 / 27px 高），内容宽 464px 时自然换行（58 / 54px 高）；两图均为 240px，SVG 宽度等于容器。设备运行正式夹具在英文、328px 内宽和百万级读数下仍无溢出。代表截图：`runtime-ui/output/playwright/runtime-ui-layout-r3-overview.png`、`runtime-ui/output/playwright/runtime-ui-layout-r3-mbean.png`、`runtime-ui/output/playwright/runtime-ui-layout-r3-trace-empty.png`。

待追踪边界：冷首次进入概览、且同工作区构建正在进行时曾出现一次空白及 Axios 网络通知，正文根未生成，控制台未见 error；切到 MBean 再返回后恢复。最终源码下连续两次 logs → 1218px → overview / 760px / 1626px 未复现，独立 Vue 模型也未见 KeepAlive / resize 异常。当前证据不能确定根因，也不能称该空白已修复；本轮未据猜测添加重试或修改框架。

### 设备运行统一监控开发任务（本轮已完成）

已按确认的 L 级计划完成本轮实现与集成验收：复用 `DeviceGatewayMonitor` 采集链，以只读 MBean 同时服务平台和第三方采集；在节点概览将设备会话与通信合成一张“设备运行”趋势图，优先帮助判断连接规模、上行负载和处理压力，弱化设备属性缓存。最终 DTM-v1.2 由 Monitor 直接提供近 1 秒通信 QPS，前端与外部直接读取标准属性；已完成集中回归、两轮 UI 走查及重启后的真实 17 属性 / 7 键数据链验证。实际协议、网络和数据库业务负载下的性能预算仍是明确的后续验证边界，不据微基准宣称无性能影响。

原始通信次数保留 DTM-v1.1 已实施语义：`ReceivedPacketsTotal` 在 `beforeDecode` 对每份非 null 原始 `EncodedMessage` 计一次，长度为 0 或后续解码失败仍计；`SentPacketsTotal` 在既有 `downstream` sender 成功完成后对每份非 null 原始 `EncodedMessage` 计一次，零长度也计，失败 / 取消 / null 不计。字节与次数共用现有观察点与成功回调，不新增消息订阅、处理器或前端轮询。既有 Micrometer `received_message` 在部分 TCP / HTTP 路径按解码业务消息计数，不能借作原始通信 QPS，其来源不变；这里的原始通信不代表所有 TCP 包或平台 HTTP 请求。

DTM-v1.2 最终契约：保留原 10 属性，新增 `double ReceivedQps`、`SentQps`、`CommunicationQps`、`long QpsSampleTime`（展示截止点的 epoch 毫秒）、`QpsWindowMillis` 及 `boolean QpsReady`，另增含上述 6 键与 `long QpsWindowSequence` 的标准 `CompositeData QpsSnapshot`，共 **17 个只读标准属性**，复合值共 7 键。每节点固定 11 个槽、每槽 100ms，事件到达时用一次 `nanoTime` 定位槽并累加；换代时 CAS 替换桶对象，迟到的旧事件不能覆盖新桶。读取汇总最近 10 个已完成桶，形成完整 1 秒窗口（最多 100ms 展示延迟），不依赖上次读取、不修改统计桶、不启动后台任务。首个完整秒前 `QpsReady=false`、窗口 0；完整后窗口为 1000ms，长时间无通信自动读取为 0。相对单调时间处理绝对负值及一次环绕；`QpsWindowSequence` 为本代次已完成窗口截止的相对桶序号，与 `StartTime` 共同作为窗口身份，首窗前可返回当前非负序号，不可一致读取时为 -1。截止展示时间按本次 wall clock 减去当前桶已走的时间映射，校时或毫秒取整不改变窗口身份和速率。读者遇到换桶竞争最多重试，仍无法得到一致窗口则 `QpsReady=false`，不伪造 0。

前端只投影一次 `QpsSnapshot`，同一返回内的接收 / 发送 / 总 QPS 与窗口完全一致；外部可直接读取 6 个标量属性供 JMX Exporter 使用，也可一次读取标准复合快照，不依赖自定义 DTO。外部和前端直接使用 Monitor 算好的 QPS，缺少属性或未 ready 不得当成 0，不再由获取者按累计差推算 QPS；字节和上行消息速率仍沿用既有累计求差。原 10 个累计 / 读取时间 getter 语义不变。新增事件时钟读取与桶原子统计确有成本，不能称比定时方案天然更省；可控时钟、并发换代、空闲、负 nano / 环绕、17 属性 JMX 与复合快照 JSON 均有回归，最终 7 键版本已加载并通过真实只读核对。

#### 展示方案

沿用现有运行监控工作台及平台样式，不调整一级工作区或增加嵌套 Tab。“设备运行”、说明图标与设备会话、通信 QPS、上行消息读数放在同一可换行标题行；会话读数可原位进入已有设备连接工作区，不单列重复入口。上行消息包括属性、事件、回复与上下线等有效业务消息，不能将总量称为纯属性 / 事件上报量。

```text
设备运行 ⓘ · 设备会话 128 ↗ · 通信 QPS 42 次/s · 上行消息 320 条/s
┌────────────────────────────────────────────────────────┐
│ 会话  上行  通信  属性  事件  接收流量  发送流量         │
│ 会话记录（左轴）＋当前所选速率（右轴）                  │
│ 共享时间轴 / Tooltip / ECharts 图例 / 缩放              │
└────────────────────────────────────────────────────────┘
属性缓存 12,340 条 ⓘ                              查看详情
```

- 默认显示“会话记录＋上行消息速率”，有完整真实 QPS 能力时同图显示通信曲线。所有系列通过 ECharts 图例控制；选择收发流量进入字节速率轴，选择上行 / 通信 / 分类消息回到每秒速率轴，会话保持独立选择。不再展示“消息 / 流量”分段控件，不叠加第三种单位的数值轴。
- 运行概览的 Tab 下方间距与区块内边距避免叠加大空白；标题栏的会话入口与其他指标使用相同的图标间距和垂直对齐。设备运行与 Buffer 的轴含义和单位统一放在图表下方。图例只控制绘线，设备 Tooltip 按悬停时间汇总会话、通信、消息和流量明细；独立来源仅在半个实际采集周期内匹配最近采样，QPS 另考虑自身窗口，断点及超出范围保留缺测，不用旧值或插值补齐。按真实采样时间分组，同一时间只显示一次，名称与数值分列对齐，属性点位和通信方向明细从属于对应指标，保留过期提示。
- Tooltip 区分上行“条/s”和原始收发“次/s”，通信项给出接收 / 发送明细与近 1 秒窗口。属性点数保留在属性上报的辅助信息中；分类是总上行消息的子集，不能与总量相加，原始报文字节也不随解码消息数量重复统计。流量按 B/s、KB/s、MB/s 随量级格式化。
- 图表沿用现有 ECharts、平台颜色 / 字号 / 间距，SVG 渲染且禁用入场动画；默认连续折线隐藏密集点标记，彩色短线图例与系列对应，悬停仍可查看样本。大值使用 k / M 刻度，窄屏时间轴抽稀避免挤连；图例全关时提供恢复默认入口，单点等待、无有效样本等状态在图内简洁说明。
- 会话记录数明确表示节点持有的会话记录，不能称为去重在线设备数；曲线名称和说明直接表达业务含义。
- 属性缓存只保留图下一行辅助信息和详情入口，不单独占主趋势区。说明统一为：“设备最新属性的缓存，用于在规则引擎、场景联动等地方获取最新上报的属性值、上一值。”仅在会话 MBean 已确认、且缓存能力存在时展示。
- 会话、通信分别按真实能力显示系列；缺少通信能力时只显示会话，未知 / 不支持不显示假零。真实零值保留；首个累计样本尚不能算速率时显示“等待下一次采集”，不填 0。会话与通信源时钟明显不可比时保留真实时间并说明，不硬拼虚构历史。
- 左侧节点预览复用共享快照，展示紧凑的会话、通信 QPS 与上行速率；仅显示已采集项，Buffer 有堆积时继续按现有规则提示，不增加悬浮窗高度或独立轮询。
- 节点切换、工作区 / Tab 往返和改频率保留已采集历史、图例选择、缩放和连接展开状态；能力撤销、授权变化和身份切换按现有规则隔离清理。

方案档案：`solutionName=既有实例工作台内的监控感知区`；`primaryFilterSurface=既有节点选择＋ECharts图例＋既有时间范围`；`contentSurface=单张 ECharts 设备运行趋势`；`detailCarrier=原位 Tooltip＋既有设备连接/MBean 入口`；`editMode=只读`；`actionPlacement=会话读数原位入口＋图下缓存详情`；`densityTarget=默认会话与上行曲线、有能力时加通信QPS、缓存一行`；`sidebarMode=保持现有折叠/单节点/窄屏行为`；`confirmationMode=已获确认并实施`；`searchShellDecision=不新增搜索壳`。不采用独立会话/缓存大卡、多单位全部堆入一图、表格加抽屉的方案；不借鉴原仪表盘可编辑画布来改造当前工作台。

#### 指标与采集契约

1. 主入口复用 `gateway-component` 的 `DeviceGatewayMonitor`、`GatewayMonitors` Supplier 与 Composite 链。现有连接、报文收发等指标复用同一统计事实，不再建立第二套独立计数；设备消息分类由 `device-manager` 的集成实现负责，通用网关层不承载设备业务页面逻辑。
2. 每节点一个 `org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor` 只读 StandardMBean。DTM-v1.2 的 17 属性由原 10 个标准 `long` 累计 / 时间属性（`StartTime`、`SnapshotTime`、`ReceivedBytesTotal`、`SentBytesTotal`、`ReceivedPacketsTotal`、`SentPacketsTotal`、`UpstreamMessagesTotal`、`PropertyReportsTotal`、`PropertyValuesTotal`、`EventReportsTotal`）、上方 6 个近期 QPS 标量属性和标准 `QpsSnapshot` 组成；时间均为明确标注的 epoch 毫秒或窗口毫秒，QPS 为原始通信操作 / 秒。不增加成功落盘量或重置操作，不要求第三方依赖 Java DTO，不暴露 payload / 属性值。新增统计通过标准 JMX 供第三方读取，既有 Micrometer 计数保留原来源，不重复累加。
3. 会话规模继续读取现有 `org.jetlinks:type=DeviceSessionManager,*` 的 `Sessions`，不新增扫描或重复会话计数。通信只代表实际经过网关监控链的流量；自定义接入、插件和直连平台路径必须核实覆盖，不能标注成全平台所有消息。
4. 原始报文字节在 `beforeDecode` 以 `EncodedMessage.getLength()` 按报文统计一次；一份报文解出多条业务消息不能重复累计字节。业务分类在 `handleUpstream` 中进入 `platformHandler` 之前观察解码消息，同时覆盖返回 Flux 和 `FromDeviceMessageContext.handleMessage` 手动输出。不能将 `beforeSendToPlatform` 后置回调称为纯接收计数，也不能把包含平台处理的外层异常全部称为解码错误。
5. 子设备包装仅计内层有效 `DeviceMessage`，空包装 / 非设备消息不计；批量解码按真实消息逐条计量，手动输出不在空返回 Flux 中再次处理。重新订阅并再次通过观察点表示新的处理尝试，不按消息 ID 建无界去重表；取消后不虚增未观察到的消息。属性“条数”和属性“点数”分别计量，事件按实际事件消息计量。上行处理失败不回滚已接收量，完成也不等于数据库物理落盘成功；下行只在 sender 成功完成时累加，提前读取原始长度，不在完成回调访问已释放的 Buffer。
6. MBean 的累计读取不清零；原始通信 QPS 由 Monitor 事件驱动时间桶、读取近期完整窗口得到，不增加定时器或读取者基线。前端与第三方直接读取 Monitor 已计算的值，不能退回按调用方读取节奏求累计差。字节与上行消息速率仍可按真实快照时间差计算；这些累计速率的首样本只建基线，统计代次变化、计数回退、缺测和长时间中断要断线，不制造负速率或补零。QPS 按 `QpsReady` / `QpsWindowMillis` 识别是否可用，按 `StartTime`＋`QpsWindowSequence` 识别窗口；`QpsSampleTime` 仅供展示坐标，不能因 epoch 回拨拒收新序号，也不能因同窗 1ms 取整差追加伪新样本。
7. 默认沿用概览 / Buffer 的 3 秒频率与 3 / 5 / 10 / 30 / 60 秒配置，立即首采、完成后计时、有界并发且请求不重叠。保留各源真实时间戳；共享时间轴不等于伪造同一采样时刻，不用插值制造不存在的历史。不同单位曲线共享 Tooltip 时明确标注数据过期状态。
8. 生命周期由 `GatewayMonitors.register` 返回每次注册独占的句柄；`GatewayMonitorsRegister` 关闭时只释放自身句柄，同一 Supplier 在其他上下文中的注册不受影响。节点统计对象的关闭 guard 使已缓存的 Lazy / Composite 不再写旧代次；网关重建沿用节点累计，统计实例重建才改变 `StartTime`。MBean 名称冲突只警告，不抢占既有注册，也不由后来的失败注册者注销其他实例。
9. 公共 `common-component` 的 `MBeanUtils` 统一处理 HTTP 整数精度：安全整数保留 JSON number，超出 JavaScript 安全整数范围的整数转十进制文本；JMX 属性仍为原生 `long`。前端以 BigInt 解析累计值再算差，不能把已经舍入的不安全 number 当精确计数；该契约适用于通用 MBean 值，不为 DeviceMessageMonitor 特调。

#### 工作包与交付顺序

| 任务 / 建议负责组 | owning module 与入口 | 交付及验收条件 | 依赖 |
| --- | --- | --- | --- |
| T1 契约与覆盖核对 / 总控＋后端组 | `gateway-component` 的 `DeviceGatewayMonitor`、`GatewayMonitors`、`CompositeDeviceGatewayMonitor`；`device-manager` 的既有 Monitor Supplier | 冻结指标表、统计代次、计数阶段、单位、采集覆盖与权限映射；用真实接入路径确认可观察范围，列出不支持项 | 无 |
| T2 网关统计 / 后端采集组 | `modules/jetlinks-components/gateway-component`、`modules/device-manager`；`network-component` 仅在证据表明回调漏接时补齐 | 复用现有统计和 Supplier；完成业务分类、原始字节及生命周期处理；Composite 顺序、批量 / 子设备 / 手动输出 / 重试不重复计数 | T1 |
| T3 MBean 与第三方输出 / 后端采集组 | 统计状态 owning module 的标准 MBean 注册与注销；新增统计供 JMX 读取，既有 Micrometer 输出不变 | 标准数值属性可由 JMX 读取；启停、重建、注销与代次正确；不按设备注册 MBean；读取不扫描设备、不触发重置或额外业务查询 | T2 |
| T4 共享采集接线 / 宿主组 | `runtime-ui/modules/device-manager-ui/api/link/diagnostics.ts`、`views/link/RuntimeMonitor/useClusterSessions.ts` 及相邻共享采集 / context | 扩展或组合现有轻读批次；能力、速率、有界历史、节点侧栏和概览消费同一快照；保留既有最多 3 并发、stale / 403 / 身份代际隔离，不额外复制轮询 | T1、T3 |
| T5 展示融合 / 前端组 | `views/link/diagnostics/NodeOperationalSignals.vue`、`overview/useOverviewTrends.ts`、`overview/DeviceRuntimeTrend.vue`；复用 core ECharts | 一张设备运行图、ECharts 图例控制单位分组与系列、真实单位；缓存降为一行；宽窄屏、键盘及悬停信息清晰；节点 / Tab 往返不清空观察结果 | T1 后可用明确标记的夹具开发，真实验收依赖 T4 |
| T6 集成与验收 / 总控＋验收组 | 后端 owning module、runtime-ui 宿主与 core | 核对真实流量到 MBean 再到页面的数据链；集中完成编译 / 测试 / 类型检查 / 构建；至少两轮 UI 走查，修正后复验，按以下标准交付 | T2–T5 |

T1–T6 本轮实现与集成验收已完成。后端、宿主与展示组按互斥写集落地，总控冻结共享契约、检查统计阶段与性能证据、复核公共整数通道，并通过真实数据链和两轮 UI 走查验收；实际业务负载性能仍按下述边界保留后续验证。

#### 性能、权限与范围约束

- 热路径仅做类型判断、计数累加和读取已有集合大小；计数器在初始化时缓存。不得逐消息查 MeterRegistry、生成标签 / 统计 DTO、查设备或产品配置、查询数据库、调用 RPC、复制 Buffer 或再次序列化 / 解码。
- 默认仅节点 / 已配置网关等有限维度；不增加设备 ID、属性名、事件 ID 的全量标签。单设备通信沿用现有按需观测，不能把节点汇总填到某个设备曲线上；现有最多 5 设备对比不扩展为全量设备采集。活跃设备去重、属性排行及长期明细存储不在首期范围。
- 前后端历史和缓存有界，网关删除 / 重建、节点移除须回收状态；复用现有生命周期处理重复注册。MBean getter 不做全量遍历，第三方高频读取不影响消息处理流程。
- 后端访问使用平台统一注解和现有监控访问链；不新增自定义鉴权框架。前端只消费菜单 / 按钮授权，沿用 `monitor-query` / `session-query` 等声明，不自行推导 `system-monitor/query` 权限；新增 MBean 不绕过现有权限或设备资产边界。
- core 仅承载必要展示类型 / 图表；API、采集调度、权限和业务分类留在 owning module。以交互为先，不为复用强造大组件。中英文名称、单位、Tooltip 和状态同步维护。
- 不修改原 `/infrastructure/dashboard`、运营端 `ui/`、菜单 / 一级路由；不迁移日志底层 Provider，不增加全局消息订阅，不保存 payload，不启停服务、提交或推送。

#### 验收门槛与待验证风险

- 数据：使用已知条数的属性 / 事件 / 批量 / 子设备消息核对累计数、属性点数、原始字节；返回 Flux 与手动输出一致，Composite 不重复组合，重试严格遵循真实处理尝试口径；正常完成、异常、取消语义均有针对性用例。第三方 JMX 读取与平台累计口径一致，网关重建和节点重启不出现速率尖峰。
- 性能：同一负载下对照监控关闭 / 开启的吞吐、CPU、延迟与分配量，包含第三方高频读取场景；T1 冻结测试方法和可接受预算。无实测不得声称“无性能影响”；若超预算，先回查热路径和重复采集，再决定采样等降本方案，不静默改变计数精度。
- 权限与状态：无能力、真实 0、部分支持、失败保留旧值、撤权、重新授权、项目 / 账号切换和迟到响应均正确；缓存仍受真实会话与缓存能力约束。页面频率修改不清空历史，也不取消在途请求。
- UI 第一轮以正式组件验证真实数据、交互与层级：一眼分清会话多少、上行是否增大；缓存不抢主视觉；图例、Tooltip、速率首样本 / 缺测说明清楚，节点 / Tab 往返保留观察状态。
- UI 第二轮在第一轮问题修正后复验 1626 / 1218 / 760px、侧栏展开 / 折叠、中文 / 英文及零数据 / 高负载 / 大数值差；检查图表、图例、字体 / 图标 / 按钮和间距一致，无横向溢出、遮挡、跳动或无意义占位。真实接口与夹具验收分别记录，不以夹具代替真实链路完成。
- 概览已有瓶颈提示继续依赖持续 CPU / 内存 / Buffer 等真实证据，通信突增仅作相关线索；无失败或写入耗时证据时不直接断言“数据库写入慢”。本期不新增未经验证的因果判断。

#### 当前实现与验证证据

图表展示调整验证：设备 `tests/runtimeDeviceRuntimePresentation.test.mjs` 14/14、core `tests/runtimeBuffer.test.mjs` 24/24 通过，覆盖完整悬停明细、图例与模式独立、真实时间、缺测断点和匹配范围。core 诊断目标类型检查通过；设备模块 `pnpm exec vue-tsc -p tsconfig.runtime-diagnostics.json --noEmit` 仍报 167 项工程既有错误，本次修改组件无错误诊断，未宣称全局类型检查通过。统一 device-manager-ui 模块构建通过；工程未配置独立 lint，两个代码边界 `git diff --check` 通过。正式概览页已确认标题对齐、Tab 间距与全部明细；360px 英文真实组件预览中，完整浮层和 Buffer 轴说明无横向溢出，超长浮层可滚动阅读。

后端入口为 `modules/device-manager/src/main/java/org/jetlinks/pro/device/message/monitor/{DeviceMessageMonitor,DeviceMessageMonitorMBean}.java`；注册归属修复为 `modules/jetlinks-components/gateway-component/src/main/java/org/jetlinks/pro/gateway/monitor/{GatewayMonitors,GatewayMonitorsRegister}.java`。现有 MQTT / TCP / HTTP / UDP / CoAP 接线已有监控入口，本次未修改 network-component；仍不宣称覆盖绕过网关链的插件 / 直连接口。

gateway-component 离线 Maven 完整编译及定向 7/7 测试通过（`/tmp/device-message-monitor-gateway-offline.log`），此后未改变网关共享源码。device-manager 的最终 DTM-v1.2 整模块生产与全部测试源码编译、定向 **20/20** 通过（`/tmp/device-message-monitor-window-sequence-device.log`，15.873s）。以当前 common / gateway / device 源产物联合运行 JUnit 为 **27/27**（`/tmp/device-message-monitor-window-sequence-current-source-tests.log`），包括 10 项 Monitor 与 10 项窗口测试及原网关回归：实际 Spring 条件注册、Composite、手动 / 批量 / 子设备消息、失败 / 重试 / 取消、零长度收发、null、17 个只读 JMX 属性及 7 键标准复合快照经 MBeanCommand→HTTP JSON；窗口覆盖重复读取无副作用、首窗、已完成桶延迟、长空闲、4 线程并发双向计数、旧写不覆盖新代、三次重试后未知、负 nano / 环绕、非整毫秒起点同窗时间差 1ms 仍同序号与 QPS、wall 回拨后新序号继续前进以及关闭 / 重建。前一阶段 16/16、19/19、26/26 不替代最终窗口身份补丁证据。普通 Maven 曾因沙箱内不能更新 `~/.m2` 的 SNAPSHOT 元数据失败，改为 `-o` 后成功；没有扩权写缓存或启停服务。

公共整数通道已由 `MBeanUtils` 通用修正：common-component 编译及 12/12 定向测试通过，包含标准值转换、命令契约和实际 HTTP 调用（`/private/tmp/mbean-integer-precision-stage.log`）。报告保留既有 JaCoCo execution-data 与少数无关类版本不匹配提示，不将其写成测试失败。

可复现微基准为 device-manager 测试源码中的 `DeviceMessageMonitorPerformanceProbe`，本次使用 v1.2 时间桶及完整 17 属性重新实测。JDK 21.0.10 / macOS arm64 / 18 核、固定 512MB 堆，每种模式 1000 万操作、5 轮轮换顺序；每操作为 128B 原始上行、2 条业务消息与一次成功下发。关闭 / 开启监控的中位数分别为 57.56M / 7.71M op/s、16.8 / 127.2ns 线程 CPU、17.9 / 136.2ns 进程 CPU、112 / 360B 分配、P50/P95 42/42 与 125/167ns。开启监控的真实增量约 **110.4ns 线程 CPU、248B/报文操作额外分配**；事件时钟读取和时间桶累加确有开销，桶换代还有少量分配被大量操作摊薄，不能称零影响或零分配。开启并以 100Hz 读取实际 JMX 的中位数为 7.60M op/s、128.3ns 线程 CPU、135.7ns 进程 CPU、360B 分配、125/167ns，5 轮共 654 次读取、其中 165 次 `QpsReady=true`；仍有 JIT / GC 噪声，不据此宣称读取无成本。该空平台处理链微基准不能外推真实协议、网络和数据库负载下的吞吐变化；当前结果为 `/tmp/device-message-monitor-window-perf.log`。最终补丁只在读取快照追加窗口序号，不改变事件热路径，未重复千万级探针；上述高频读取数据属于追加序号前的 v1.2 窗口实现，不据此精确推算新增读取字段的分配成本。旧 v1 / v1.1 精确数据只作历史对照，实际业务负载预算仍待进一步验证。

前端共享采集入口为 `api/link/diagnostics.ts`、`RuntimeMonitor/useClusterSessions.ts`、`RuntimeMonitor/device-runtime/{deviceMessageHistory,deviceQps}.ts`；会话与通信独立能力 / 失败状态、共享采集调度和节点级有界历史，不增加单设备全量轮询。融合图表位于 `overview/DeviceRuntimeTrend.vue`，由 `NodeOperationalSignals.vue` 编排；缓存降为辅助行。最终宿主 **253/253** 回归通过（`/tmp/device-qps-final-host-tests.log`）；core 目标类型检查 0 错，宿主保留 **167 条既有类型错误、逐项比较 0 新增**（`/tmp/device-qps-final-host-types.log`），不宣称全局类型检查无错误。模块构建通过，耗时 **38.47s**（`/tmp/device-qps-final-module-build.log`），保留既有 chunk 提示。其后仅将图例形状常量改为 `rect` / 高度 2px，真实 ECharts SVG 已验证非零面积彩色短线，SFC 编译及相关 **11/11** 专项回归通过。工程没有独立 lint 脚本，未宣称 lint 通过。

用户重编重启后，应用内浏览器已确认 IoT 最终 DTM-v1.2 的 **17 个属性与 7 键 QpsSnapshot**，统计启动时间为 `2026/10/26 11:53:19`。首次 `SnapshotTime=1792986911506`，复合快照为接收 / 发送 / 总 QPS **2/0/2**、`QpsReady=true`、`QpsSampleTime=1792986911451`、窗口 **1000ms**、`QpsWindowSequence=1121`，同次 summary 标量一致；第二次只读刷新为 **0/0/0**、ready、1000ms、`QpsSampleTime=1792986949150`、序号 **1498**，同次标量仍一致。两次之间累计原始接收 **68→94**、上行消息 **49→62**，验证近期真实零值与累计继续增长可同时存在。概览与左侧均消费共享 QPS；跨 JVM Tab、设备连接工作区、auth↔iot 节点往返保留曲线，节点栏折叠可用。早期 8 属性及 17 属性 / 6 键观测仅属加载最终补丁前的历史，不代表当前能力或最终验收。

两轮 UI 已完成，最后折线 / 窄轴修正后再次复验：正式组件夹具覆盖 **1008px 中文与 328px 英文图表容器**，图例切换流量 / 消息、会话入口、缩放保存、全关恢复均可用；旧 8/10 属性隐藏 QPS，首窗等待、真实 0、partial / 未知、stale 保留及百万量级 k/M 刻度分别验证。连续折线默认 `showSymbol=false`，图例为彩色短线；≤480px 时间轴降低刻度密度，无横向溢出。时钟差异夹具经真实历史追加链生成分段，单点等待后追加恢复 QPS=16，轴跨度 3 秒而非跨天。日志为 `/tmp/device-qps-final-r1-recheck.log`、`/tmp/device-qps-final-r2-refixed.log`、`/tmp/device-qps-final-r2-clock-recovered.log`；截图为 `runtime-ui/output/playwright/device-qps-final-r1-wide.png`、`device-qps-final-r2-high-narrow-en.png`、`device-qps-final-r2-clock-narrow.png`、`device-qps-final-r2-clock-recovered.png`。

真实页面最终 Chrome 1218px 视口中正文 `clientWidth=scrollWidth=922`（`/tmp/device-qps-final-real-final.log`），760px 稳定视口中为 **464=464**（`/tmp/device-qps-final-r2-real-760-stable.log`）；截图为 `runtime-ui/output/playwright/device-qps-final-r2-real-1218.png`，已包含最后的彩色短线图例。应用内浏览器 1626px 实页确认清晰折线、彩线图例，悬停显示真实上行 **0.33 条/s、12:14:02**。夹具新 Tab 创建曾超时，使用已有可见 Chrome 完成正式组件场景；应用内浏览器主页面及真实 MBean 验证正常。夹具不代替真实数据链，未人为制造真实高负载、权限失败或统计重置；本轮剩余局限为实际业务负载下的性能预算。服务重启由用户完成，未提交或推送。

### Span 详情与连接阅读状态

本次局部修正仅覆盖 core `TraceSpanDetails` / `TraceAttributeGroups` 和设备连接展示：Span 行内详情沿用现有承载，已识别字段显示中英文业务名称，结果 / 异常优先，原始键名可悬停查看；技术属性与链路标识合并为一个折叠入口，长键名不拆成孤立字符。设备连接周期刷新只更新快照并保留同一会话的展开状态，查询身份改变、会话消失或撤权才清理。保持现有接口、菜单权限、旧仪表盘和服务进程不变；集中进行相关测试、类型检查、构建及宽窄屏浏览器验证，结果在此回填。

已完成：逻辑会话分组以设备 / 节点 / 协议为稳定身份，代表连接地址、建立时间或子连接顺序变化不重置展开；重复分组仍使用物理信息区分，底层连接与速率计算身份不变。只有成功快照确认移除或撤权 / 查询身份改变才清理阅读状态，临时失败保留。技术信息中的标识与运行属性统一标签列，窄容器自动转为单列。core runtime / trace 回归 186/186、宿主 runtime 220/220，通过最终针对性详情回归与 core 诊断类型检查；`pnpm build:modules device-manager-ui` 构建通过（39.28s，保留既有大 chunk 提示），中英文 JSON 有效且无重复键，两仓 `git diff --check` 通过；没有独立 lint 脚本。

本轮应用内浏览器控制连接超时，使用独立可见 Chrome 加载 `tests/runtime-trace-session-preview.html` 中的正式组件与明确标记的合成快照，两轮覆盖 1626 / 1218 / 760px、中文 / 英文、HTTP / 数据库 / 异常、技术信息展开及连接多次刷新。代表连接切换、数量变化和顺序重排后列表保持挂载与展开，页面无横向溢出；截图为 `output/playwright/runtime-span-{details-review,error-wide,error-narrow,database-english-narrow}.png`。这属于组件交互验收，未据此宣称真实后端周期刷新已验收；未启停服务、提交或推送。

### 字体与图标层级

本轮沿用集群监控、链路追踪和设备连接的现有结构，仅校准样式：对象标题 16px / 600，区块标题 14px / 600，正文与密集记录 14px / 13px，时间、单位和说明统一使用平台 12px 辅助字号；避免页面中 10–11px 小字及默认 700 字重。主指标保持 24px，辅助动作正常字重，操作 / 说明图标 14px、展开箭头 12px，沿用 Ant Design 点击区域和平台间距 token。影响范围为 `views/link/{RuntimeWorkspace,RuntimeMonitor,Tracing,diagnostics}` 与 core `RuntimeDiagnostics` 展示样式，不改变数据、权限或页面交互流程。宽窄屏的节点标题保持同一层级；概览、Buffer、历史和设备趋势图继承平台字体，设备趋势时间轴抽稀并隐藏重叠刻度。已有测试保留容量条高度与紧凑导航约束，解除对旧字号字面量的绑定，并补齐图表主题依赖的测试替身。

集中验收：宿主 runtime 220/220、core runtime / trace / retained-scroll 184/184，模块构建通过（29.02s，保留既有大 chunk 提示）。core 诊断 `vue-tsc` 0 错，宿主为 167 条既有错误、相对基线 0 新增；两仓 `git diff --check` 通过。本模块没有独立 lint 脚本。浏览器两轮复查覆盖 1626px、1218px 与 760px：概览 / MBean / 日志换行、只读线程快照、设备真实查询与展开均正常，无页面横向溢出，设备趋势时间标签不再挤叠；实测节点标题 16px/600、区块标题 14px/600、指标 24px/600、时间 12px/400、说明图标 14px。链路搜索、获取指导及空态已验；历史 ID `a166ad3bc81b61993ecd91582bcb58d2` 当前无记录，本轮未宣称真实 Span 展开完成验收。截图为 `runtime-ui/output/playwright/runtime-typography-{overview,overview-compact,connections-narrow}.jpg`，验证日志为 `/tmp/runtime-typography-*.log`。未启停服务、提交或推送。

### 设备连接节点分布

设备连接概览的节点分布与采集覆盖统一排除已确认不支持会话能力的节点（`supported=false` 或 `unsupported`）；未知、失败和缺少计数的节点保留，真实零值仍展示。入口为 `RuntimeMonitor/sessionOverview.ts`，不改变集群目录、能力采集或查询范围；同步更新覆盖说明，集中核对汇总与实页展示。

本次集中验收：宿主 runtime 测试 220/220，覆盖不支持节点过滤、未知 / 失败 / 过期保留、真实零值、能力恢复及全不支持时的空汇总；模块构建通过（26.89s）。诊断 `vue-tsc` 为 167 条既有错误，相对基线 0 新增；两仓 `git diff --check` 通过，四份中英文 locale JSON 无重复键。真实设备连接页在构建后复查，节点分布仅保留 `ai-service:7100`（会话 0）和 `iot-service:8200`（会话 2），采集覆盖为 2/2；截图：`runtime-ui/output/playwright/runtime-session-supported-nodes.jpg`。本次未启停服务、提交或推送。

### 概览统一采集频率

运行监控的设备会话、属性缓存 / 堆轻读与 Buffer 共用采集频率，未配置时默认 3 秒，可选 3 / 5 / 10 / 30 / 60 秒；沿用账号 / 项目隔离的 `bufferIntervalSeconds` 偏好，兼容已保存的有效配置。顶部以时钟图标和当前间隔呈现入口，轻量浮层直接点选间隔，底部为“重置偏好”图标操作，取消表单下拉、重复标题和关闭按钮；支持点击外部与 Esc 关闭。修改频率按上次请求完成时间重排下一次采集，不清空曲线、不打断在途请求；仍保持立即首采、完成后计时、会话 / Buffer 各自最多三并发和身份 / 撤权隔离。设备连接页的独立观察频率及原仪表盘不变。

实施入口为 `diagnostics/preferences.ts`、`RuntimeWorkspace.vue`、`RuntimeMonitor/{index.vue,useClusterSessions.ts,useClusterBuffers.ts}` 及 `diagnostics/{useNodeMetrics.ts,useNodeOperationalSignals.ts}`；同步扩大有界历史容量，确保 3 秒下仍保留会话 / 缓存 10 分钟和 Buffer 5 分钟，并按配置调整诊断证据间隔。3 秒与 60 秒均保留足够证据判断持续瓶颈；CPU 的 producer 时间及持续阈值保持不变。

集中验收：宿主 runtime 测试 219/219，覆盖改频率后重排、慢请求不重叠 / 不取消、历史窗口、3 / 60 秒持续堆 / 缓存压力及权限清理；模块构建通过（26.95s）。诊断 `vue-tsc` 仍为 167 条既有错误，与原基线逐行比较 0 新增；本模块无独立 lint 脚本，`git diff --check` 通过，中英文 locale 无重复键。真实页面两轮走查确认 5 → 3 → 10 → 3 秒后曲线保留、Esc 关闭并回焦、JVM 往返保留历史、刷新恢复 3 秒，缓存真实计数变化可见。截图：`runtime-ui/output/playwright/runtime-overview-3s-settings.jpg`。源码验证日志保留在 `/tmp/runtime-overview-3s-{tests,types,build}.log`；未启停服务、提交或推送。

`views/link/DashBoard` 对应原“仪表盘” `/infrastructure/dashboard`，直接呈现 `DashBoardCanvas`，保持原指标切换、拖动缩放及 `infrastructure-dashboard` 个人布局。新增诊断不改变此入口或菜单权限。

`views/link/RuntimeMonitor` 对应独立“运行监控” `/infrastructure/runtime-monitor`，采用实例优先布局：左侧节点、实时 CPU / 堆概要，右侧概览、JVM 诊断、MBean、日志。可访问目录只有一个节点时隐藏所有节点选择器；多个节点在窄屏通过选择器切换。节点标题、健康和生命周期常驻，采样时间在名称悬停 / 聚焦时显示，采集频率与清除偏好收纳于右上角设置。该工作台独立订阅，不读写原仪表盘图表聚焦偏好。

运行监控菜单使用平台已有的 `FundProjectionScreenOutlined` 趋势监测屏图标，与原仪表盘区分；同步调整 `baseMenu.json` 默认声明和 `unifiedDeviceMenu.ts` 的旧默认值兼容，仅替换未配置或仍沿用仪表盘默认图标的项目，保留自定义图标。仅授权链路入口时显示的统一运行监控导航沿用相同图标，不改变菜单及按钮权限。菜单工作区回归 9/9、默认值兼容 / 自定义图标 / 权限保留检查通过；真实浏览器确认 `fund-projection-screen` 正常渲染，沿用相邻菜单的 16px 尺寸（`runtime-ui/output/playwright/runtime-monitor-menu-icon.png`）。host 类型检查与 R4 的 167 个既有错误完全一致，新增 0。本次局部图标调整未重复完整构建，目标模块无 lint 脚本。

`views/link/Tracing` 对应独立 `/infrastructure/tracing` 菜单，通过 `TracingController` 的 `GET /system/trace/{id}` 查询整个集群的原始 Span 列表，首屏以大搜索框承接 ID，查询后压缩为工具栏。保留后端允许的完整 ID，不新增条件检索接口。纳秒时间优先消费精确文本，未知时间、孤立节点、重复标识和成环记录均保留；仅明确的 exception 事件标异常。原始 app 埋点范围始终可见，只有与当前已授权节点目录 ID 或唯一别名精确匹配时才允许跳转节点 / 日志，不把第三方 scope 猜作实例。

公共展示位于 `jetlinks-web-core/src/components/RuntimeDiagnostics`，包括指标、线程、MBean、链路和日志。宿主的 `views/link/diagnostics`、`api/link/diagnostics.ts` 负责权限、传输和适配；指标继续复用 `visDashboard/SystemMonitor` 的历史服务与共享实时 runtime。

线程快照的状态筛选只保留下方带数量的标签，移除工具栏重复下拉。`ThreadViewer.vue` 增加可排序的“栈深度”列，默认降序，深度按已采集堆栈的非空帧行计算；搜索、状态筛选和展开保留，不把栈长解释为耗时或故障。纯计数放在现有 `RuntimeDiagnostics/utils.ts`，补齐中英文。集中验收：core runtime / trace / retained-scroll 测试 184/184，宿主 runtime 219/219，core 诊断类型检查 0 错误，模块构建通过（25.84s）；两仓 `git diff --check` 通过。真实 iot 节点采集 246 个线程，默认前三行栈深度为 122 / 22 / 17；WAITING 标签筛选、搜索与完整堆栈展开均通过，页面无重复下拉。截图：`runtime-ui/output/playwright/runtime-thread-depth.jpg`。

节点概览复用原仪表盘 ResourceUsage / RealtimeMetricGroup，同时展示系统、JVM、磁盘和网络，格式统一由 useRealtimeResourcePresentation 提供。CPU / 内存（系统与JVM）、主机网络收发、业务周期流量、丢包 / 错误 / 重传和 TCP 连接共六组趋势共用时间范围，历史请求批量加载，不切换指标；counterData 统一实时与历史的 B/s 算法，业务流量仍保留周期字节量。概览按 monitor-query 权限主动读取启动时间 / 时长、线程 / GC、Buffer 队列，属性投影避免读取无关大对象；队列可直接定位 MBean。历史请求与 MBean 独立状态，部分源失败不掩盖仍可用信息。日志 ZIP 作为导航容器，导出保留归档名；手工翻页暂停跟随。

### 权限与升级

权限边界：前端只声明菜单 / 按钮及其资源映射，并以已授权菜单 code 与 code:button 判断展示和操作；后端负责资源鉴权，不在前端追加 system-monitor/query 等原始资源权限判断。声明来源是 baseMenu.json，经 baseMenu.ts 保留后进入统一菜单流程，index.ts 负责路由 / 面板注册；当前 monitor-query → system-monitor/query 与 mbean-invoke → invoke 未发现映射缺漏。真实 system-monitor/query 拒绝已由后端组定位：菜单 / PermissionEntity 映射完整，新增 MonitorAuthorization 直接读取 authentication.hasPermission，未复用平台 AllowUserApiAccess 等统一授权策略；修复归后端统一鉴权层，前端未调整真实角色或放宽门禁，最终部署状态由总控核验。

三个入口分别依据服务端已授权菜单 `link/DashBoard` / `link/RuntimeMonitor` / `link/Tracing`。运行监控具体工具按新菜单 `baseMenu.json` 的 monitor-query、thread-dump、log-query 授权；调用与导出独立授权。旧仪表盘授权不解锁运行监控；新监控菜单授权后，未授权工具仍拒绝访问。

动作授权均先满足所属菜单：实时与历史资源使用 query；MBean 与其节点目录使用 monitor-query；线程采样使用 thread-dump；实时火焰图使用 jfr，导出 HTML / JFR 额外要求 diagnostic-export；堆文件要求 heap-dump 与 diagnostic-export；日志读取使用 log-query，下载额外要求 log-export。链路查询仅要求 Tracing 菜单及 query，不依赖运行监控菜单。没有节点发现权限时仅保留 URL 指定的未验证上下文，具体接口负责最终鉴权。

### 诊断交互与传输契约

#### UI-MBEAN-R1：诊断可读性与只读定位（已完成，保留运行风险）

目标是在既有运行监控中补足 Trace 长名展开、信息主次与帮助回焦，MBean 会话 / EventBus / Spring 监听的友好只读诊断，Things / SQL / Netty / Collector 摘要语义，日志目录稳定排序与键盘 / 连接状态，JFR 内存空态来源与跳转，MBean 宽布局恢复后的选中定位，以及概览的轻量异常信号。Owning 范围仅为 `RuntimeDiagnostics` 与 `modules/device-manager-ui` 宿主；不改旧仪表盘、`ui/`、后端、Provider 或任何运维动作。

实现前等待公共契约冻结：MBean 只读操作仍沿 `MBeanInvocation → host` 的 canonical 精确签名与原权限执行，展示组件不得直调 API 或按方法名前缀猜测只读；身份切换必须隔离代际；概览只对激活节点做轻读，不扩展全节点轮询，也不高频读取 Netty Metrics、DirtyBytes 或 SQL 全文。写集分工为 overview_refinement（Trace / UI）、backend_runtime（MBean core）、宿主组（宿主、日志、JFR 空态、全部 locale JSON 与本文档）。

实现已收敛到 frozen `MBeanInvocationOutcome` 回执：宿主仅在本次目标、签名和权限仍有效时交回克隆状态；取消、撤权或选中目标变更不交回旧代际结果。日志目录按目录、有效修改时间和自然文件名稳定排序，控制台状态采用独立 polite status；JFR 分配空态明确证据来自性能采样并只跳转至既有性能页。概览运行信号复用节点指标会话的 node/scope/权限边界，仅在激活节点首次进入和既有刷新时精确读取 `DeviceSessionManager`、`EventBus`、`ThingsDataManager`、`SystemMonitorCollector`；四源 `allSettled` 局部保留，失活取消而身份或撤权清空，历史失败或孤立 LastError 不伪装为当前故障。

集中验收完成：宿主 runtime tests 143/143、core runtime/trace tests 151/151（合计 294）；core `tsconfig.runtime-diagnostics` 类型检查 0 错，宿主相对 `/tmp/ui-mbean-r1-host-types-baseline.log` 保持 167 条既有错误、0 新增；一次模块构建成功（28.07s，保留既有 >2000kB 提示），两仓 `git diff --check` 与 MBean freeze manifest 通过。项目没有独立 lint 脚本，未将上述结果表述为 lint 通过。真实浏览器已验证三类 MBean 只读查询（session null 空态、EventBus 空集合、Spring 44 监听器），无调用时隐藏空条与 7 个零桶；稳定复验 Spring `loadAll` 依次经过 sidebar 展开、收起、JVM/MBean 往返及切换 authentication 再回 IoT 后均保留 44 条，且选择隔离正确，未再出现结果丢失。compact→宽布局选中树项可见且无横向溢出。概览四源真实事实以 37px 两行紧凑呈现并可定位 MBean；日志目录排序/回焦/连接状态播报、内存空态导航不启动采样，Trace 长名完整两行且 bar/name 同 top、业务前置、技术摘要自动展开加高亮、Help 关闭/Esc 回焦均通过。Trace 截图为 `output/playwright/ui-mbean-r1-trace.png`，MBean 截图为 `output/playwright/ui-mbean-r1-mbean.png`。

未启动或停止服务，未执行 JFR/heap/reset/flush/导出；旧仪表盘与后端 49 个保护文件 SHA 全部未变化。剩余运行风险：Trace 最后新增查询连续两次 20 秒超时；源码确认 `ClusterTracingService` 为全群 merge，未提供每节点 deadline/error 隔离，尚未确认具体故障节点。最后 Trace 技术定位验收使用已保留的真实 5 Span/2 节点数据，不宣称该新增查询成功。重点语义仍保持 LastError 为历史信息、负值表示不可得、counter 重置或同义字段不相加、未注册 MBean 不造卡片。

#### SESSION-R1：节点设备会话只读入口（前置交付已完成）

本段记录统一工作区之前的前置交付；其中节点 sessions Tab 已由下文 UI-WORKSPACE-R1 的全群设备连接视图替代，API、能力证据、授权及只读语义继续复用。

目标是在现有节点主从工作区中，仅为已确认存在 `org.jetlinks:type=DeviceSessionManager,*` 的节点显示设备会话 Tab（JVM 后、MBean 前）与概览会话指标；数量为 0 时仍显示，未知或无能力时隐藏，不影响通用 MBean。节点预览消费同一份能力快照。精确设备 ID 查询走 `GET /device/instance/{encodeURIComponent(id)}/sessions`，返回记录必须按 `serverId` 标识且当前节点优先；空结果不推断设备离线。

已确认采用现有“主从节点详情 + 监控感知”框架：主筛选仅为独立的设备 ID 精确输入，不引入 `ConditionFilter`；输入右侧提供查询动作。内容按节点分组呈现会话摘要，连接详情在原位展开，保持只读。概览维持一行密度，左侧目录不因结果而扩高或浮出新窗口；结果优先展示节点、协议与最近通信。侧栏继续沿用折叠和缓存契约。明确不做全量设备表、大 KPI、抽屉或无历史来源的趋势曲线。

交付分为三组：core 提供 `DeviceSessionViewer`、展示格式化、DTO 类型与公共 locale/export；宿主负责 API、权限、能力采样、路由接线、菜单与定向测试；概览/侧栏组消费同一能力快照并呈现紧凑摘要。整体不改后端、旧仪表盘或 `ui/`，也不提供移除会话、采集、启停或其他副作用。新增 `link/RuntimeMonitor:session-query → device-instance/query` 动作声明，`access.sessions` 控制 Tab/查询，MBean 能力读取仍需 `monitor-query`。

实现采用 `useClusterSessions` 的受控快照：首次发现成功的精确 MBean 才确认 supported，轻读 `Sessions` / `KeepOnlineSize`，默认 30 秒完成后计时、最多 3 并发且不重叠；node/scope/discovery/撤权/节点移除作废迟到响应，瞬时失败保留旧值标 stale，403/撤权清空。节点详情通过 context 消费能力与结果，切到无能力节点安全回 overview，同时保留原节点缓存。

实施完成：`api/link/diagnostics.ts` 提供精确会话 MBean 轻读和编码后的设备查询；`useClusterSessions.ts` 统一节点能力快照，`useDeviceSessions.ts` 隔离输入、提交和完成结果身份。`NodeDiagnostics.vue` 仅在 monitor-query 与 session-query 双权限、且 confirmed capability 下显示会话 Tab；`RuntimeMonitor/index.vue` 仅在当前激活节点收到 absent / forbidden / unsupported 证据后从恢复的 sessions URL 回退概览。`useNodeOperationalSignals.ts` 不再重复读取会话 MBean；菜单声明 `session-query → device-instance/query`，会话查看器的 `runtimeDiagnostics.deviceSessions.*` 公共文案已归入 core locale，宿主只保留 RuntimeMonitor 文案与偏好白名单。

最终集中验证：core runtime + trace 161/161 通过（复用 `/tmp/session-r1-core-tests-accepted.log`），core 主诊断及最后组件 focused `vue-tsc` 为 0 错；宿主最终 152/152 通过（`/tmp/session-r1-host-tests-accepted.log`），宿主类型检查仍为 167 条既有错误、相对基线 0 新增 / 0 移除（`/tmp/session-r1-host-types-accepted.log`）。最终模块构建成功，32.15s、exit 0（`/tmp/session-r1-build-final.log`）；49 个保护文件 hash 未变，两仓 `git diff --check` 通过。此前定向用例仍覆盖能力零值、可用属性投影、三并发、节点移除、stale / 403、scope / discovery / 撤权迟到隔离、30 秒不重叠调度、双权限、URL 编码、远端会话保留、结果身份和概览去重。

现场验收完成：9200 前端恢复响应；本轮未启停服务。admin 的 `POST /api/menu/user-own/tree` 首次 200 响应中 RuntimeMonitor 原有 9 个按钮均 `granted:true` 但缺 `session-query`；已沿现有菜单管理 `/#/system/ps/menu/Detail/runtime-instance-monitor → 按钮管理 → 新增`，仅补入名称“查看设备会话”的 `session-query → device-instance/query`，通过 `PATCH /menu` 单菜单实体保存，未改角色且未全 owner 同步。保存后 admin 新响应含 10 个按钮且均 `granted:true`，原 9 个按钮 JSON.stringify 完整相等；平台按钮详情复核仅勾选“设备实例 / 查询”，无其他动作。

真实页已显示设备会话 Tab 与概览“查看详情”：iot / ai 节点会话为 0 仍有本地 / 保活摘要，authentication-service 无能力不显示 Tab。浏览器复验发现 `NodeDiagnostics` 漏接概览 `session` 事件后已修复为受相同 `session-query` 与 confirmed capability 门禁保护的既有 Tab 上行契约，不直接改 router；点击“查看详情”从 `tool=overview` 切至 `sessions`。以现有设备 ID `2056276028461326336` 查询 `GET /device/instance/.../sessions` 获得 200，并显示“未查询到会话”，未推断设备离线；再次切回概览、点击详情仍进入 sessions，输入与空结果均保留；Tab 往返、切到无能力节点再返回亦保留输入与空结果。最终真实组件夹具在 960 / 640 / 360px 验证多连接原位展开、BigInt 8EB、加载保留旧结果身份、Enter 查询及 forbidden 清旧结果；360px 容器 `clientWidth` / `scrollWidth` 均为 360，无横向溢出。当前真实会话数为 0，真实非空连接仅由夹具验证，不表述为线上连接验收。截图：`runtime-ui/output/playwright/session-r1-real-query.jpg`、`session-r1-real-overview.jpg`、`session-r1-multi-connections.jpg`、`session-r1-narrow.jpg`。

#### SESSION-R2：真实通信时间与设备观测卡片

在“设备连接”中同时观察最多 5 个设备，展示真实最近通信、收发与待处理趋势。连接级 `connections[].metrics.lastCommTime` 为最近通信；会话级 `lastCommTime` 实际来自 `DeviceSession.lastPingTime()`，仅在没有连接通信时间时明确展示为“最近心跳”。时间只随真实查询结果变化，不再每秒递增“多久以前”，也不解释为最新属性上报时间；已连接时长仍可随本地时钟更新。

沿用统一运行监控壳层，采用“多设备观测条 + 响应式设备卡片 + 点击式连接浮窗”：

```text
设备连接（现有一级工作区）
[设备 A ×] [设备 B ×] [+ 添加设备]          [持续观测 / 频率]
图例选择与时间游标在设备间同步
┌ 设备 A · ID              ┐  ┌ 设备 B · ID              ┐
│ 节点 · 地址 · 连接时间    │  │ 节点 · 地址 · 连接时间    │
│ 接收 / 发送 / 吞吐 / 待处理│  │ 接收 / 发送 / 吞吐 / 待处理│
│ 四项同图与完整浮层        │  │ 四项同图与完整浮层        │
│         指标 · 单位       │  │         指标 · 单位       │
└ 点击连接入口查看完整浮窗  ┘  └ 点击连接入口查看完整浮窗  ┘
```

设备名称 / ID 远程候选选中后加入可移除观测项，不要求选择节点。每卡使用 ECharts SVG 同时展示四项指标，指标颜色跨设备一致，设备身份颜色绑定设备 ID。四项摘要与浮层速率自动换算 B/s、KB/s、MB/s，坐标轴数字单位位于图下。图例选择由宿主共享状态控制；浮层展示同一真实帧的四项指标，缺测保持未知，鼠标可穿过浮层继续移动。设备 ID 紧随名称并弱化展示。下方从全部服务节点选择已知建立时间最新的连接，摘要的节点、协议、地址及时长来自同一记录；协议直接显示在地址前，时钟图标配紧凑时长（如 1天2小时20分），悬停显示具体建立时间；不把多个服务节点的信息拼成一条连接。明细缺失时仅展示该节点真实会话字段，缺失值显示“—”。多个连接显示连接图标、数量和下拉箭头。点击后仅按服务节点分组展示紧凑连接列表，不重复设备名称、ID、采样信息和会话汇总；每条连接以地址、弱化 ID、时长及指标图标配数值呈现，标签和完整时间放在悬停提示中。采样更新保留浮窗，离开视图关闭。

卡片按最小 400px 列宽响应式排列，容器不足 400px 时收缩为一列，单设备保留相同列宽；约 1100px 区域显示两列。取消强制正方形，宽屏主体高 320px、四项读数横排；卡片不超过 420px 时读数改两列、主体高 360px。连接详情浮窗不改变卡片高度，累计收发、累计消息与丢弃等明细继续复用现有展示，不将节点级 QPS 或属性 / 事件统计推算成单设备数据。

每设备一个图区，默认同时绘制全部四项指标。接收 / 发送共用左轴 B/s，消息吞吐用右轴条/秒，待处理用右外轴条；单位在图下与轴位对应。悬停按真实时间联动，独立采样仅在半个实际采样周期内匹配最近帧，缺测帧参与匹配，保留真实采样时间。通过 ECharts ready / dispose 管理当前观测区的联动，不影响历史图。选择、采样更新、设备增减及图表重建均使用同一组指标身份；旧单指标偏好保留设备和频率，首次使用新布局默认四项全开。

方案档案：`solutionName=设备观测响应式卡片网格`；`primaryFilterSurface=现有设备候选与观测条`；`contentSurface=一设备一卡、四项同图与共享图例`；`detailCarrier=穿透式指标浮层＋全部节点连接浮窗`；`editMode=只读`；`coreComponents=DeviceSessionObservation / DeviceObservationChart / DeviceSessionViewer / Echarts`；`actionPlacement=保留添加、移除、暂停和频率入口`；`densityTarget=最多5设备、每卡4核心指标`；`sidebarMode=不新增侧栏`；`confirmationMode=用户已确认实施并提交现有PR`；`rejectedAlternatives=同图彩线对比`；`searchShellDecision=复用已有设备候选`。以设备观测网格为主视觉锚点，状态和缺测优先可见，连接详情使用点击浮窗。

数据与行为契约：

- 最近通信优先展示有效连接通信时间的最大值（完整日期在 Tooltip 中）；仅取得会话心跳时间时明确写“最近心跳”，缺失不以当前时间、连接开始时间补齐。时间只随新返回的数据变化，采样时间另行展示；不以本地计时宣称设备持续活跃。
- 复用 `GET /device/instance/{id}/sessions` 取得全部所在节点，进入页面且授权 / 能力就绪时立即查询已选设备，随后默认完成后等 5 秒，可选 10 / 30 / 60 秒；最多 3 个并发，同设备不重叠。暂停保留已完成摘要，可手动刷新全部设备；暂停时新增设备或重新进入页面仅取一次快照，随后仍保持暂停。失活暂停并保留证据，身份 / 权限变化清理，移除设备中止对应请求且禁止迟到响应回写。已确认拒绝的设备仍停止自动重试。
- 趋势为本页最近 10 分钟真实采样，从首个样本开始积累，未提供历史的接口不伪造过去曲线。接收 / 发送 B/s 与消息吞吐用同一连接相邻有效累计计数求差，待处理用真实当前值；连接身份、计数器回退或重连发生变化时不跨代求差，缺测和失败断线，不自动补零。缺字段时不显示部分连接求和为完整设备总量，保留覆盖说明；消息吞吐不是属性上报条数。
- 本地只保存设备选择与展示偏好；趋势与敏感连接数据保持页面内存态。沿用 `session-query` 菜单按钮权限和后端现有统一注解，不增加前端原始资源权限判断，不新增后端批量 / 历史接口或持久化采集任务。

实现入口：宿主 `views/link/RuntimeMonitor/DeviceConnectionsWorkspace.vue`、`device-observation/useDeviceObservation.ts`，复用既有候选查询及会话规范化；core `DeviceSessionObservation.vue`、`device-sessions/observation.ts`、`DeviceObservationChart.vue`、`useDeviceObservationCharts.ts` 与 `DeviceSessionViewer.vue`。原单设备 hook 保留兼容。`/infrastructure/dashboard` 页面、概览会话能力门控、日志 Provider、后端与服务进程均未改动。

集中验证：core 设备观测及连接回归 28/28，host 观测调度 9/9；概览呈现 14/14、Buffer 24/24 的有效证据复用。core 诊断类型检查 0 错误，host 167 项既有错误与基线归一化后逐项一致，新增 0；目标模块无独立 lint 脚本。真实页面验证立即采样、MQTT 地址、16 条连接直接展开及本地时长；正式组件示例验证 1/2/5 设备、图例及时间联动、跨节点连接归属、英文 360px 无横向溢出。测试同时覆盖同一节点多条会话分组，未知时间不伪造时长，采样更新保留阅读状态。最终模块生产构建通过（32.78s），保留既有大 chunk 提示；交付入口为 [host#352](https://github.com/jetlinks-v2/device-manager-ui/pull/352) 与 [core#195](https://github.com/jetlinks-v2/jetlinks-web-core/pull/195)。

#### DIAGNOSIS-R1：资源与 MBean 瓶颈提示（实现完成，最终验收待补）

概览使用 CPU、JVM 堆、负载和真实存在的 Buffer / 属性缓存证据，直接显示“可能哪里受限 + 排查入口”。纯规则基于连续样本，不调用模型、不自动调参或执行重置；SQL PendingSize、GC、WriterPending / Fallback 保留原 MBean 查看能力，证据不足时不输出对应瓶颈结论。

概览图表上方条件出现紧凑关注区，默认最多 3 条，优先失败队列增加、丢弃、持续堆积、资源压力；更多项按需展开。每条一句话和一个排查入口，标题合并当前关注数，保留证据单独标识。无有效结论时隐藏整个区块，不以缺数据宣称正常；入口沿用按钮权限，直接定位已有 JVM、资源趋势或完整 ObjectName 对应的 MBean。

证据与短文案的边界：

| 情况 | 首期依据 | 展示与入口 |
| --- | --- | --- |
| CPU 持续偏高 | 只接受真实、递增且新鲜的 CPU sampleTime；单点尖峰、重复 / 倒序快照不触发，负载不等同 CPU 饱和 | “应用 CPU 持续偏高，可能存在计算热点”→ JVM；系统 CPU / 负载提示 → 资源趋势 |
| JVM 内存压力 | 复用概览 30 秒轻读的 HeapMemoryUsage.used / max；max 缺失或无效不诊断，内存不借用 CPU 时间 | “JVM 堆持续偏高，可能存在内存压力”→ JVM；不直接断言泄漏 |
| 队列处理跟不上 | 同一完整 ObjectName 的待处理持续增长，或持续未回落且仍有新写入；结合近期处理批次耗时、在途情况 | “{队列} 持续堆积，处理可能跟不上写入”→ 对应队列 |
| 数据库写入处理受限 | 精确生产 writer 身份 + 持续堆积 + 近期慢处理桶增量；out 是处理尝试，不是成功量，SQL PendingSize 不代表连接池等待 | “TimescaleDB 写入处理可能受限”→ 精确写入 Buffer；不推断数据库服务端故障或连接池耗尽 |
| 失败队列增加 | DeadSize 在有效区间的净增加；存量和未变化的 LastError 不当作当前新故障，nil / 空串表示无错误 | “{队列} 失败队列增加 {数量} 条”→ 对应队列；不冒充精确新增写入失败次数 |
| Buffer 淘汰 | Monitor.dropped 在有效区间增加，单独呈现，不与失败队列混算 | “{队列} 新增丢弃 {数量} 条”→ 对应队列 |
| 属性缓存落盘受阻 | ThingsDataManager 的 DirtyCount / QueueDepth 持续增长且提交停滞 | “属性缓存落盘可能跟不上”→ 对应 MBean；InMemorySize 大本身不是异常 |

持续压力要求不少于 3 个有效样本且覆盖至少 60 秒；CPU / 堆参考阈值为 80% / 90%，恢复需低于 70% / 85% 持续 30 秒，灰区状态不会因有界历史淘汰而自行解除。60 秒 Buffer 频率按真实完成间隔取至少 3 点，失败队列与丢弃使用边界有效基线计算增加量。缺属性只影响依赖它的规则；暂停、缺测、重连、计数回退及 reset 代次打断连续窗口，旧发现保留但明确标识。累计错误与历史耗时桶不冒充本次问题。

采集沿用页面实时资源流、`useClusterBuffers` 及节点概览轻读；没有第二套 Buffer 轮询。堆轻读与现有 operational 请求同轮完成后等待 30 秒，不自动调用 `takePending`、线程导出或重置。`visDashboard/SystemMonitor/utils/realtimeResourceData.ts` 仅新增可选 `cpuSampleAt` 投影；保留原指标、health 语义及旧 dashboard 页面。CPU 源时间过旧或异常未来值打断窗口且不污染已接受基准，少量时钟偏差采用一致的新鲜度判断。

实现入口为宿主 `views/link/diagnostics/diagnosis/{bottleneckRules.ts,bufferEvidence.ts,useNodeBottlenecks.ts,NodeBottleneckHints.vue}`、`useNodeOperationalSignals.ts`、`RuntimeMonitor/useClusterBuffers.ts` 以及 NodeOverview / NodeDiagnostics 接线。展示组件不请求 API；关联使用节点、完整 ObjectName、采样时间及重置代次。切工具和节点保留证据，撤权 / 身份切换清理；不追加前端原始资源判断或自创后端权限机制。

集中冻结检查：宿主测试 214/214、core 测试 182/182；模块构建 27.03s、exit 0；core 诊断 vue-tsc 为 0 错误；宿主仍为 167 条既有错误，与本轮 baseline 规范化比较 0 新增 / 0 移除。工程无独立 lint 脚本，未声明 lint 通过。日志为 `/tmp/session-r2-diagnosis-r1-{host-tests,core-tests,build,types-final,core-types}.log`。用例覆盖持续与恢复、真实 CPU stamp、独立 30 秒堆、60 秒 Buffer 频率、缺字段、暂停、reset、历史错误 / nil 与精确计数。

异常 UI fixture 第一轮确认默认 3 条、更多项展开、精确 MBean / JVM 入口、正常时隐藏及权限隐藏；fixture 为测试数据，不制造生产故障。真实页面主要交互的两轮走查见 SESSION-R2。最终构建后追加刷新遭遇 9200 超时与浏览器暂卡，恢复后的完整 UI 验收待总控回填；当前不能声明整体最终验收通过。本轮未启停服务、提交或推送。

#### UI-WORKSPACE-R1：统一运行监控工作区（交互重设计待确认）

目标：将现有运行监控、链路追踪和设备连接收敛到一个运行监控工作区。一级 `SlantedTabs` 只承载“集群监控 / 链路追踪 / 设备连接”；集群内部保留概览、JVM、MBean、日志，Trace 的多链路标签降为正文内次级导航，设备连接改为全群只读视图，不再是节点工具。采用“监控感知主壳 + 集群主从详情工作区”：首屏以当前视图的真实状态区为唯一视觉锚点，节点侧栏只在集群视图出现，根路由不渲染 PageHead，不增加 KPI 墙、第二排同级斜角标签、大型选择弹窗或旧仪表盘入口。

宿主范围为 `runtime-ui/modules/device-manager-ui` 的 RuntimeWorkspace、RuntimeMonitor、Tracing、diagnostics、API、菜单/注册、locale、测试及本文件；core 增量仅限 DeviceSessionViewer、DTO 类型及公共 locale，不改其他 core、旧 DashBoard/visDashboard、后端、原始资源权限、角色或菜单全量同步。`RuntimeMonitor` 各按钮与 `Tracing:query` 继续独立判断；`session-query → device-instance/query` 仍是设备连接唯一菜单映射。RuntimeMonitor 已授权时隐藏独立 Tracing 导航但保留其菜单身份；仅有 Tracing 授权时仍以“运行监控”入口承载 Trace，不伪造 RuntimeMonitor 权限。

实施计划：1) 扩展菜单过滤和路由归属，统一 `view=cluster|tracing|connections`，兼容旧 tracing URL 及 `tool=sessions` 深链；2) 建立外层工作区壳及每视图独立 query/滚动快照，一级切换不进入节点 KeepAlive key；3) 将工作区“仍挂载、同身份保留证据”与“当前视图可采集”分离，失活只取消在途/暂停周期，项目、scope、撤权才清节点、会话和 Buffer 证据；4) 以集群能力快照驱动全群设备连接，保留跨节点记录，并在宿主实现可粘贴 ID、远程候选和选择即查；5) 以定向测试验证切换、trace-only、旧地址、节点缓存、能力与远程竞态。工作区使用 `useRuntimeWorkspace.ts` 隔离各视图 query 与 ContentPanel 滚动；集群目录属于整个根工作区，节点/工具仅在 cluster 激活时消费 URL。节点 KeepAlive key 仅包含 scope/权限，一级切换不销毁缓存。会话能力为全群任一精确 MBean 确认支持即成立，未知不等于 absent，零值有效；会话和 Buffer 采样以独立 permission ref 区分暂停与撤权，并在暂停时替换 job 身份拒绝恢复后的迟到响应。Trace 多结果使用 32px Ant editable 次级 Tabs，当前 Trace 视图及结果 Tab 双门禁控制展示活动；旧 tracing 地址仅在有 RuntimeMonitor 菜单时迁移，Trace-only 保留原已注册路由。


宿主当前结论：全群全部确认 absent 时隐藏设备连接入口，但明确深链保留 unsupported 状态；未知能力等待发现，不静默改写用户定位。连接正文在既有 section 上使用单层白底、16px 内距、8px 圆角，Trace 白色正文填充剩余高度；集群继续沿用节点栏与详情各自的背景。

宿主集中验证：`node --test tests/runtime*.test.mjs` 为 169/169，通过日志 `/tmp/runtime-workspace-r1-final-host-tests.log`；覆盖一级视图 query/滚动隔离、隐藏集群节点/工具保留、旧 tracing 与 sessions 深链、Trace-only 菜单与英文标题、全群能力未知/absent/零值、暂停恢复后迟到回写拒绝、显式撤权及隐藏 Trace scope 清理。概览“查看详情”通过根工作区导航合并设备连接快照，仅覆盖 nodeId，保留已提交 deviceId；回归同时验证目标视图授权与集群 query 隔离。最终 17 个相关 SFC 脚本、模板和样式全部编译通过（`/tmp/runtime-workspace-r1-final-sfc.log`）。设备连接节点过滤仅由当前激活视图的 route.nodeId 更新，不再由临时空节点目录派生；回归覆盖 Trace 往返及 nodes=[] 刷新期间保持过滤与展开身份。`vue-tsc --noEmit -p tsconfig.runtime-diagnostics.json` 显式覆盖根壳、新 hook 与菜单过滤，仍为 167 条既有平台错误；相对 `/tmp/ui-mbean-r1-host-types-baseline.log` 规范化 0 新增/0 移除（`/tmp/runtime-workspace-r1-final-host-types.log`、`/tmp/runtime-workspace-r1-final-type-diff.log`）。中英文 RuntimeMonitor 各 38 个键一致、无重复，`git diff --check` 通过。core 冻结证据为 164/164（`/tmp/workspace-r1-core-tests.log`），49 个保护文件未变。工程无独立 lint 脚本；未声明 lint 或全量类型检查通过。

上一固定制品模块生产构建成功（34.52s、exit 0，`/tmp/runtime-workspace-r1-final-build.log`），保留既有 `>2000kB` chunk、静态资源及模块插件提示。实际构建参数使用目录名 `--module-name device-manager-ui`；包元数据中的 device-manager 不能作为该配置的模块目录名。本轮未启停服务、提交或推送，commit/PR 尚未生成。

总控真实浏览器已确认一级三个 Tab、独立 Tracing 菜单隐藏、名称/ID 联想与设备精确查询成功；设备 `2056276028461326336` 返回 16 条真实连接。一级往返保留设备结果与展开状态，未重复查询；节点过滤不触发请求，MBean 节点与 bean 选择恢复。旧 tracing 地址及 `tool=sessions` 规范化通过，概览“查看详情”回设备连接保留 deviceId，仅覆盖 `nodeId=iot-service:8200`。设备连接 post 时序修正的最终实页复验记录见下段；界面重设计另行验收。

设备连接时序修正已通过：路由先变化而父组件尚未更新子组件 active 时，sync watcher 曾读取 Trace 的临时无 nodeId 参数，导致 core 清除展开状态；节点过滤 watcher 改用 post，等待父组件视图渲染完成后再消费路由。`tests/runtimeDeviceConnectionsWorkspace.test.mjs` 定向 8/8，通过真实 route 先变、随后父子 active 更新的顺序回归。总控在 18:59:30 的真实快照确认 16 条连接，AX 确认已展开后切换 Trace 再返回，仍为 expanded 且保留连接 `36275b61`，快照时间戳不变、无重复请求。该 post 修正后尚未追加生产构建；前述构建证据仅属于修正前固定制品。

用户最新要求重新设计最外层 Tab 的平台一致性，并移除 Trace 嵌套 Tab。当前暂停新源码、追加构建和整体完成标记，待新交互方案确认后在本段更新同一实施计划；上述设备连接行为证据继续保留，不替代后续界面重设计的验收。

#### UI-WORKSPACE-R2：统一面板 + 最近查看链路（实现完成，保留运行风险）

采用“统一监控面板 + 单链路正文 + 最近查看 Popover”：外层沿设备列表的 `PageChrome flush + SlantedTabs + ContentPanel`，三个一级入口直接贴合连续白底，取消透明间隙和内部第二层圆角面板。Trace 只保留一级 Tab，调用树与时间轴为主正文，工具栏 32px、摘要一行，窄屏允许自然换行。

```text
[集群监控][链路追踪][设备连接]  ← 平台 SlantedTabs，直接贴合白底
┌────────────────────────────────────────────────────────────────────┐
│ [Trace ID / traceparent          ][查询] [最近查看 3 ▾] [刷新] [帮助] │
│ GET /device/instance/_query  [ID 复制]   84.6ms / 8Span / 3节点 / 1异常│
│ 调用名 / 节点 / 关键标签            时间轴（耗时写在色条内）         │
│ ▾ HTTP GET /device/instance/_query  ━━━━━━━━━━━━━━━━━━━━━ 84.6ms     │
│   ▸ Authentication/query             ━━━ 17.2ms                     │
│   ▾ DeviceInstance/query                  ━━━━━━━━━━━━━ 52.4ms      │
│     选中调用的属性与证据在行内展开，并沿调用名起点对齐               │
└────────────────────────────────────────────────────────────────────┘
```

Trace 是按 Trace ID / traceparent 精确查找，沿用 Ant InputSearch，不引入 ConditionFilter / ProSearch。查询为唯一 primary，刷新为图标，最近查看与帮助为轻按钮；Popover 记录支持选择 / 关闭、新查询加入，每条链路独立保留输入、展开和滚动。详情原位展开，节点与关键标签置于调用名下，耗时写在时间条内。不增加嵌套 Tab、空 Tab、双栏比较、KPI 卡墙或新的采集动作。原型 `runtime-ui/jetlinks-web-core/tests/runtime-workspace-navigation-v2.html` 为经用户确认的静态示例，不接 API；原型标记不进入产品界面。

链路尚未查询时恢复居中搜索首屏：简短标题、说明与大搜索框集中展示，获取 ID 的三类图文指导直接位于搜索下方；隐藏“最近查看 0”、禁用刷新和空态插图。已有查询（包括加载、空结果和失败）仍使用顶部紧凑工具栏；有历史记录时保留最近查看，搜索框不因首屏 / 结果切换而重新挂载。改动限 `views/link/Tracing/index.vue` 的空态布局，不调整请求、权限、路由与链路缓存。真实页面已核对常用与 760px 窄屏、Chrome 图文指导、切换视图关闭指导、查询后恢复紧凑工具栏与关闭记录返回居中首屏；所用历史 ID 返回空结果，未据此声明新的有效链路数据验收。宿主 runtime 测试 219/219，模块构建通过（28.25s），类型检查保持 167 条既有错误、0 新增，`git diff --check` 通过。截图：`runtime-ui/output/playwright/runtime-tracing-centered-search.jpg`。

设备会话按设备 ID 查询全部所在节点：`RuntimeMonitor/DeviceConnectionsWorkspace.vue` 不再提供节点筛选，core 始终接收空 `node-id`，旧节点深链不约束结果；`useRuntimeWorkspace.ts` 的 connections query 仅保留 `deviceId`。`RuntimeMonitor/SessionOverview.vue` 以紧凑一行展示已采集会话记录、持久保活与采集覆盖，Popover 查看节点分布和采样状态；`RuntimeMonitor/sessionOverview.ts` 复用 `NodeSessionSnapshot` 作 BigInt 精确汇总，不新增 API 或采集循环。会话数为各节点本地会话索引记录数，不代表去重在线设备或实际网络连接；持久保活单独统计，不与会话数相加。当前有效值分别汇总并标明已采集节点，覆盖仅计两项都完整的节点；缺测、失败、不支持不补零，过期值只保留在节点行。

权限与恢复：`diagnostics/useDiagnosticsAccess.ts` 的 sessions 只检查运行监控菜单和 `session-query` 按钮，统计仍单独受 monitor 权限控制，后端负责最终鉴权。无 monitor 时保留未知支持态，仅允许独立会话授权尝试端点，明确不支持仍阻止。`DeviceConnectionsWorkspace.vue` 在门禁失效时丢弃在途消费代次；明确不支持、撤权或真实结果清空同时失效完成键，支持恢复后可重新查询。暂时未知与视图隐藏保留已完成证据，取消请求的迟到回执不能覆盖新查询。回归使用真实 access、`useDeviceSessions` 与 `useDiagnosticQuery`，只替换 store / transport 边界。

最终验证：宿主 runtime 全套 190/190 通过（`/tmp/runtime-workspace-r2-final-host-tests.log`）；目标类型检查仍为既有 167 条，规范化比较 0 增 0 减，受改 Runtime / Tracing / diagnostics / store 路径无错误（`/tmp/runtime-workspace-r2-final-host-types.log`）。最后模块构建 26.94 秒成功，覆盖两项权限 / 恢复审查修正和 Trace 容器换行，保留既有 `>2000kB` chunk 警告（`/tmp/runtime-workspace-r2-final-build.log`）。工程无独立 lint 脚本，不将上述结果记作 lint 通过。Trace 47 键、RuntimeMonitor 48 键的中英文集合一致且无重复；Trace 8 文件、core 7 文件 freeze 校验通过，原仪表盘 3 文件与 HEAD 一致。独立复审无剩余 P1 / P2。

真实页面验收：1396px 下外层 Tab 底部 y=104 与 ContentPanel 顶部 y=104 贴合，节点栏宽 280px；1218px 下按既有阈值收起节点栏，日志正文宽 922px，概览 / MBean / JVM / 日志无全页横向溢出。760px 下 Trace 工具栏自然两行且完整容纳，页面宽度与视口均为 760px，临时视口已恢复。真实 Trace `a172d1dfc66fac061f777fbeff90661c`、`a172d1dffedbc9c9a7c6af2e257a4615` 均成功返回 5 Span / 2 节点；最近查看选择后关闭并回焦，返回前一条保留详情展开和输入草稿。截图为 `runtime-ui/output/playwright/runtime-workspace-r2-tracing.jpg`。

运行风险：设备 `2056924084996218880` 曾成功返回 16 条真实连接，19:50:39 快照的展开状态在跨 Trace 往返后保持且没有重复请求；两项审查修正后的最后查询约 15 秒超时，刷新重试同样约 15 秒超时，当前环境该端点不可用，不能将先前成功替代最终查询验收。页面错误与重试入口已验证，截图为 `runtime-ui/output/playwright/runtime-workspace-r2-session-timeout.jpg`，之后未再重试。历史 Trace `a172a5587e565a18764146af93ae55ca` 也曾约 20 秒超时；后端和开发资源存在偶发慢响应，本次未改服务、后端查询或错误隔离策略。未启停服务、提交或推送。

#### UI-OVERVIEW-R3：概览信息聚焦（已完成）

目标是在既有集群监控壳层内，优先回答“会话数量怎样变化、设备属性缓存规模怎样变化、异步 Buffer 是否持续积压”，减少并列字段与长图例。用户已确认执行；Owning module 为 `runtime-ui/modules/device-manager-ui`，通用 Buffer 展示边界为 `runtime-ui/jetlinks-web-core/src/components/RuntimeDiagnostics/buffer/BufferOverviewChart.vue`。本阶段落实生产展示与页面采样，不修改后端、原仪表盘、菜单声明或服务进程。

最新实施约束：只有精确 `org.jetlinks:type=DeviceSessionManager` 能力确认存在且具有运行监控菜单 / monitor 按钮权限的节点，才显示会话和设备属性缓存两幅轻趋势；零值有效，未知、不存在和禁止状态不推造能力。缓存读取同时受该会话能力门控，并独立确认 ThingsDataManager 的真实数据能力；缺失属性或读取失败不补零。属性缓存保存设备最新 / 前次上报属性供规则引擎、场景联动等使用，主指标为 `InMemorySize = l1Cache.size()`，表示 L1 条目数，不能称为字节、设备数或待处理消息数；`DirtyCount = dirtyKeys.size()` 仅作次级待刷盘说明，一个属性键可合并多次更新，不能与 `QueueDepth = dirtyQueue.size()` 相加。`LastCommitTime` 是实际提交时间，空闲不推进不是故障；`LastFlushDuration` 为上次刷盘耗时。

推荐方案为“监控感知页：聚合趋势 + 按需明细”；替代方案“两张常驻图并列展示堆积和速率”会继续争夺有限宽度，因此不采用。结构如下：

```text
节点标题 / 状态 / 启动信息                  （保留）
运行概览 / JVM 诊断 / MBean / 日志           （保留）
设备会话记录 ⓘ [查看连接]     设备属性缓存 ⓘ [查看详情]
当前值 + 近10分钟短趋势       当前L1条目数 + 近10分钟短趋势
本地会话索引记录             规则与场景读取最新 / 前次属性值
Buffer 队列 ⓘ                 [堆积|吞吐] [按队列] [设置]
待处理 0 条                   写入 128/s · 处理尝试 136/s
                  聚合趋势主图
队列明细 5 ▸                 已采集 5/5 · 10秒采集
历史趋势                     [时间范围] [刷新]
```

方案档案：业务任务为快速识别会话变化、内存属性缓存规模变化和异步 Buffer 积压；主筛选沿用节点与历史时间，不增加 ConditionFilter / ProSearch。首屏只保留会话 / 缓存短趋势、Buffer 主图、既有资源历史三个区段，Buffer 是主要视觉重点；无编辑入口。累计写入、处理尝试和单队列重置只在队列明细中呈现；操作沿用当前授权和确认机制。会话与缓存共同要求当前节点精确 DeviceSessionManager 能力，缓存还要求精确 ThingsDataManager 能力；不将会话记录当作去重在线设备数。主题、订阅者和累计采集计数留在 MBean；事件同步、缓冲和采集仅在具备当前关注证据时提示。

默认主图显示全部有效队列的聚合待处理量或吞吐，不并列常驻五个长队列名与十条曲线。启用“按队列”后使用图例选择队列、悬浮显示完整名称与数值，保留现有 ECharts 选择身份和缩放规则。待处理与失败留存不混为一个健康判断；处理尝试速率不命名为成功处理速率。当前汇总严格覆盖当前已知、已选择的队列身份；任一身份缺字段时总量保持未知并展示采集覆盖，不显示部分总量，不补零、不宣称无堆积。正常零值、异常和缺测有独立表达。

核心组件候选保持 `PageChrome`、`SlantedTabs`、`ContentPanel`、Ant Button / Tooltip / Popover / Collapse 和 ECharts SVG；内部信息沿用 MBean 定位事件。节点侧栏维持既有两级选中与收起行为；不引入新侧栏、悬浮按钮、KPI 卡墙、嵌套面板、常驻原始字段和说明段落。状态先于字段，异常以颜色加文字表达，不使用单侧色条。静态原型为 `runtime-ui/jetlinks-web-core/tests/runtime-overview-focus.html`，明确标注示例数据；该原型尚保留前版 DirtyCount 主值，本轮优先落实生产实现，未同步原型，当前口径以本节生产源码为准。

实施顺序：拆分 Buffer 聚合展示与明细，宿主复用唯一页面级会话采样并增加缓存 30 秒非重叠采样，保留最近 10 分钟真实页面趋势，收敛内部结构计数，补齐 i18n 与偏好兼容，最后集中验证采集生命周期、能力零值 / 缺测 / 恢复、图例选择、重置门禁以及跨节点 / Tab 数据保留。局部失活只暂停 / 取消采集并隔离迟到回执，不清已有证据；身份、权限、节点移除才清理对应证据。首次样本说明正在积累，缺测断线，保留值明确过期，Java long 不经不安全 number 转换。风险是聚合可能掩盖单队列差异，因此保留明细入口与按队列图例；重置仍为单队列范围。集中测试 / 类型 / 构建及真实页面验收结果已回填。

前版示例原型验证（不代表本轮生产验收）：JavaScript 语法与重复 ID 检查通过，IAB 无 error 日志。会话 / 缓存修订后在 1280 / 760 / 390 宽度完成走查；760 保持两列、390 自然单列且无全页横向溢出。口径说明弹层在桌面和窄屏完整位于视口内，Esc 关闭后回焦；正常、趋势变化、缺测三个状态均可切换，缺测显示“未采集”、保留先前图形且不冒充当前值。Buffer 指标切换、图例全取消空提示、队列明细、采集设置和重置确认取消路径沿用前版已验证交互。当前桌面截图：`runtime-ui/output/playwright/runtime-overview-focus-signals.jpg`。这些是前版本地示例交互，不调用真实 MBean 或采集接口；当时只更新 HTML 原型和本文档，未执行生产构建。该示例仍以 DirtyCount 为缓存主值，尚未同步本轮 InMemorySize 生产语义，不作为本轮正式功能验收。

会话与缓存的信息层级修订：用两幅并列、无卡片外框的轻量趋势替代常驻内部计数行，分别呈现“设备会话记录”和“设备属性缓存”（InMemorySize 内存条目）。每幅只突出当前值、观测窗口内变化、短趋势和一行含义说明；会话可跳转设备连接，缓存可定位 ThingsDataManager MBean。Buffer 仍是主要趋势区，资源历史保持原位。主题数、订阅者数和累计采集失败数退出默认概览，仍可在 MBean 查看；事件缓冲、同步失败增量或采集失败只在具备当前证据时提供关注提示，不依据累计值直接判定异常。

数据口径以生产者为准：`PersistenceDeviceSessionManager.DeviceSessionMBeanImpl.getSessions()` 返回 `localSessions.size()`，是当前节点会话索引记录数，不能称为去重在线设备数或真实网络连接数；`getKeepOnlineSize()` 为持久仓库记录，单独展示且不能相加。`LocalFileThingsDataManager.ThingsDataManagerMBeanImpl` 的 `DirtyCount` 为去重的 `StoreKey(thingIndex, propertyIndex)` 数，`QueueDepth` 为 `dirtyQueue` 项数，`InMemorySize` 为一级缓存条目数，三者不相加，也不代表设备消息量或字节数。`flushNow()` 在提交前会移出待刷盘集合，因此 DirtyCount 为零也不能单独证明所有在途提交已经完成。`LastCommitTime` 只有实际提交后才推进，空闲期间不推进不等同故障；`LastFlushDuration` 是最近一次刷盘过程耗时，不等同当前数据等待时长。

当前实现：`RuntimeMonitor/useClusterSessions.ts` 仍是唯一会话采集者，为 `NodeSessionSnapshot` 添加十分钟有界真实观察；`diagnostics/useNodeMetrics.ts` 将精确会话支持态传给 `useNodeOperationalSignals.ts`，后者在概览激活且 monitor 授权下完成一次后等待 30 秒再读三个轻量来源，ThingsDataManager 读取必须额外确认会话能力。事件来源只投影当前缓冲与同步等待，采集器只投影最近失败 / 成功时间，不周期读取拓扑、累计失败或完整异常。缓存主值投影为 InMemorySize，DirtyCount、QueueDepth、LastCommitTime、LastFlushDuration 只放帮助详情；ThingsDataManager 不存在时隐藏缓存趋势，存在但属性不可得显示未采集，失败保留的值明确标记为上次值。`diagnostics/overview/{gaugeHistory.ts,useOverviewTrends.ts,NodeGaugeTrend.vue}` 负责精确计数、有界样本、门控与 ECharts SVG 展示，目录按概览职责归域，避免继续向已有 MBean / JVM / 日志混合目录平铺。页面未访问期间不伪造样本，暂停与缺测留下断点，首次点说明正在积累；跨节点和工具保留证据，身份 / 撤权清空，节点移除清理对应证据，取消后的迟到回执按代际隔离。所有计数保留 Java long 十进制精度，不安全 number 按未知处理；图形几何仅缩放差值，悬浮与当前值始终显示精确计数。已有至少两个时间点时，图形使用真实首末观察区间铺满绘图区，尚未积累满十分钟不留伪历史空白；单点仍明确采集中。

`NodeOverview.vue` 保持资源回退、资源历史、既有会话 / MBean 定位事件与 Buffer 重置边界；通过 `preferences.ts` 白名单持久化 `bufferGrouping=aggregate|queues`，未记录选择继续跟随全部，明确空选择仍表示全部关闭，原过滤 / 刻度 / 队列偏好兼容。中英文简短帮助说明属性缓存供规则引擎、场景联动读取最新 / 前次上报属性，按本节点“物实例－属性”内存条目计数，趋势来自页面采样。帮助层最大宽度 360px 且受视口约束，最大高度受视口约束并允许滚动，四项真实次级事实保持紧凑。全部持久缓存、设备数、字节数或消息积压均非此指标含义；本地缓存与异步 Buffer 的范围分开，空闲提交时间不推进不判故障，这些深入边界保留在本文。

宿主聚焦验证：`node --test tests/runtimeOverviewTrends.test.mjs tests/runtimeClusterSessions.test.mjs tests/runtimeDiagnosticsPreferences.test.mjs tests/runtimeDiagnosticsOverview.test.mjs tests/runtimeDiagnosticsControllers.test.mjs` 首批五套 50/50 通过；集中验收后正确收窄旧节点 watcher ID，并更新刷新职责断言、增加共享会话刷新行为用例，连同 `runtimeNodeBufferDetails`、`runtimeDiagnosticsMetrics` 与 `runtimeClusterSidebarLayout` 八套最终 71/71 通过（`/tmp/runtime-overview-r3-host-focused.log`）；三个宿主 SFC 的 script / template / scoped style 编译通过，18 个概览中英文键集合一致，模块 `git diff --check` 通过。测试执行真实 composable / 归一化 / 偏好代码，只替换 transport 与授权上下文，覆盖精确能力、零值、不存在 / 禁止 / 恢复、缓存读抑制、部分属性、长整型、首点 / 缺测 / 十分钟边界、非重叠采样、节点 / Tab 保留、身份 / 撤权清理和迟到回执隔离。未新增后端历史、菜单 / 按钮权限或自动处置，未启停服务。

集中源码验证：宿主 runtime 全套 203/203、core runtime / trace / retainedScroll 全套 172/172 通过。宿主诊断 `vue-tsc` 复查仍为 167 条，与既有基线完全一致、无新增；core 诊断 `vue-tsc` 通过。模块生产构建成功，27.47 秒；最后帮助文案 / 弹层样式微调后，目标 SFC 编译及语言检查通过；总控最终类型复验仍为 167 条且与基线完全一致、无新增。宿主与 core 四个语言文件无重复键。两仓 `git diff --check` 通过，原 DashBoard 11 个保护文件 hash 全部相同。工程未配置 lint 命令，未宣称 lint 通过。

真实浏览器已验证：IoT 节点会话 1 / 内存属性缓存 18；ai 节点会话零值有效且无 ThingsDataManager 时不显示缓存；未知能力网关不显示两幅趋势；另已在真实无会话能力的 `authentication-service:8100` 验证侧栏没有会话计数、启动信息正常加载，`visibleTrends=[]`，会话与属性缓存两区均隐藏。节点往返保留曲线，缺测值明确标为“保留上次值 · 当前缺测”。Buffer 聚合 / 按队列切换、图例全关闭空提示与全选恢复、队列明细无分页均已验证；重置确认展示精确单队列目标和统计范围，已取消，未执行重置。

最终真实验收完成：验收期间曾发生 9200 整站失联，`localhost` 5 秒 curl 超时、HTTP 000；随后服务自动 / 外部恢复 HTTP 200，已通过新 tab 16 完成实际页面验收，当前无此阻塞。智能体未更改或重启服务。1280×720 视口中精简后的缓存帮助层为 360×216，位置 x824 / y234、底边 450，完整位于视口内；760×853 视口中主区宽 464、趋势单列宽 464，`document.scrollWidth=760`，无全页横向溢出，帮助层位置 x172 / y201、大小 360×216、底边 417，同样完整显示。

真实第二个 30 秒样本已产生，会话和属性缓存趋势均显示变化与 SVG 曲线。点击缓存详情精确定位 `bean=org.jetlinks:name=LocalFileThingsDataManager,type=ThingsDataManager`，真实 55 个 MBean 对象成功加载。MBean 工具往返及外层 tracing 视图往返后，会话 / 缓存旧曲线保留，暂停段形成断点，当前值未清空；恢复后缓存继续获得连续 30 秒样本。最终浏览器 error logs 为空，验收视口已恢复，tab 16 保留用于交付。真实最新源码截图：`runtime-ui/output/playwright/runtime-overview-r3-production.jpg`；窄屏及精简帮助截图：`runtime-ui/output/playwright/runtime-overview-r3-narrow.jpg`。本轮源码与实际页面验收完成，未要求或新增真实重置执行。

#### 后续交互方案：标题栏控制侧栏、监控区块统一、日志阅读优先（已完成）

本次只交付设计稿，不替换正式运行监控。采用“主从详情工作区 + 监控感知”方案：`[节点栏开关] [节点名 ▾] [健康状态] [启动 / 时长] [设置] → 工具 Tab → 当前资源 / Buffer 趋势 / 历史趋势`。首屏以异常与趋势为主，白底单层区块、统一标题与间距，不增加 KPI 卡或说明横幅。侧栏开关固定在标题前的正常文档流中，展开 / 收起都在相同位置；节点栏隐藏后空间完整让给正文，单节点隐藏入口，窄屏使用节点选择。现有 EqualHeightColumns 的中缝悬浮按钮不适合本页；本页采用受控网格与现有布局 hook，保持 KeepAlive 节点 / 工具缓存位置，不修改共享组件或其他页面。相比抽屉方案，常规左右布局便于对照节点；抽屉只作为窄屏备选，不作为桌面主交互。

概览按三层组织：资源摘要仅在侧栏收起 / 单节点时补位，系统 / JVM / 磁盘 / 网络保持同一行高、数字格式与容量条，线程 / GC 归入 JVM，不独占松散一行；颜色与已有健康证据一致，普通用量不制造新的告警语义。Buffer 区标题只保留“堆积 / 吞吐”轻量切换，刻度、采样频率、队列批量选择和单队列重置移至更多菜单，重置仍受原权限及 canonical 单队列确认约束；ECharts 图例继续直接切队列，汇总范围跟随可见队列。保留累计写入、处理尝试、待处理 / 失败及可得的速率，未知不补零；零值表示没有堆积，缺测仍留断点。图例 / 坐标 / 标题与历史图统一，无堆积时保留趋势而不显示巨大伪空态。历史的时间范围采用 ConditionFilter 的既有时间能力，以无边框文本入口承载，和刷新 / 更新时间同属标题右侧；各图图例、单位和缩放操作统一位置，不把低频工具常驻成多排表单。

文件“跟随”当前为手动开启后先读最新窗口，再每次请求完成约 3 秒后 stat + 向前增量读取；查找、翻阅或失活会停止，归档不可跟随。保留这个排障能力但更名“持续更新”，放在底部状态栏，默认关闭；暂停时保留位置，恢复时读最新窗口，有活跃请求 / 最近更新时间反馈。归档不显示不可用的更新开关。控制台的服务端流接收与自动滚动分开表达，不与文件轮询混用同一“跟随”文案。日志顶部使用文件 / 控制台轻量 Tab、文件名文本入口、级别文本筛选及查找图标，查找栏按需展开，换行 / 下载归入更多；不同时常驻 radio、Select、Switch 和输入框。上述改动仅涉及 runtime-ui 宿主诊断与 core RuntimeDiagnostics 展示，原仪表盘、后端、权限声明和日志 Provider 暂缓迁移边界不变。

交互设计稿入口：core `tests/runtime-monitor-refinement.html`（独立示例数据，无服务端请求）。正式实现验收范围：标题开关不覆盖图表、折叠与响应式不重建缓存、Buffer 图例 / 刻度语义不变、查找 / 暂停 / 恢复更新不抢阅读位置、归档与控制台区分、键盘 / 窄屏可用，再集中进行定向回归、类型基线比较与模块构建。当前设计稿验收不代替生产页面验收。

设计稿已通过脚本语法及 diff 检查，并在 IAB 核对标题开关始终落在标题矩形内、无绝对定位按钮与横向溢出；Buffer 指标切换、日志按需查找且暂停更新、归档只读不显示持续更新入口、控制台等待显式开始。截图位于 runtime-ui `output/playwright/runtime-monitor-refinement-{overview,logs}.png`。设计稿仅演示布局与本地交互，不表示已实现真实采集、完整诊断工具、时间查询或菜单中的服务端动作；本阶段未修改正式组件，也未重复执行生产构建。

日志阅读工作台采用顶部文件选择：`[文件 / 控制台] [当前文件 ▾] [刷新 / 下载] [查找] [级别 / 跟随 / 换行]`。点击当前文件展开有界目录浮层，沿用已有目录的上级、面包屑、大小、修改时间和独立请求状态；选中文件关闭浮层，Escape 关闭并回焦入口，失活 / 切控制台自动关闭。目录不再常驻占用正文列，常用工具采用统一小尺寸控件，宽度足够时一行，窄屏和查找命中导航允许自然换行。节点工作台复用产品 / 设备列表已使用的 EqualHeightColumns 折叠交互；收起节点栏时右侧铺满，当前节点选择并入详情标题，保留状态、生命周期与诊断数据。仅一个节点不显示节点选择和折叠入口。范围为 runtime-ui 的日志展示、工作台布局与必要 slot，不改数据请求 / 鉴权 / 采样，不重建节点或工具缓存；原仪表盘不动。复用 Ant Popover / Button / Input 与现有 LogViewer、LogFileExplorer，目录和正文无嵌套卡片，不引入 CRUD 筛选壳或额外说明区。实现入口为 `views/link/RuntimeMonitor/{index.vue,useClusterSidebarLayout.ts}`、`views/link/diagnostics/{NodeLogPanel.vue,useLogExplorerLayout.ts}` 与 core `RuntimeDiagnostics/LogViewer.vue`；`node-name` slot 只替换标题节点名称，不搬动 KeepAlive 工作区。

日志高度由 `useLogWorkspaceLayout.ts` 按未滚动的布局位置、可见视口及祖先底部留白计算；正文 / 状态区阻止边缘滚动传递，不在外层滚动时反向增高。仅修正阅读区布局，保留边缘加载、跟随及阅读位置恢复。定向回归 host 9/9、core 14/14，core 类型检查 0 错误，host 167 项既有错误无新增，模块构建通过（39.08s）；真实页面 1280×720 和 760×600 连续下滚、向上阅读及工具往返后，页面高度均等于视口且底栏完整可见。

紧凑布局验收：宿主定向 56 项、core 日志 14 项通过；core 目标类型检查通过，宿主仍为原有 167 条且没有新增诊断。工程未配置 lint 命令，使用 SFC 编译与 `git diff --check` 检查；模块构建通过。真实 IAB 已核对目录打开焦点 / Escape 回焦、归档选择收起、控制台显式启动，以及节点与工具往返：IoT 归档的 450 条、ERROR 查找和 scrollTop=26785 在切换规则引擎再返回后保留。1396px 视口下节点栏收起使日志宽度由 802px 增至 1098px，1019px 视口下长文件名仍为一行 37px 工具栏，760px 视口下自然换行；更窄工作区的匹配导航单独换行以避免裁剪。折叠状态在宽窄屏往返保留，概览恢复资源摘要且无横向溢出。目录请求曾发生既有网络超时，保留正文并可重试；未将其记为接口成功。原仪表盘等 49 个受保护文件 hash 全部未变。单节点省略入口通过状态回归覆盖，真实环境为多节点；不通过改变真实节点拓扑验证单节点。

本轮实现验收（2026-10-24）：Host 相关 85/85、core 39/39，共 124 项定向测试通过；13 个改动 SFC 的 script 与完整 template 均已编译（最终日志改动另复验 2 个 SFC）。core 目标 `vue-tsc` 为 0 错；宿主仍有 167 条类型错误，与 `/tmp/runtime-explorer-final-host-types.log` 逐条相同，无新增。`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 最终成功（26.02s），仅保留既有大 chunk 警告。中英文 `runtimeDiagnostics` 各 517 键、集合一致且无重复；原仪表盘和后端等 49 个保护文件 hash 未变。未启停服务、未修改日志 Provider 限制、未提交。

真实浏览器在 1396 / 1019 / 760 / 520px 下无页面横向溢出：标题内折叠开关处于正常文档流，窄屏节点选择可用；概览与 MBean 往返时图表宽度一致、无重建弹跳。日志以 119 条真实数据验证，查找 36 项、下一匹配定位、节点 / Tab 往返保留文件、筛选、滚动位置和活动匹配，级别选择后会关闭；持续更新开启后 `sampledAt` 推进，随后已暂停。控制台只验证“开始接收”入口及自动滚动“暂停 → 滚到最新”恢复，未实际触发接收。Buffer 更多菜单进入采集设置不产生双层浮层；压缩 / 线性刻度、反选空态到全选恢复正常；未实际执行 reset。实测后端偶发“网络环境不佳”或过期后恢复，因此不保证采样稳定性。截图保存于 `runtime-ui/output/playwright/runtime-monitor-refinement-overview.png` 和 `runtime-ui/output/playwright/runtime-monitor-refinement-logs.png`。

Buffer 图例保存用户期望的完整队列身份，显示时与当前快照取交集。首次加载为空、部分队列迟到或暂时缺测时不销毁偏好，恢复后继续显示；显式空选择保持全部关闭。当前接口没有永久删除信号，因此不因一次缺席写回删除偏好；用户操作图例时才明确替换选择集合。重置必须匹配当前实际存在的唯一队列，目标暂时消失即关闭确认。

日志 Provider 只读能力发现独立于文件 / 控制台模式。初次未完成时显示等待，失败可原地重试，只有确认没有 Java Provider 时才显示不支持；发现和重试不自动读取文件或启动控制台。相同节点的无关按钮权限更新和后台能力复查保留已有控制台证据，实际日志撤权、节点变化或能力移除才清理。目录和文件独立代际，根目录刷新等待能力期间也不能覆盖较新的手动导航。

本轮增量验收：日志 / 目录 / Buffer 与偏好相关回归 97 项通过（宿主 64、core 33），core 目标类型检查通过，宿主与原 167 条错误逐条一致，无新增；core 中英诊断文案各 509 项且集合一致、无重复键。未配置独立 lint 脚本，SFC 编译与变更空白检查通过；统一模块构建 27.76 秒通过，保留既有资源 / chunk 告警。真实浏览器验证 200px 固定目录、单行查找工具栏、规则引擎节点目录往返与正文刷新保持 25 条记录及 scrollTop 951，历史 .gz 文件加载 136 条记录（4 组异常堆栈）；查找 subscribe 命中 4 条，MBean / 日志往返保留查找与 scrollTop 335.5。IoT / 规则引擎往返保留 IoT 111 条记录及 scrollTop 5862；IoT 的目录接口一度 15 秒超时，错误仅出现在目录区，正文仍可阅读，最终复核该节点已恢复，根目录 / Java 目录往返均正常，正文和 scrollTop 5862 保持。768px 下目录默认收起、展开为 220px 覆盖层，Escape 关闭并回焦入口，页面宽度仍为 768px，临时视口设置已清除。Buffer 实页验证 240px 图高、全关 / 全选 / 单队列、压缩刻度和 Tab 往返保留，未执行重置；原仪表盘及共享监控基线 49 个文件校验均未改变。普通多行消息的生产 MQTT 格式、通用字段块与跨窗口边界由回归覆盖，本次实时日志未复现用户原截图中的同一条消息。未改后端 / 延迟迁移的日志权限，未启停服务、采集 JFR 或执行真实导出 / reset。 最终展示截图为 runtime-ui/output/playwright/runtime-log-explorer.png，Buffer 截图为 runtime-ui/output/playwright/runtime-buffer-legend.png。

本轮增量优化方案：日志按完整结构头识别记录边界，将同条日志的多行消息连续展示，时间/级别/操作只出现一次，异常栈与普通消息续行分开，未知独立格式不冒充前一条元数据；跨文件窗口合并保持原文和行身份。Buffer 保留实例工作台和积压/吞吐切换，以 ECharts 原生队列图例代替下拉，正文图高约 220–260px，线型区分待处理/失败或写入/处理尝试；默认真实线性坐标，可显式切换保留 0 的压缩刻度，轴和说明明确口径，Tooltip 始终显示原值。图例选择按节点保存，旧单队列偏好兼容；仅单队列被选中且原授权成立时允许重置统计。说明 icon 面向业务解释 Buffer 的缓冲用途和指标含义，不出现原型/采集实现文案。范围为宿主日志归一化、web-core 日志与 Buffer 展示及必要的 ECharts 事件接线/偏好；不改原仪表盘、后端采集/权限或服务，不执行重置。完成两块实现后集中回归、类型/构建和真实浏览器验收，重点覆盖消息边界、跨窗口、图例选择保留、极差/零值和窄屏。

前一阶段验收：相关回归 106 项通过（宿主 51、core 55）；JVM/链路及日志组件两组专属类型检查通过，宿主诊断类型检查与原 167 条错误逐条一致，无新增。未配置独立 lint 脚本，SFC 编译与变更空白检查通过；统一模块构建 28.36 秒通过，保留既有资源/chunk 告警。真实浏览器完成：最新 IoT 日志自动打开并定位末尾；文件/控制台切换及跨节点返回均保持 scrollTop 2140；控制台实际收到 JFR 开始/取消的两条日志后已停止接收。JFR 26 次更新、3 个执行样本后停止，分配排行显示 129 种类型/270.5 KB，搜索 JetLinks 后为 8 行且总量不变，无分页。链路根/深层调用名称与详情起点分别精确对齐，768px 无页面横向溢出，临时视口覆盖已恢复。Ant 展开单元格样式优先级和 Vue 模板全局 console 命名冲突均有回归保护。文件游标续读、轮转、有界高频接收和阅读锚点由行为回归覆盖；当前实际 IoT/规则引擎日志分别为 107/25 条，均无历史游标，未将回归替代真实大文件验收。平台 SDK 的服务端订阅 error 帧仍只提供全局提示，首条前面板保持等待，不绕过权限。证据见 `output/playwright/runtime-{allocation-ranking,console-live,log-file}-final.png` 与最终链路截图；未改后端权限、原仪表盘或服务状态。

本轮继续落实既定排查工作台，范围为 web-core `JvmDiagnosticPanel` / `LogViewer` / `TraceWaterfall` 与宿主 `diagnostics/useNodeLogs`。推荐布局为 `分配：类名 + 采样字节/占比排行；日志：[文件/实时控制台] [来源/连接状态] → 日志流；链路：数据行 → 同缩进连续详情`。以正文为唯一主视觉，紧凑控制条不新增 KPI 卡、抽屉或详情 Tab；沿用 Ant 控件、平台 tokens、现有菜单按钮授权和 i18n。日志为只读时间流，文件定位与级别/文内查找沿用现有入口，不引入无关 ConditionFilter 或管理表格。

实施采用已有日志订阅和 JFR 快照契约，分配仅表达当前录制已捕获的分配事件字节，不解释为堆存量或精确总分配。日志停用/离页/撤权取消，文件滚动合并保持阅读锚点并处理轮转；不改原仪表盘，不迁移 Java/Media/Edge Provider 权限，不启停服务或执行堆导出。验收结果与真实大文件验证边界见上文。

链路页签按设备列表参考图调整为“多链路对比工作区”的外层顶栏：`[入口A · ID ×][入口B · ID ×][+] / [查询与调用瀑布]`。页签经现有 `PageChrome flush` 放到壳层白色面板外并贴合其上沿，选中态白底深色字，未选中态半透明；正文只保留原 ContentPanel。交互仍为原位查询、切换和展开证据，主视觉是瀑布图，搜索仅按 ID，不引入 ConditionFilter / ProSearch、设备树、统计卡、PageHead 或新详情壳。采用用户指定参考并直接实施；保留 Ant 可编辑 Tabs 的关闭、新增、键盘和溢出行为，复用斜边轮廓，不为静态分类组件增加业务页签能力。不改会话、查询、权限及共享布局组件。真实浏览器确认页签位于面板外、上下间隙为 0、无嵌套面板，新增后 3 个页签、关闭后恢复 2 个；768px 与 1218px 视口无页面横向溢出，临时视口调整已恢复。SFC 模板 / 样式编译通过，模块构建 27.96 秒通过；诊断类型错误仍为原基线 167 条、无增减。证据为 `output/playwright/tracing-outer-tabs.png`。

本次走查修复范围为诊断上下文连续性，由 `device-manager-ui/views/link/Tracing`、`store/traceWorkspace.ts`、`diagnostics/NodeLogPanel.vue` 与 web-core `JvmDiagnosticPanel.vue` 承担。日志关联时间使用 `logFrom/logTo`；火焰图以节点为边界缓存已访问实例，撤权释放；链路工作区由 Pinia 持有同一账号 / 项目的有界内存会话，离页仅取消请求、身份或授权变化同步清理；Tab 在可读入口旁保留可区分的短 ID。保留原始名称提示，异常编码降级原文。不改全局登录参数清理、原仪表盘、后端接口或服务状态，不持久化链路正文。

集中验收：受影响回归 87 项通过，覆盖实际组件 KeepAlive 切换、离页取消、撤权、项目切换和迟到响应；JVM / 链路组件专属类型检查通过，诊断宿主检查仍有原基线 167 条错误、本次改动路径 0 条；宿主全量检查另被既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断。前端没有配置 lint 脚本，变更空白检查与 SFC 样式编译通过。模块构建通过（26.96 秒，沿用既有资源 / chunk 告警）。真实浏览器 1218×853 验证：平台分组 / 搜索跨 JVM 子页保留，真实 JFR 21 次更新 / 2 执行样本后已停止；两个同接口链路短 ID 可区分，日志 URL 与格式化时间完整，返回后 2 个 Tab 及原 Span 保留，无横向溢出。证据为 `output/playwright/context-fix-{flame-retained,trace-tabs,log-time,trace-return}.png`。

Buffer 由 RuntimeMonitor 页面级集群会话统一采集：目录必须在当前身份 / 项目完成发现后，才读取全部已授权节点 `org.jetlinks:type=PersistenceBuffer,*` 的 `Remainder` / `DeadSize` / `Monitor` / `WriterPending` / `Wip`，不轮询 LastError 大堆栈。最多三请求并行、每节点不重叠，按最早到期与同到期 FIFO 调度，慢响应不饿死后排节点。默认 5 秒，可选 5 / 10 / 30 / 60 秒并按账号 / 项目保存。切换节点 / 工具不断采，离页、身份 / 权限变化取消并清理；身份变化同步隔离旧拓扑，节点增删同步加入 / 释放。左侧仅真实堆积大于零显示紧凑提示，失败保留最后证据并标过期；右侧复用同一五分钟有界样本，失败留断点。旧概览 Buffer 轮询移除，生命周期与线程 / GC 独立轻读。

Buffer 概览支持全部 / 具体队列与堆积 / 吞吐切换，并保存每节点显示偏好。累计写入与处理尝试从 Monitor 的 queue 段提取，保留 Java long 精确十进制文本；out 包含失败、取消与重试，不是成功条数，也不用 in-out 推算积压。WriterPending 是请求数、Wip 是批数，不与元素条数堆叠。全部队列计数只在每个队列可得时汇总，未知不补零。`useBufferReset.ts` 仅在激活概览、同时具备 monitor-query 与 mbean-invoke，并由当前 canonical MBean 元数据确认 resetMonitor 空签名时发起单队列操作；全部视图不批量操作。概览按钮和通用 MBean 方法页统一交由宿主 `invokeDiagnosticMBean.ts` 编排，只有元数据精确识别为 org.jetlinks / PersistenceBuffer 的零参 resetMonitor 才建立统计屏障，其他同名操作保持通用调用。已完成当前身份节点发现时，即使首个 Buffer 样本尚未返回也先建立 epoch；缺少集群会话、目标失效或同节点正在重置时明确拒绝，不绕过屏障调用，也不重复执行 transport。通用方法页继续展示原始执行结果。该操作只清统计，不清待处理 / 失败队列、LastError 或 dropped，且服务端不是原子快照。动作发出前即切该队列 counterEpoch、替换采样代际并取消跨越的在途样本，成功只刷新该节点一次；失败或取消也断开速率基准，保留原积压历史，恢复常规采样而不重试操作。切节点、工具、身份或撤权取消本页等待，迟到成功不能更新状态或刷新另一节点；取消不代表服务端没有执行。

本轮实施采用既定实例工作台：`左：节点名/状态 + JVM CPU/堆 + 系统CPU/内存；右：工具详情`。左侧 hover / focus 显示可用的完整资源证据，异常在列表直接可见；多节点宽工作区右侧移除重复资源卡，单节点和容器窄于 928px 时提供紧凑摘要。实时数据复用现有页面订阅；Buffer 由页面集群会话发现即采并按配置频率更新，切换节点 / 工具继续采集，右侧复用同一五分钟有界样本，缺测不补零且最后真实采样时间不被失败改写。JVM 概览在当前节点概览激活时独立轻读，离页、身份或权限变化清理。历史与 MBean 分开刷新；历史图可选 SVG、共享时间范围及缩放，时间入口复用 ConditionFilter 公开日期范围编辑器。JFR 增加本页请求 / 首帧 / 接收、计时与最近帧反馈，真实累计快照覆盖，停止始终可点击；日志恢复跟随先读取最新窗口再定位。只修改专属诊断与 ECharts 可选 renderer，不修改原仪表盘、旧共享 ResourceUsage、平台全局壳层或服务启停；集中测试和类型检查后由总控统一构建及真实浏览器验收。

运行监控在当前页面内用 `RuntimeNodeWorkspace` + `KeepAlive(max=8)` 保留每个节点的概览、MBean、JVM 与日志工作区；工具首次访问后保留 DOM，返回先显示已有证据，后台只读更新不遮罩正文。MBean 的本地选择、树配置和执行结果不随其他节点的 URL 改变；线程和火焰图只保留结果，采集与导出仍需显式操作。MBean 导航与详情、日志正文均复用 core `useRetainedScroll`，为每个明确容器独立在组件内存保留 scrollTop / scrollLeft；KeepAlive 或工具恢复在 nextTick 与下一帧尝试恢复，布局尚不可用时等待该容器 ResizeObserver，隐藏零值和待恢复事件不能覆盖位置，旧恢复帧按代际取消。目标、正文身份或权限清理时显式归零，不扫描整页 DOM，也不写存储 / 路由。日志返回保留文件、目录、过滤与行身份，跟随保持暂停且隐藏更新不滚到底；目录和面包屑只在请求成功后一起提交，取消或失败不破坏上一次完整上下文。LRU 淘汰后给出重新载入提示；账号、项目、权限变化及离开整页销毁缓存，不持久化诊断正文。`routeScope.ts` 约束常驻页面只能在运行监控路由恢复节点或写 URL，防止跳转链路页后篡改 `traceId` / `span`。

节点健康状态、启动时间和运行时长在工具上方常驻。概览首次有效采样读取 Runtime 的 StartTime / Uptime，后续 Buffer 轮询不再重复投影这两个字段；直接进入其他工具只轻量读取一次 Runtime，不启动历史或 Buffer 轮询。运行时长依据服务端真实基准及本地单调时间每秒更新；初次取消、部分源缺失时允许补读，明确断连 / 失败时冻结，恢复后重新核对真实启动基准。ECharts 在隐藏容器不初始化、不 resize 为零，恢复可见后按 `clientWidth/clientHeight` 立即无动画校正，保留实例、缩放与图例；视觉 transform 不作为画布布局尺寸。公共 `useDiagnosticQuery` 的保留、取消行为为显式选项，默认停用清理行为保持兼容。

运行监控按工作区容器可用宽度切换节点选择：容器宽度小于 928px 时收起左侧目录，使用详情内的节点选择器；单节点始终省略选择器。该边界包含 280px 节点目录、16px 间距、32px 详情内边距和至少 600px 正文，避免平台导航占宽后仍强行保留双栏。不改原仪表盘、全局壳层和通用请求层。

- MBean 发现先请求 `detailed=true&attributes=`，仅读元数据；选中后才读取该 canonical ObjectName 的属性。树将 JetLinks 排前并默认展开，已识别对象自动展示摘要和国际化说明，其余展示原始属性。调用只允许当前元数据声明的精确类型签名，参数保留列表顺序；零参数调用仍发送 `signature=`。旧服务缺元数据时显示能力不可用，不推测身份执行。
- JVM 诊断合并线程、性能和内存证据。线程通过有限 NDJSON 流发送 `{}` 并收集完整快照；火焰图显式以 `{configurationName:'profile'}` 开始实时性能采集，每条累计快照替换前一条，避免依赖服务端 JFR 配置默认值。平台包高亮与操作分组只解释观测样本，不等同 CPU 耗时或根因。手工停止保留当前结果，切换节点、撤权、离页释放本页订阅，不调用共享流的全局 stop；刷新不恢复采集。HTML 使用安全自包含导出，JFR / 堆文件在确认目标、时长或 live Full GC 影响后执行，取消只承诺停止本页等待。
- NDJSON 复用平台 `createNdJson` 与请求身份 / 项目上下文；宿主额外把 AbortSignal 映射到 unsubscribe，兼容 SDK 的 signal 合并差异。错误信封不能成为空成功；403、404 / 501 分别显示无权限、能力不可用，取消后的结果不能落地或下载。
- 日志使用已有目录 / ZIP 条目与 500 行窗口，默认静态阅读，显式跟随后每三秒读取最新窗口；首次请求显示加载，已有窗口的后台跟随 / 刷新保持正文可读、行身份和滚动容器，不加周期性遮罩；失败保留缓存并提示过期。滚离底部、查找、翻页暂停跟随，暂停后迟到响应不移动窗口。平台 Spring Boot 完整结构才拆时间 / 级别 / 线程，完整结构化头始终开始新记录；Java 根异常、栈帧、cause / suppressed、折叠帧及 Reactor assembly / checkpoint 等续行基于异常上下文归并，保留原顺序、空行和 raw 原文。未知独立文本终止归属；窗口从栈中间开始时保持无时间 / 级别片段，不推测所属 ERROR。过滤只作用当前窗口；TraceID 仅明确命名且合法时可关联链路。ZIP 下载保留归档名。文件尺寸缩小或窗口位置回退提示截断 / 轮转；现有接口没有 inode / generation，不能可靠识别同尺寸或更大的替换。关联时间仅供参考，不声称按时间索引文件。
- 链路平台查询使用 `GET /system/trace/{id}`，关联边缘经已授权代理补查同一 Trace ID；接收 `TracingController` 返回的 Span 裸数组，兼容标准 `success=true` 成功信封。只有合法且属于当前 Trace 的数组才进入结果 / 空状态，失败信封与无效项明确拒绝，不将未知格式当成空查询。保留原始 ID、纳秒文本和 app；云端服务节点仅在可访问目录中精确 ID 或唯一别名匹配后提供跳转，远程来源不匹配云端目录。
- 浏览器只记录按账号 / 项目隔离的显示偏好：选中节点 / 工具 / MBean、树展开、展示分区、队列筛选 / 具体队列 / 堆积或吞吐视图、历史时间范围、日志级别 / 换行和 JVM 子页。白名单、版本和容量受限；不保存日志内容、关键词、Span 内容、执行参数或采集任务。撤权、目标失效和存储异常安全回退，并提供清除入口。

#### 跨工具风格与交互统一（已完成）

本次已授权完成 M 级只读改造：在保留既有业务结构、接口、权限、Provider 与缓存契约的前提下，统一 `runtime-ui` 宿主的 `Tracing` / `diagnostics` 和 core `RuntimeDiagnostics` 的层级、控件与状态表达；原仪表盘和后端始终不在改动范围内。

实施落点：core `RuntimeDiagnostics` 提供二级文本导航、紧凑工具栏、状态表达与菜单焦点契约；宿主概览 / 日志收敛控件、键盘与确认动作；Trace、JVM 与 MBean 在同一契约下完成对应呈现。定向测试、完整 SFC 编译、类型、构建和真实浏览器验收均已集中完成，结果见本节完成回填。

JVM 性能页局部修正已完成：空闲且无结果时，内容区中心仅提供 Ant large（40px）的“开始采样”主入口；连接 / 等待首帧在内容区给出真实反馈并始终可停止；有结果后才显示紧凑工具栏与低频更多操作。已移除重复节点标识和无业务价值的“未采样”标签；权限、已有数据、事件、采样 / 导出 / 堆转储契约保持不变。更多菜单使用“更多诊断操作”文案，不再复用日志显示选项。

真实画布修正已完成：仅 JVM 工具建立宿主详情容器到 `NodeDiagnostics` 再到 JVM wrapper 的可伸展 flex 链，header 与主工具 Tabs 固定在自然高度，剩余的实际可用高度交给性能内容区；JVM 正文 wrapper 是唯一 `overflow:auto` 承载，保证图表、分组和热点内容超出时可滚动，空态仍在剩余空间居中。不使用固定屏幕像素减法或 `height:100%`，不改变日志、概览或 MBean 的既有滚动壳；对应布局契约由宿主诊断呈现测试锁定。

JVM 最终回填（2026-10-25）：生产源码已冻结，core runtime 114/114、宿主 140/140 通过（`/tmp/runtime-jvm-entry-verified-core-tests.log`、`/tmp/runtime-jvm-entry-host-tests.log`）；core 诊断 `vue-tsc` 0 错误，宿主仅保留与基线集合一致的 167 条既有错误、0 新增。最终生产构建成功（29.68s），保留既有 `>2000kB` chunk 警告；49 个保护文件 SHA 未变化。正式 IAB 已验证中央 160×40 开始按钮、无未采集 / 重复节点、线程中央入口、主 / 二级 Tab 往返、节点切换、空态 More 有录制但无 HTML、Esc 回焦，以及 1396 / 1019 / 760 / 520 与 1218×480 无横向溢出且入口可见；截图为 `runtime-ui/output/playwright/runtime-jvm-centered-entry.png`。本地组件夹具验证等待 elapsed、零样本、无帧停止仍为空态、已收帧停止保留图、重启清 snapshot 后收到帧恢复及 permission denied → idle → receiving 恢复；夹具不等同真实后端 JFR 验收，本轮未执行真实采集或导出。

有样本 JVM 顶部布局修正已完成：core `JvmDiagnosticPanel` / `FlameGraphViewer` / `style.css` 将二级导航控制为 32px，搜索工具行为 24px 与 8px gap，采样状态、small 开始 / 停止及 More 同行；四项统计归入点击采样详情，延迟 / 错误反馈保持可见，`ink-2` 保证样本、提示和统计可读。共享 selector 修复 Ant 默认样式覆盖；正式 JVM 和 MBean 导航均为 32px，页面无横向溢出，空态中央主入口保持不变。真实组件本地夹具在列宽 560 / 626 / 960（实际正文 528 / 594 / 928）下均验证导航 32px、工具栏 24px、20 帧 / 8 样本深树、详情 click / Enter 打开及 Esc 回焦、切线程关闭弹层后返回保留图、`TcpTransport` 搜索命中 1 帧、网络分组切换和更新延迟下的停止 / 重连可见；截图为 `runtime-ui/output/playwright/runtime-jvm-sampled-compact-fixture.png`。正式页原用户快照被开发热更新清空，之后未启动真实采集；有样本结果仅来自本地夹具，不能表述为真实后端 JFR 验收。core runtime 114/114、宿主 140/140 通过（`/tmp/runtime-jvm-sampled-{core,host}-tests.log`）；core `vue-tsc` 0 错误，宿主 167 条与基线按规范路径比较 0 新增 / 0 移除；最终构建成功（27.63s，`/tmp/runtime-jvm-sampled-final-build.log`），仅保留既有 `>2000kB` chunk 警告；49 个保护文件 SHA 未变，`git diff --check` 通过。

紧凑二级导航间距修正已完成：共享 `diagnostics-mode-tabs` 导航后区块间距为 `space-4`（16px），针对查找类 input 与上方导航之间的视觉间距；该规则覆盖 JVM 与 MBean，导航自身保持 32px、搜索工具栏 24px、搜索至图表 8px，不给输入框叠加额外间距。本轮 JVM 真实组件本地夹具在列宽 560 / 626 / 960 下直接量得 `.flame-search` 上沿至导航底线均为 16px，输入高 24px、输入底至图表 8px；截图：`runtime-ui/output/playwright/runtime-jvm-search-spacing-fixture.png`（本地真实组件顶部局部）。core 样式定向 3/3、CSS / SFC 编译及 `git diff --check` 通过；纯 CSS 变更，复用已有类型和构建证据，未重复构建。

1. 外层链路记录使用设备列表同款页签；节点监控主工具保持标准 underline Tab。JVM 的线程 / 性能 / 内存、MBean 的摘要 / 属性 / 方法、日志的文件 / 控制台是同级局部模式，统一紧凑文本导航且不增加重复整行分隔线，不将三层机械改为同一种 Tab。
2. 查询 / 开始采集为主动作；刷新统一为带 Tooltip 与 aria 的 text icon；导出、录制等低频动作进入更多，运行中的停止采集始终可见。搜索按容器宽度伸缩，长内容省略并提供 Tooltip；普通控件统一沿用 small 32 / 24 及相邻 token，不另设主题。
3. 数据区标题采用 13–14px / 600，说明与更新时间采用弱化的 12px，区块间距复用 8 / 12 / 16 token。Trace 摘要、健康与采集状态复用一致的徽标语义，但“未记录异常”不得表述为绝对健康；Buffer 的三张零值大卡收敛为紧凑单行处理阶段，异常在最近证据处呈现。
4. 初载查询、刷新中均保留上次数据；更新中、空查询、未采集、不支持和无权限分别使用轻量空态。Trace 未找到 Span 时显示当前 ID 无记录并提示检查 ID 或采集，不臆断过期原因。
5. 同行展开、hover / focus、复制反馈及权限按钮门禁沿用现有已批准契约；跨菜单保留 node / trace context 与状态，不改变接口、权限或 Provider。拒绝另起大卡片 / 重框视觉体系，也不为“统一”而强制复用不合语境的组件。

控件一致性约定：

1. 标准主查询与已进入内容后的显式采集使用 Ant 32px 尺寸，正文密集工具使用 24px；内容区首次采集主入口使用 Ant large（40px），不与工具栏混同。同一工具行保持同高、图标基线、字号、圆角和 gap 一致，复用 Ant size / token，不用全局 CSS 强压尺寸，也不把全站控件统一为同一种高度。
2. 每个工具区仅一处保留动作文字的 primary 主动作；刷新、设置和更多使用带 Tooltip 与 `aria-label` 的 text icon，首次进入或难识别动作仍保留文字。查看节点、关联日志为行内轻动作；下一异常 / 下一慢调用等常用定位保持可见，导出 / 录制等低频进入更多；停止保持可见，危险色只用于真实风险动作，不把停止滚动或清空本地显示表达为后台删除。
3. 统一覆盖 default / hover / focus / active / disabled / loading。无样本导出须给出“尚无数据可导出”等原因；权限不足与前置条件不足分开表达，不能只依赖 disabled 原生 title，应由可聚焦说明载体承接。loading 仅锁定相关操作、防重复触发，并保持文字和位置稳定。
4. 以标准 icon 替代零散 `×` / `ⓘ` 等功能符号（保留有业务意义的平台帧标记）；Tooltip 同时支持 hover / focus，icon 按钮提供 `aria-label`，Esc 关闭并回焦触发入口，切换 Tab / 节点关闭弹层。输入 Enter 提交；Esc 只关闭临时面板，不清空已加载数据。
5. 输入、下拉、segmented、checkbox、switch、时间、清除、复制、下载及确认弹层一起对齐；长文件名 / 对象名省略并保留完整 Tooltip。主 TraceID 查询与页内匹配搜索保持不同职责，不机械塞入 ConditionFilter；主工具导航、二级模式和指标 segmented 按语义统一，避免重复框与表单化密集控制。
6. 确认弹窗沿用平台 Modal：OK 文案明确实际动作（如“开始录制”“导出堆转储”），避免泛化“确定”；展示节点、时长等必要信息，确认 / 取消顺序保持一致，不另造弹窗体系。

最终验收覆盖鼠标与键盘、窄屏、无数据 / 进行中 / 完成 / 超时 / 权限不足 / 服务不支持，以及真实 Trace、慢调用定位、详情行对齐、节点日志跳转、四种尺寸与缓存往返。保持上下文，不执行真实 reset、JFR、heap、导出或 Provider 变更；只读控制台未在等待期收到实际新日志，真实 Trace 未出现异常，因而这两项不作为已完成的真实行为验收。

完成回填（2026-10-25）：本阶段已冻结。core 与宿主运行时回归分别为 108/108、140/140 通过（`/tmp/runtime-unified-fixed-core-tests.log`、`/tmp/runtime-unified-fixed-host-tests.log`）；诊断完整 `vue-tsc` 为 0 错误。宿主完整检查保留既有平台基线的 167 条错误，与 `/tmp/runtime-explorer-final-host-types.log` 按错误行完全一致，诊断相关 0 新增；最终模块构建成功（26.90s），仅保留现有 `>2000kB` chunk 警告。39 个诊断 / 宿主 SFC 的 script、template、CSS 编译均为 0 错误；core locale `zh/en` 无重复键且诊断键集合一致；`git diff --check` 通过。49 个原仪表盘 / 后端等保护文件哈希未变化。工程没有独立 lint 脚本；本轮未启停服务、未提交。

真实 IAB 验收已覆盖概览、Buffer 紧凑摘要和 MBean；日志目录关闭回焦，More 菜单进入 checkbox 且 Esc 返回触发器，级别菜单 ArrowDown 进入“全部”且 Esc 返回触发器；JVM More 菜单进入禁用原因，焦点 Tooltip 可见且 Esc 回到触发器。只读控制台按“开始接收 → 等待新日志 → 停止”走通，但等待期间未收到实际新日志，不能据此宣称收到日志。JFR 录制确认已取消，未触发录制、heap、导出或 reset。Trace 输入真实完整 traceparent 成功解析，最新 `a170dad8267a28ef394b4e9e5c3556f8` 显示 9 Span / 2 节点 / 88.75ms；行内动作详情对齐、搜索 focus/Esc 保留匹配、慢调用定位、跨节点日志跳转返回、双 Tab 详情保留及空记录单一提示均已验证。真实 Trace 未出现异常；异常定位仅有测试覆盖，不能表述为真实验收。1396 / 1019 / 760 / 520px 页面无横向溢出；520px 受既有全局 240px 菜单限制，主要面向桌面，瀑布局部横向滚动保持可用。截图：`runtime-ui/output/playwright/runtime-unified-{overview,logs,mbean,jvm,tracing}.png`。

### 当前验证边界

通用 MBean 重置与概览动作统一：宿主 `invokeDiagnosticMBean.ts` 复用同一集群统计屏障，通用方法页使用当前 canonical 元数据并保留执行结果。受影响 Buffer 重置、通用控制器与集群采样三套 25/25 通过（`/tmp/runtime-shared-mbean-reset-tests.log`），覆盖两入口同源、元数据防伪、首采未完成、跨越样本取消、单次调用 / 刷新、无会话 / 目标移除 / 并发重置拒绝、失败或取消后计数超过旧值仍断开 epoch，以及其他域同名方法 / 带参重载不受影响。宿主目标类型检查仍为 167 条既有平台基线，诊断相关 0（`/tmp/runtime-shared-mbean-reset-typecheck.log`），中英新增宿主诊断键各 36 项且一致，`git diff --check` 通过；未在真实集群执行重置，未重复 core 检查或生产构建，最终构建由总控在冻结后执行。

阅读位置统一修复：`LogViewer` 与 `MBeanBrowser` 的导航 / 详情共用 `useRetainedScroll`；宿主 `NodeDiagnostics` 将工具与节点激活状态传入 MBeanBrowser。受影响 core 三套 6/6、宿主控制器 10/10 通过（`/tmp/runtime-retained-scroll-tests.log`、`/tmp/runtime-retained-scroll-host-tests.log`），覆盖导航 70 / 90 与详情独立双轴往返、延迟布局、隐藏零事件、旧帧取消及权限 / 目标清零。core 目标类型检查 0，宿主仍 167 条平台基线、诊断相关 0（`/tmp/runtime-retained-scroll-{core,host}-typecheck.log`）；本次未改 Buffer / 采样，复用下述已通过证据。菜单声明回归使用实际 baseMenu.ts 与 core handleAuthMenu，确认 monitor-query → system-monitor/query、mbean-invoke → invoke 声明完整，前端判断仅使用已授权菜单与 code:button，不增加原始后端资源权限判断（`/tmp/runtime-menu-declaration-tests.log`）。这些静态声明不能代替已部署菜单同步或角色授权；后端已定位统一鉴权策略未复用的根因，旧服务的真实 system-monitor/query 拒绝仍存在，部署后的接口核验由总控完成，未改真实角色或放宽前端门禁。真实阅读位置与最终构建仍由总控统一验收。

Buffer 集群与重置阶段集中验证：宿主十二套 77/77 通过（`/tmp/runtime-host-buffer-reset-tests.log`），覆盖七慢节点最早到期 FIFO 首采 / 周期公平、身份变化旧拓扑不发请求、发现作用域同步清理、精确 long 计数、单 canonical 队列空签名与权限门禁、重置跨越样本取消 / 成功单采、失败与取消后计数即使超过旧值也因 epoch 断开速率、迟成功不串节点或身份，以及偏好白名单与全部队列恢复。core 六套 50/50 通过（`/tmp/runtime-core-buffer-reset-tests.log`），日志新增双轴恢复回归覆盖 KeepAlive 脱离布局后的零值、恢复帧前更新、工具隐藏 / 旧帧取消、文件切换与隐藏更新不滚到底。core 目标类型检查 0 错误（`/tmp/runtime-core-buffer-reset-typecheck.log`）；宿主仍 167 条平台基线、诊断相关 0（`/tmp/runtime-host-buffer-reset-typecheck.log`）。core 中英诊断键各 423 项、host 诊断键各 35 项，集合一致且 JSON 无重复；两模块 `git diff --check` 通过。真实集群仅进行只读验收，不人为制造队列堆积或执行 resetMonitor；正数、失败及重置使用独立 fixture / mock。生产构建、真实日志双轴往返与展示验收由总控在全部源码、测试及文档写入冻结后统一执行，当前尚未以旧构建替代最终验收。

当前源码阶段宿主十套定向测试 64/64、core 四套定向测试 37/37 通过（日志 `/tmp/runtime-host-retention-tests.log`、`/tmp/runtime-core-retention-tests.log`）。新增覆盖取消后保留最后结果、默认清理兼容与拒绝清空、非所属路由不改 URL、节点 / 工具往返的 MBean / 线程 / JFR / 日志缓存、目录取消时上下文一致、首个生命周期证据取消 / 部分成功后的补读、运行时长单调计时与断连 / 重启、Buffer 停采断点，以及 ECharts 隐藏 / 恢复 / transform 布局尺寸。core 目标 `vue-tsc --noEmit -p tsconfig.runtime-diagnostics.json` 无错误；宿主同命令仍有 167 条平台基线错误，诊断页面 / API / 公共组件路径无错误（日志 `/tmp/runtime-core-retention-typecheck.log`、`/tmp/runtime-host-retention-typecheck.log`），未宣称全量类型检查通过。中英文 core 诊断键各 410 项，集合一致且 JSON 无重复键，宿主新增键亦一致，两个模块 `git diff --check` 通过。工程未配置 lint 命令，未宣称 lint 通过。本轮生产构建与真实页面的节点 / 工具往返、日志滚动和图表恢复逐帧几何验收由总控统一执行，先前构建结果不代替本轮验收。新 detailed / signature / 纳秒文本接口要求部署对应 Java 版本，旧响应按能力不可用展示。

容器布局以真实 SFC 样式及 256px 平台导航的隔离浏览器几何场景验证：1440、1208、1207、980、768px 视口和单节点的 1440、980、768px 共 8 场景通过。工作区 928 / 927px 边界正确切换；980px 视口下 700px 工作区完整用于详情，页面无横向溢出；单节点不出现选择器。这是容器样式验证，真实业务组件与授权菜单由总控另行验收。390px 视口下平台固定主菜单造成的全局壳层挤压仍属于既有边界，未修改该壳层。

原仪表盘补充回归：`systemMonitor.test.ts` 8 项、`monitorData.test.ts` 23 项、`infrastructureDashboardLayout.test.ts` 3 项与 `dashboardRuntime.test.mjs` 3 项，共 37/37 通过。共享资源展示的 8 个函数对缺测、常规、过载 / 零值及无核心数 4 类输入与 HEAD 原实现逐项对比，32/32 一致。`views/link/DashBoard/{index.vue,useInfrastructureDashboard.ts,infrastructureDashboardLayout.ts}` 三文件字节及 SHA-256 均与 HEAD 一致。目标 tsconfig 保留作为可复现类型验收入口，完整检查的平台基线错误仍需后续清理。

发布时通过既有菜单初始化流程（core `views/init-home/Menu/index.vue` 的 updateMenus）同步菜单定义和后端资源，再为存量角色分配所需新动作并刷新授权会话。不能仅更新静态页面而假定服务器菜单与角色已同步；不自动给存量只读角色新增诊断权限。

### 少量节点密度与指标切换样式

- 指标留白：容量 / 堆外说明取消负上边距，与主数值间隔 4px，字号 12px、行高 18px；CPU / 内存两组及磁盘容量 / 读写之间间隔 8px，节点行上下内边距各 8px。默认高度同步容纳完整摘要，单节点无需内滚动。
- 目标与方案：沿用当前监控感知页和资源中心组件内的 Ant Design Segmented 风格。节点实时资源默认高度按当前节点数生成：单节点 8 行（254px）、2 个节点 11 行（356px）、3 个以上节点最多 13 行（424px），超出时在表内滚动；保留 7 行的手工缩放下限。CPU / 内存趋势随节点卡片上移，网络趋势仍位于两者下方。保留现有指标、时间选择、排序、拖动和缩放交互。
- 实施入口：`views/link/DashBoard/useInfrastructureDashboard.ts` 复用页面共享实时节点集合计算默认坐标；同目录布局工具识别并调整旧的完整默认布局，仅改自动生成的坐标，不清空缓存或覆盖手工布局。`RealtimeResources/config.ts` 单独放开紧凑最小高度；`components/TrendToolbar.vue` 对齐资源中心 `ResourceWidget.vue` 的灰底、白色选中项、蓝字、圆角和内边距。
- 验证：`node --test tests/infrastructureDashboardLayout.test.ts` 3/3 通过，覆盖节点数与下方坐标联动、旧默认缓存及早期 7/9 行默认缓存适配、输入不变、任一卡片手工位置或尺寸的保护。相关 Vue SFC / Less、TypeScript 语法检查及 `git diff --check` 通过。复用现有 9200 开发服务，在隔离页渲染真实节点组件并注入模拟节点：1 → 4 → 1 时高度为 254 → 424 → 254px，单节点表格可用高度与滚动高度均为 151px，行高约 108px，内容完整且没有内滚动，4 个节点保留表内滚动，页面无横向溢出。既有真实画布检查覆盖趋势间距 18px、CPU / 内存 / 网络六项切换及日期面板打开；这些交互本次未改动，沿用已有通过证据。切换控件计算样式与资源中心一致（灰底 `#F2F3F5`、选中蓝字 `#165DFF`、2px 内边距、4px 外圆角）。
- 联调与交付边界：当前浏览器工具访问 9200 正式页面会跳转登录，本轮浏览器结果是模拟节点隔离验证，尚未在真实登录页面联调；临时隔离页已移除，不修改后端数据。按性能约束未执行全量 lint/typecheck/build；完整类型检查与发布构建可执行 `pnpm -C runtime-ui exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json`、`pnpm -C runtime-ui build:standalone`。本地已有开发服务可热更新，9000 环境需发布更新后的 runtime-ui 静态资源，无后端重启要求。

监控行为：

1. CPU 趋势支持“JVM 使用率 / 系统使用率”切换，默认展示 JVM；内存趋势同样默认 JVM。
2. 内存趋势支持“JVM 内存 / 系统内存”切换，曲线展示使用率，Tooltip 与节点摘要同时展示“已用 / 总量”。
3. 多节点采用“全节点概览 + 默认聚焦少量高使用节点 + 搜索多选”的渐进式展示；同一节点在各图表中保持稳定颜色。
4. 顶部四个单节点仪表卡替换为紧凑的多节点实时资源排行：按“节点 / 系统 / JVM / 磁盘 / 网络”分组展示。系统组包含 CPU 使用率、1 / 5 / 15 分钟负载、逻辑核心数和内存；CPU 标签保持固定，CPU 次级说明使用“1 分钟负载 / 逻辑核心数”展示归一化负载压力、核心数和状态，悬浮时展示 1 / 5 / 15 分钟原始值及逐项换算结果。核心数为 0 或缺失时退回原始负载值，不伪造压力百分比。JVM 组使用 CPU、内存两行；内存进度表示堆内存使用率，次级信息同时展示堆内存已用 / 总量和堆外已用量。堆外内存不单独绘制使用率，也不参与 JVM 压力排序。系统 / JVM 组统一使用“CPU / 内存”短标签和对齐的进度 / 百分比列。磁盘展示使用率、容量及同一行的“读 / 写”吞吐；网络依次展示同一行的“下行 / 上行”吞吐、占据左半格并与上下行对齐的连接数、同一行的“丢包 / 重传”比率。实时表填满卡片剩余高度，随卡片缩放调整可视区域；全部节点在表内滚动，表头和节点列固定，窄卡片保留横向滚动。
   实时采样间隔为 3 秒，首帧确定默认顺序后保持稳定；后续采样和刷新不重新排列，只有用户点击列头才改变排序。
   实时节点行只保留本地背景 Hover，不再联动下方历史图，避免临时系列或加粗状态残留。
   节点名称颜色点、节点聚焦选项和三张历史曲线统一使用基于节点名称哈希的稳定颜色映射，历史折线显式设置颜色，不依赖 ECharts 系列顺序。实时表列宽调整为节点 10.5rem、系统 / JVM 各 18.5rem、磁盘 12.5rem、网络 14rem；系统 / JVM 内部的 `CPU / 内存` 标签使用 3rem 右对齐轨道，与进度条保持 0.375rem 间距，把剩余宽度交给进度条。磁盘读写按内容宽度分配并保持两端对齐，避免长写入速率压缩标签；磁盘与网络宽度重新分配后整表总宽不变。
5. 每个卡片右上角增加独立刷新按钮：默认 / 快捷时间推进到最新，自定义时间保持原区间后重新查询。
6. CPU、内存、网络分别维护节点聚焦状态和本地缓存；共享默认重点节点算法，但任一处修改只让当前图表立即重绘。当前会话允许用户主动清空选择，重新进入页面时空缓存不作为有效初始态，而是恢复按资源压力选出的默认重点节点，保证趋势首次展示至少有一个聚焦节点。实时节点集合发生变化时三张历史卡片各自刷新一次可选节点，普通三秒采样不重复请求历史数据。
7. 网络趋势同时展示上行与下行，并移动到 CPU / 内存趋势下方；不修改现有查询契约。
8. 网络趋势保持后端时间桶内的周期流量口径；Tooltip 按节点合并上下行到同一行，并按节点较高方向的周期流量降序展示。
9. 实时磁盘补充读 / 写吞吐，实时网络补充上 / 下行吞吐；两者基于相邻 websocket 快照的累计 counter 与采样时间计算 `B/s`。首帧、能力不可用、时间未推进或 counter 回退时展示 `--`。底部网络历史图仍保持周期流量口径，不与实时速率混用。
10. 实时表格 Hover 背景直接作用于整行全部单元格，固定节点列与普通列复用相同背景基线及过渡，避免视觉延迟。历史图节点聚焦由实时节点全集与本地缓存统一管理，不再根据单一历史数据源返回的节点集合回写选择，避免指标切换导致聚焦状态变化。
11. 节点健康度继续沿用紧凑监控感知表，不新增 KPI 墙或常驻诊断列。在现有 CPU / 内存 / 磁盘 / 网络主信息旁增加按需健康信号：CPU 优先显示 IO 等待、虚拟化 steal、cgroup 限流、温度 / 热降频；磁盘优先显示 inode、IO 队列 / 利用率、块设备异常 / IO 错误与 SMART/NVMe 健康；网络优先显示接口错误、TCP 失败 / 重置、队列积压、softnet / listen / backlog 丢弃、socket 和 conntrack 容量。正常行保持当前密度，只有异常时在节点列追加健康摘要，详细证据通过 Tooltip 展示；指标不可用不等同异常。
12. 网络历史区由“网络流量”升级为单图指标切换的“网络趋势”：默认展示业务上 / 下行周期流量，并支持切换网络质量、TCP 重传和 TCP 连接。网络质量在同一百分比坐标轴展示丢包率与网卡错误率；流量继续读取 `net_monitor`，健康指标读取 `system_monitor` 默认历史白名单。派生率只使用同一节点相邻有效 counter，availability 不可用、首点、零分母、时间 / counter 回退时形成断点，不用 0 伪装健康。指标切换保持时间范围和用户的 network 节点聚焦；节点选项以实时节点全集为准，当前数据源缺少节点时不缩窄或覆盖缓存。
13. 网络指标旁提供随指标切换的轻量口径说明：流量的上 / 下行是平台网络组件在设备接入过程中接收 / 发送的业务数据量，用于观察设备通信活跃度，不代表服务器网卡的实际流量或网络带宽占用；网络质量、TCP 重传和 TCP 连接来自节点所在操作系统，属于整台服务器的主机级指标，不是服务进程独立数据。同一服务器部署多个服务时，各服务节点可能上报相同指标，不应相加作为平台总量。

## 影响范围与 Owning Module

- Owning module：`runtime-ui/modules/device-manager-ui`
- 页面入口：`views/link/DashBoard/index.vue`
- 页面装配：`views/link/DashBoard/useInfrastructureDashboard.ts`
- 仪表盘组件：`visDashboard/SystemMonitor/{RealtimeResources,CpuTrend,MemoryTrend,NetworkTrend}`
- 展示复用：`visDashboard/SystemMonitor/components/`
- 生命周期与请求：`visDashboard/SystemMonitor/hooks/`、`services/`
- 指标计算与查询参数：`visDashboard/SystemMonitor/utils/`
- 历史数据请求：`api/link/dashboard.ts`
- 用户可见文案：`locales/lang/zh.json`、`locales/lang/en.json`

现有实时 websocket 已返回最新 `SystemInfo` 的 `cpu`、`memory`、`disk`、`network` 快照；CPU 包含使用率、1 / 5 / 15 分钟负载与逻辑核心数，网络包含当前 TCP 连接 gauge 与累计 counter。本次不新增后端字段或接口，丢包率、重传率及新增 counter 型健康信号由同一节点相邻快照的有效差值计算；只在对应 `*Available` 为真时参与健康判断。

后端 `SystemMonitorMeasurementProvider.putNetworkHistory` 默认持久化网卡收发字节 / 包、收发错误、接收丢包、TCP established、连接失败 / reset、收发段、重传、TCP 接收错误和 output reset；连接状态明细、UDP、softnet、socket、conntrack 属于默认关闭的可选历史组。浏览器实测现有 `net_monitor` 流量响应只有实际产生网络组件流量的节点，因此两类数据源必须保持独立口径和稳定节点选择。

## 明确不做

- 不修改 `ui/`、`runtime-ui/modules/jetlinks-components-ui`，不另建监控采集体系。
- 不新增阈值配置、告警处置、自动修复或后台诊断任务调度。
- 不展示默认未落库的 TCP 状态明细、UDP、softnet、socket、conntrack 历史指标；不把不同单位指标叠加到同一坐标轴。
- 不重构全局导航与页面壳层，不引入经营分析式 KPI 数字墙。

## 实施入口

1. 提取历史监控值归一化、内存容量换算、稳定节点颜色和默认聚焦规则。
2. 用现有实时 websocket 构建紧凑的多节点资源排行，统一归一化系统 CPU / 负载 / 核心数、JVM CPU、系统 / JVM 内存、磁盘和网络诊断摘要；首帧、计数器回退、指标不可用或无有效分母时网络比率展示 `--`。分组列头负责排序，列表在卡片内部滚动；组件不直接创建订阅。
3. 收敛 CPU / 内存趋势组件，使指标切换保持时间范围和节点选择状态，并默认 JVM。
4. 将横向滚动节点图例升级为可搜索、多选、恢复默认的节点聚焦控件。
5. 为每张卡片提供独立刷新入口；区分快捷时间和自定义时间。
6. 页面通过 `provideSystemMonitorRuntime` 提供实例级共享订阅，CPU / 内存 / 网络分别管理节点选择；三者共享默认重点节点算法，但后续选择互不影响。缓存保持 `jetlinks.runtime.monitor.focused-nodes.v2`，兼容旧版共享选择缓存。网络一次查询上行和下行两组数据并在底部展示。
7. 补齐中英文 i18n，清理调试输出和无效状态。
8. 扩展统一实时快照状态机，计算磁盘读写与网络收发吞吐；磁盘、网络仍各占一个一级列，通过两层紧凑摘要展示，避免新增横向指标列。
9. 在 `utils/networkData.ts` 维护历史网络点归一化和 counter 派生函数；`useNetworkTrend` 编排指标切换与图表配置，`useMonitorHistory` 管理时间范围和请求竞态，`services/history.ts` 调用既有 API。三张趋势卡片复用 `TrendPanel`、`TrendToolbar` 和 `MonitorCard`。
10. 网络头部复用现有监控感知布局，使用“标题 + 指标 segmented / 时间范围 + 刷新”；快捷时间移入日期选择器底部，与 CPU / 内存保持一致。
11. 网络卡片从共享 runtime 获取实时节点全集；图表只渲染“当前选择 ∩ 当前指标有数据节点”，指标切换不得反向修改 network 聚焦缓存。
12. 实时订阅由页面统一释放，独立使用的组件自行管理生命周期；预览不发请求。历史请求只接收最新一轮结果，提供加载、空数据、失败重试状态。普通实时采样保留节点选择引用，避免重置历史图缩放。
13. 拖动或缩放只更新画布布局，不重新挂载业务组件，不重置当前指标、时间范围或节点选择。网络卡片继续受社区版条件限制。

## 验收边界与风险

- 自动化测试覆盖指标归一化、健康信号、counter 派生、缓存兼容、共享订阅、停用与卸载清理、预览无请求、超时恢复、请求竞态和独立节点选择。
- 页面验收应覆盖指标及时间范围切换、错误重试、拖动缩放、布局刷新恢复，以及离开页面后的订阅释放；真实多节点环境还应覆盖节点加入、离开、清空选择与排序。
- 实时吞吐在极端大单位或超长本地化文案下仍依赖紧凑格式；新增网络指标应进入诊断下钻，不继续挤入当前摘要。
- `system_monitor` 默认一分钟一个原始历史点，长时间范围查询应检查耗时与渲染性能；沿用既有历史接口，不新增后端聚合契约。
- 阶段测试数量、浏览器证据、构建与类型检查结果以对应 PR / CI 为准，不作为本设计文档的长期结论。
