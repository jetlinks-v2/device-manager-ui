# 设备分组页面

## Figma 样式还原计划

### 目标与结论

物联运营人员需要在同一页面浏览区域 / 业务分组，并快速查看所选分组的设备运行概览。本次按 Figma `jetlinks clode Copy` 的以下节点还原现有页面的视觉层级与布局；左侧分组导航最终以用户提供的 `Sidebar.png`（`720 × 2718` 三倍图）为视觉参考：

- 左侧分组导航：`4687:7214`
- 右侧摘要头：`4693:7309`
- 顶部指标：`4694:8471`
- 设备数量切图：`4694:8208`
- 离线 / 无数据切图：`4694:8232`
- 数据异常切图：`4698:5868`
- 健康评分切图：`4694:8293`
- 运行趋势：`4694:8319`
- 核心状态分布：`4694:8472`
- 近期状态：`4697:6057`

页面保持“主从详情工作区”结构。Figma 作为视觉事实源，现有代码和接口作为业务事实源；设计稿中的尺寸映射到已有 CSS 变量，确无变量时按 `16px = 1rem` 换算。

### 影响范围与 owning module

Owning module 为 `ui/modules/iot-ui`，预计只调整：

- `views/device/groups/components/IotDeviceGroupsView.vue`：主从列宽、页面高度与响应式布局。
- `views/device/groups/components/IotDeviceGroupsSidebar.vue` / `IotDeviceGroupsSidebar.css`：分组切换、搜索、树节点、设备总数、选中态及底部统计的布局样式。
- `views/device/groups/components/IotDeviceGroupsDetailCard.vue`：摘要头与 Tab 切换布局。
- `views/device/groups/components/IotDeviceGroupsDetailCard.css`：摘要卡、Tab 和设备列表承载区样式。
- `views/device/groups/components/IotDeviceGroupsOverviewTab.vue` / `IotDeviceGroupsOverviewTab.css`：指标、趋势、状态分布和近期动态的卡片结构与样式。
- `assets/device-groups/*.svg`：顶部四张指标卡使用的 Figma 原始 SVG 切图。

### 明确不做

- 不修改接口、请求参数、数据口径、响应式状态、权限、路由、国际化文案或设备分组操作逻辑。
- 不修改 `runtime-ui/`、后端模块或 `jetlinks-web-core` 全局样式。
- 不新增 Tailwind、图片依赖或新的业务组件；继续复用 Ant Design Vue、`AIcon`、`CloudEmpty`、`JEcharts` 和已有 CSS 变量。
- 不虚构参考图中的“3楼 / 4楼”等节点数据；区域名称、层级和设备总数继续使用现有真实数据。

### 方案档案

- `solutionName`：主从详情工作区
- `primaryFilterSurface`：左侧区域 / 业务分组类型切换与轻量搜索
- `contentSurface`：右侧分组运行概览 / 设备列表
- `detailCarrier`：独立摘要卡 + 指标卡 + 趋势卡 + 状态双栏卡
- `editMode`：保持现有抽屉、弹窗和就近动作，不新增编辑入口
- `coreComponents`：`EqualHeightColumns`、Ant Design Vue `Segmented` / `Tree` / `InputSearch`、`AIcon`、`CloudEmpty`、`JEcharts`
- `actionPlacement`：分组动作留在左侧节点附近，绑定设备动作留在右侧摘要区
- `densityTarget`：左侧树节点单行仅展开箭头、名称与设备总数；右侧每个区块单层卡片，桌面首屏呈现核心概览
- `sidebarMode`：固定约 `15rem`，窄屏降级为单列
- `confirmationMode`：按仓库 M 级任务门禁，计划确认后实施
- `rejectedAlternatives`：不改成标准管理表格页、监控大屏或单对象详情页，因为当前高频任务是切换分组并保持右侧上下文
- `searchShellDecision`：恢复现有轻量固定搜索，不引入 `ConditionFilter`，避免超出局部调整范围

### 实施步骤

1. 将页面主布局对齐 Figma 的 `15rem + 1fr` 主从结构，并保留窄屏单列降级。
2. 左侧保留搜索区与底部分组 / 设备统计，移除 Tab 数量、节点业务图标、风险点和树连接线；节点右侧仅展示设备总数。
3. 调整现有模板的展示层结构，使顶部指标收敛为“设备数量 / 离线或无数据 / 数据异常 / 健康评分”四张卡片；在线率合并到设备数量卡底部，四张卡片分别使用 Figma 节点 `4694:8208`、`4694:8232`、`4698:5868`、`4694:8293` 的本地 SVG 切图，进度填充均使用对应语义色渐变；核心状态分布的在线、离线、禁用圆弧分别使用强调色、中性色、警告色渐变，图例使用对应状态图标并收紧为中等圆角；不改变任何数据来源或事件。
4. 运行趋势采用 `0–100%` 固定纵轴、青色平滑面积线、虚线网格、图例与单位标识，并常驻展示 `70%` 警戒线；接口返回 `0–10` 刻度时仅在绘图层映射为百分比。
5. 使用已有 `--space-*`、`--fs-*`、`--ink-*`、`--bg*`、`--line`、`--accent*` 和状态色变量；局部固定尺寸全部使用 `rem`。
6. 检查窄屏换行、滚动边界、文字截断和空态居中，确保无重叠与布局跳动。

### 风险与待确认点

- 顶部指标按最新设计确认合并在线率，不再单独占用卡片；展示层仍复用现有 `stats` 数组中的五项数据，避免改变统计口径及其他消费方。
- 用户确认搜索与底部统计属于必要功能，因此在参考图的树导航视觉基础上保留这两个现有区块；不修改接口、数据口径或选择 / 展开逻辑。
- Figma 节点按约 `998px` 右栏设计；更窄视口将采用自适应栅格，保证业务内容可用而不做等比压缩。

### 验证方式

- 运行 `ui/package.json` 中真实存在的类型检查 / 构建脚本，至少覆盖 `iot-ui` 模块。
- 在 `http://localhost:9102/ht_device/#/iot-user/device/groups` 验证 1567×909 桌面视口，并补充一个窄屏视口检查。
- 对照六个 Figma 节点检查卡片尺寸、间距、圆角、颜色变量、标题层级、图表与双栏比例。
- 对照用户提供的核心状态分布参考图，检查三段圆弧渐变、状态图标、图例颜色和圆角。
- 验证区域 / 业务切换、搜索、树展开与选中、Tab 切换、绑定及业务分组新增 / 编辑 / 删除入口未受影响。

### 验证结果

- `pnpm -F jetlinks-web-core build -- --module-name iot-ui`：通过，构建 8,003 个模块，四个 SVG 均进入模块产物；只有仓库既有 CSS 注释、Rollup 输出选项和大 chunk 警告。
- `pnpm exec vue-tsc --noEmit -p modules/iot-ui/tsconfig.json`：工作区存在既有类型错误；定向过滤后 `views/device/groups` 无错误。
- `git diff --check -- modules/iot-ui/views/device/groups`：通过。
- 修改后的 `IotDeviceGroupsOverviewTab.vue` 为 298 行，新抽取的纯展示映射 `deviceGroupStatusPresentation.ts` 为 25 行；新增样式未使用 `px`、hex 或 `rgba()` 硬编码。
- 浏览器刷新与截图校验：`1567 × 909` 下顶部为四列等宽卡片，在线率已并入设备数量卡，四条填充均解析为 `linear-gradient` 且卡片无溢出；`768 × 900` 下统计卡降为单列，四张卡片内容均无溢出。页面外层导航在窄屏仍有约 `30px` 的既有横向溢出，不属于本次统计卡改动。
- 核心状态分布专项校验：已在 `1292 × 909` 视口确认在线、离线、禁用分别使用强调色、中性色、警告色图标，环形图使用对应深浅渐变，图例为 `8px` 圆角且三项文案保持单行。
- 顶部指标切图专项校验：四个 SVG 均完成加载，自然尺寸依次为 `36 × 32`、`33 × 32`、`34 × 29`、`31 × 28`，实际渲染保持原始比例并完整位于 `48 × 48` 图标底座中；控制台无资源加载错误，仅有开发环境既有的 `WebSocket CloseEvent`。

commit hash、PR 地址：pending。
