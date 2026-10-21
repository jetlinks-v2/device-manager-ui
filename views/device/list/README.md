# 设备列表范围侧栏

## 网关列表引导扩展

实施计划（已确认）：Provider 增加可选列表引导组件，统一列表传递激活状态与手动接入意图，接收列表刷新事件；弹窗、待办、偏好和轮询由 edge-master-ui 持有。进入网关分类按扫码说明、待办顺序提示，筛选／翻页不重开；其他分类沿用原有新增入口。跨模块复用走注册表，不修改菜单权限、后端和运营端。关键入口为 deviceListProvider.ts 与 views/device/list/unified/。

当前契约：`DeviceListProvider.listGuide?: Component` 接收 `active`、递增的手动接入 `request`、可选 `projectId`，发出 `refresh`。`useUnifiedDeviceActions.ts` 优先将扩展分类的手动按钮及 `action=create` 交给引导；无扩展时继续使用原组件／路由入口。`unified/index.vue` 传入 `resolveIotProjectId(route, '')`，避免默认示例项目进入偏好键。引导实际逻辑及独立视频详情由 edge 模块负责，查询不附带设备列表的搜索、分页或范围条件。

验证：edge 模块的网关引导与详情定向测试 37/37 通过，包含本模块激活状态、项目上下文、刷新及手动接入接线契约；本模块现有分类、状态与批量回归 6/7 通过，批量权限测试的旧 `<table-actions>` 正则在 HEAD 同样失败，本次未改变权限行为。`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 生产构建和 `git diff --check` 通过；工作区／模块未配置 lint。`pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit` 仍被既有 `views/link/Certificate/type.d.ts:2` TS1005 阻断，修复后需重跑。浏览器用模拟接口验证引导宿主的顺序、跳转和偏好；真实统一列表、用户／项目切换与权限联调仍待部署环境验收。详见 [网关功能说明](../../../../edge-master-ui/docs/设备资产我的网关列表说明.md)。

## Modbus 映射组件与国际化

当前结论：已按业务职责原样拆分原 6,897 行组件，主入口缩减为 56 行，补齐 396 对中英文国际化资源。以 Git 基线中的原文件为事实来源，保持原业务逻辑、中文内容、DOM 结构、控件参数、样式值及顺序；英文布局扩展仅在英文语言条件下生效。

影响范围：运行时 `device-manager-ui` 的 `views/device/Instance/Detail/Parsing/ModbusMapping.vue`、相邻 `modbus/` 子组件与 hooks、列表详情共用入口，以及模块中英文资源。旧解析页只接入国际化，中文仍使用其原文。

实现入口：

1. `views/device/Instance/Detail/Parsing/modbus/mapping/`：映射表、属性/地址/解析编辑、配置抽屉和地址说明。`modbus/debug/`：编解码调试、报文可视化及响应导入。共 15 个子组件，每个均少于 300 行；原模板片段与空白保留。
2. `modbus/useModbusMapping.ts` 负责组合状态；业务 hooks 与 `modbus/protocol/` 按原声明搬迁地址、解析类型、字节布局、配置序列化、报文分析、模拟报文、解码、编码与导入规则，保留原事件、watch、防抖、生命周期及请求顺序。
3. 中文资源逐字对应原文件，保留富文本标签、标点和格式；英文使用 Holding Register、Input Register、Coil、Discrete Input、Unit ID、Function Code、Mask Write Register 等行业术语。
4. 原选择器、声明值和顺序保存在各组件 scoped less 中。`modbus/responsive.less` 仅在 `.mm-locale-en` 或 `.mm-fill-modal-en` 下提供英文换行、窄调试栏与弹窗滚动适配，中文不使用这些规则。

边界：不调整业务规则、缓存策略、请求时序、错误处理、拖拽行为、中文措辞或中文视觉；不修改运营端 `ui/`、后端、路由、菜单、权限与物模型。`loadConfig`、`saveConfig`、`addMapping`、`loading`、`saving` 对外契约保持原样。

验证结果：

- 在模块根执行 `node --test tests/modbusMappingRules.test.mjs`，13 项通过，覆盖原地址规则、类型筛选、字节布局、持久化契约、报文格式、位/字可视化、响应导入、编解码接口及国际化资源。
- 18 个 Vue SFC 的脚本与模板编译通过；396 对资源键及占位符核对通过；196 段业务声明与生命周期代码在反解国际化后，与原文件 AST 对照无差异；`git diff --check` 通过。
- 使用真实组件及模拟 API，在同一浏览器页签、1440×900、相同数据与状态下对照原版和拆分版：初始页面 475 个元素、新增空行 541 个元素、寄存器解码 633 个元素、线圈解码 536 个元素的文本、属性、位置尺寸及 29 项计算样式无差异；配置抽屉 206 个元素、多寄存器导入弹窗 92 个元素的文本、位置尺寸及所核对的 15 项样式无差异。最终英文适配完成后，再次确认中文空行页面与导入弹窗无差异。
- 英文页面在 1440×900、1280×720 和最窄调试栏下完成检查，无页面横向溢出；抽屉正文滚动正常，导入弹窗的底部按钮保持可见，多寄存器拆行预览与读写模式切换可用。列表详情共用入口在模拟 API 下成功调用 `loadConfig`、`saveConfig`，保留对外 ref 方法。
- 在 `runtime-ui` 执行 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui`，最终生产构建通过（11,157 个模块，1 分 55 秒）；保留既有资源路径、输出配置、循环分块与大包告警。

验证限制：完整 `pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit` 被未改动的 `views/link/Certificate/type.d.ts:2` TS1005 语法错误阻断；另对上述 18 个 SFC 及其依赖运行定向 typecheck，本次文件无诊断，依赖链仍有既有类型与声明错误，不能据此宣称完整 typecheck 通过。工作区和模块未配置 lint 脚本。实际设备详情页的接口受 403 限制，本次浏览器对照使用模拟 API，尚未完成真实后端和设备联调。


## 按部署方式配置设备搜索项（已实施）

目标与范围：运行时资源中心设备列表的搜索项按部署方式区分。归属 `device-manager-ui`，字段事实源为 `deviceListFilter.ts#getDeviceListFilterFields`，由 `views/device/list/unified/useUnifiedDeviceList.ts` 传给 `components/IotDeviceAssetSearchBar.vue`；条件查询、URL 解码及批量操作继续复用同一份字段配置。

实现规则：

1. 复用 `jetlinks-web-core/src/utils/deployment.ts#isPrivateDeployment`；`VITE_APP_ENVIRONMENT` 为空时使用私有化字段，非空环境保留现有精简字段。
2. 私有化搜索项与 `views/device/Instance/index.vue` 对齐：设备 ID、设备名称、产品名称、创建时间、状态、产品分类、接入方式、设备类型、所属组织、标签、说明。“所属组织”沿用参考页的动态显示条件，仅非社区版且存在 `system/Department` 菜单时提供。复用现有产品、分类、设备接入及组织树查询和国际化资源；产品与接入配置支持远程名称搜索、按已选 ID 回查显示名称，分类和组织保留树形层级。
3. SaaS 保留设备名称、设备 ID、设备类型、接入方式、产品五项；设备类型使用直连设备、网关子设备、网关设备选项，接入方式使用已安装设备库中的 `accessProvider/accessName` 去重选项，继续按 `accessProvider` 查询。私有化的接入方式则按参考页选择具体接入配置，提交 `accessId`。
4. `getDeviceListSearchTerms` 将分类、具体接入配置和接入 Provider 转为 `productId$product-info` 关联条件；说明映射为 `describe`，标签展开为保留 AND / OR 关系的条件组。标签复用 `views/device/Instance/components/TagSearch.vue`，同时补全其 `change` 事件值，并修复超过三项、清空及逻辑连接符回显。
5. 所属组织复用 `api/product.ts#queryOrgThree`，按组织名称展示完整树路径；节点值为 `id$dim-assets` 所需的设备资产关联条件，`assetType` 为 `device`、目标类型为 `org`。查询列已携带 `dim-assets` 操作符，提交时移除编辑器使用的 `eq`，与实例页查询协议一致；URL 回显继续使用同一份树形字段配置。

影响边界：仅修改 `runtime-ui/modules/device-manager-ui` 的搜索配置、共享标签编辑器及相关回归测试；参考页复用的标签编辑器同步获得回显修复，未调整其搜索字段配置。通用搜索外壳、运营端 `ui/`、后端接口、菜单、权限和左侧范围筛选保持原有行为。

验证结果：

- 在模块根执行 `node --test tests/deviceListFilterDeployment.test.mjs tests/deviceSearchQueryContract.test.ts tests/deviceProductQuery.test.mjs`，10 项通过，覆盖部署字段集合、组织的版本与菜单显示边界、组织层级和设备资产查询、远程选项、URL 编解码、关联条件、日期、说明及标签编辑器回显和提交。
- `TagSearch.vue` 与 `IotDeviceAssetSearchBar.vue` 的 Vue 脚本和模板编译通过；`git diff --check` 通过。
- 补齐所属组织后，在 `runtime-ui` 执行 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui --VITE_APP_ENVIRONMENT=`，私有化生产构建通过（11,138 个模块，1 分 27 秒）；产物输出到模块 `dist/`，保留既有资源路径、大包与输出配置告警。
- SaaS 页面已确认仍有五项筛选，设备类型展示三个中文选项；选择直连设备后结果由 4 条变为 3 条，刷新仍回显且保留筛选，清空后移除 URL 的 `q` 并保留原有范围参数。

验证限制：在 `runtime-ui` 执行 `pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit`，被未改动的 `views/link/Certificate/type.d.ts:2` TS1005 语法错误阻断，修复后需重跑；工作区和模块未配置 lint 脚本。尚需在对应部署环境验证 SaaS 接入方式选择及私有化筛选（含所属组织）的完整页面交互；这些条件的字段配置与查询转换已有上述自动化检查。部署方式在构建时确定，切换需要重新构建。

## 概览累计活跃时长

目标与范围：运行时 `device-manager-ui` 设备概览的累计活跃时长按“天、小时、分钟”完整显示，例如 `2621h 00m` 显示为 `109天 5小时 0分钟`；卡片与趋势提示复用 `components/device-detail/iotDeviceOverviewCharts.ts#formatDuration`，入口为 `components/device-detail/IotDeviceOverviewTab.vue`。

实施与边界：按 S 级局部调整，将毫秒值截取为整分钟，再拆分为天、剩余小时和剩余分钟，并同步中英文文案。累计时长卡片的数值横跨两列，窄宽度下按时长分段换行，小趋势图移到说明行，避免分钟被截断；对应样式为 `components/device-detail/IotDeviceOverviewTab.css`。保留零值与负值归零行为；不改变累计在线时长数据来源、接口和其他时长指标，不修改 `ui/`。验证跨小时、跨天与零值，并检查卡片完整显示。

验证结果：实际 `formatDuration` 函数的 10 个中文边界值与 1 个英文文案检查通过，覆盖零值、负值、整分钟截取、跨小时、跨天及长时长；TypeScript 语法检查与 `git diff --check` 通过。在 `runtime-ui` 执行 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 生产构建通过（1 分 14 秒，保留大包告警）。本地 `http://localhost:9200/#/resources/devices/list/Detail/2064898513186066432` 已确认累计时长完整显示为“109天 5小时 7分钟”，小趋势图保留。

验证限制：模块与工作区未提供 lint 脚本；`pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit` 被未改动的 `views/link/Certificate/type.d.ts:2` TS1005 语法错误阻断，修复后需在 `runtime-ui` 重跑该命令。尚未验证其他视口下的换行效果。

## 设备数据属性卡片趋势

目标与范围：`device-manager-ui` 的设备数据属性卡片始终保留趋势区域，在 `components/device-detail/IotDevicePropertySparkline.vue` 中按物模型声明类型决定是否绘制折线。复用 `components/device-detail/useIotDevicePropertySparklineData.ts#isNumericProperty`，仅 `int`、`float`、`double`、`long`、`number` 显示趋势；字符串（包括纯数字字符串）、密码、时间、地理位置等非数值属性统一显示“暂无趋势”占位。

实施与边界：按 S 级局部修复，导出现有数值类型判断；趋势组件对非数值属性返回空展示数据，复用原有空态。`components/device-detail/IotDeviceDataTableTab.vue` 保持渲染趋势组件；不改变属性值、数据详情弹窗、读写操作、聚合查询或订阅，不修改 `ui/`。主要风险是将纯数字文本误判为数值，判断依据必须保持为 `valueType.type`，缺失时回退到 `dataType`。

验证结果：属性卡片与趋势组件的 Vue 脚本、模板编译和 TypeScript 语法检查、`git diff --check` 均通过；在 `runtime-ui` 执行 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 生产构建通过（47.94 秒，保留既有 CSS 注释、资源路径与大包告警）。本地 `http://localhost:9201/#/resources/devices/list/Detail/2097962396260003840?type=device&tab=data` 已确认地理位置、密码、时间、字符串均显示“暂无趋势”，没有图表；A/B/C 三个数值属性保留原有未上报空态。

验证限制：模块与工作区未提供 lint 脚本；`pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit` 被未改动的 `views/link/Certificate/type.d.ts:2` TS1005 语法错误阻断，修复后需在 `runtime-ui` 重跑该命令。当前设备的数值属性尚未上报，浏览器已验证趋势区域保留，未覆盖有历史数值时的实际曲线。

## 范围树名称搜索

目标与范围：在 `device-manager-ui` 的范围侧栏分段器与树之间增加 `a-input`，通过 `prefix` 插槽展示搜索图标，支持清空。`components/IotDeviceScopeSidebar.vue` 负责展示，`hooks/useIotDeviceScopeSidebar.ts` 复用公共树过滤能力按名称筛选，保留匹配节点的父级路径并展开结果；清空后恢复完整树，无匹配时展示空态。搜索文案同步补齐中英文资源。

实施边界：搜索仅作用于已加载的空间 / 分组树，不改变设备列表查询、范围选择事件、统计或后端接口，不修改 `ui/`。按局部 S 级改动实施。

验证结果：侧栏 Vue 脚本、模板、样式编译与新增中英文文案检查通过；`git diff --check` 通过。本地 `http://localhost:9200/#/resources/devices/list?scopeType=area` 已确认搜索框位于分段器与树之间、左侧显示搜索图标；搜索“接待”展示“北京南华区 → 富国街 → XX大厦 → 1楼接待”路径，清空恢复完整树，无匹配时展示“暂无匹配结果”；分组搜索“项目”仅显示两个匹配分组，切换范围清空关键词，搜索期间设备列表仍为 33 条。

验证限制：`pnpm exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit` 被未改动的 `views/link/Certificate/type.d.ts:2` TS1005 语法错误阻断，修复后需重跑。本模块与工作区无 lint 脚本；`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 生产构建通过（9,633 个模块转换，保留既有 CSS 注释与输出配置提示）。

交付入口：提交 `924e423`；PR https://github.com/jetlinks-v2/device-manager-ui/pull/315。

## 范围树滚动区布局

目标：将 `views/device/list/components/IotDeviceScopeSidebar.vue` 的侧栏内容改为纵向弹性布局，使范围树滚动区占用剩余高度，分组创建按钮保留在底部。仅调整样式，不改范围筛选、树节点、权限或接口；样式差异与 `git diff --check` 已核对。按本次交付要求不执行构建，也未运行 lint、typecheck 或浏览器验证，长列表及不同容器高度下的实际滚动效果仍需人工复核。

## 统一列表状态快捷筛选（2026-09-22）

目标：将“在线 / 离线 / 禁用”从自定义切换外观收敛为与工具栏一致的 Ant Design 按钮组；仍然只有三个状态，默认均不选中，重复点击已选状态清除筛选，不增加“全部”选项。影响范围仅为 `views/device/list/unified/index.vue` 的状态控件展示，保留 `useUnifiedDeviceList.ts#changeStatus`、状态计数、URL 筛选及其他工具栏操作。

实施：复用 `a-button-group`、`a-button` 和 `a-badge`，显示三种状态、各自计数及明确的选中反馈；不改 API、列表字段、范围侧栏或公共 `SwitchGroup`。验证：定向测试、页面逐项点击与重复点击、差异检查；考虑本机性能，不运行全量构建。

验证结果：`node --test modules/device-manager-ui/tests/unifiedDeviceStatusFilter.test.mjs modules/device-manager-ui/tests/unifiedDeviceTabs.test.mjs` 4 项通过，包含页面脚本／模板编译与三状态、再次点击清除筛选的源码契约；本模块 `git diff --check` 通过。`unified/index.vue` 原本已超过 300 行，本次只是局部替换，现为 309 行。浏览器窗口正在由用户操作，本次没有切换或刷新其 SaaS 页签；实际三种状态切换、宽度与颜色仍需在 `http://localhost:9200/#/resources/devices/list?type=gateway` 人工复核。未运行完整 typecheck、lint 或生产构建；发布环境需更新运行时前端静态资源，无后端变更。

## 按部署方式控制视频分类页签（已实施，2026-09-22）

目标：运行时资源中心统一设备列表在私有化构建中展示“视频”页签，在 SaaS 构建中继续隐藏该页签；两种部署方式都保留视频 Provider、设备识别、分类直达和详情能力。

影响范围：`device-manager-ui/deviceListProvider.ts` 的分类可见性契约、`views/device/list/unified/useUnifiedDeviceList.ts` 的页签选项，以及 `jetlinks-media-ui/deviceListProvider.ts` 的视频分类配置。

不做：不删除视频 Provider、设备数据、`?type=video` 直达处理、详情页通道能力或独立的“视频管理 / 视频列表”菜单；不改 `ui/`、后端接口与权限。

实施：保留分类 Provider 现有 `showInTabs` 契约，由 `jetlinks-media-ui/deviceListProvider.ts` 使用 `isPrivateDeployment()` 决定视频页签可见性；分类识别与 `?type=video` 直达仍按原逻辑运行。保持现有表格工作区、筛选和详情承载方式，不引入新的交互壳层。

风险与验证：部署类型由构建时的 `VITE_APP_ENVIRONMENT` 决定，私有化为空字符串，SaaS 为 `saas`；不能用 `!isSaaS` 代替，因为其他非 SaaS 环境也可能使用该构建。`node --test tests/unifiedDeviceTabs.test.mjs tests/deviceDetailContent.test.mjs` 共 11 项通过，覆盖私有化显示契约、SaaS 隐藏契约、隐藏 Provider 仍参与分类与直达，以及既有视频详情内容；`device-manager-ui` 与 `jetlinks-media-ui` 的 `git diff --check` 通过。未执行浏览器、完整 typecheck 或生产构建；生产环境需要重新发布对应部署类型的运行时前端资源。

## 接入设备回退并保留表单

目标：在运行时前端“接入设备”弹窗的设备配置步骤，将取消操作替换为“上一步”；返回设备库模板或产品选择后，用户重新选择设备时继续回显本次打开弹窗期间已经填写的设备信息。

影响范围与 owning module：

- `runtime-ui/modules/device-manager-ui/views/device/list/components/IotAddDeviceDrawer.vue`：在非编辑、非创建中的配置步骤触发回退，不关闭抽屉也不清空表单；回退后的下一次模板或产品选择不应用来源默认名称和图片。
- `runtime-ui/modules/device-manager-ui/views/device/list/components/IotAddDeviceModalFooter.vue`：支持在配置步骤隐藏关闭按钮，仅展示“上一步”和确认动作；编辑模式与安装进度异常时保持现有取消关闭行为。

不做：不修改 `ui/`、后端接口、设备创建提交字段或跨弹窗的表单缓存；关闭弹窗后仍按既有逻辑重置全部临时状态。

实施步骤：

1. 为页脚补充可控的关闭按钮可见性，在新增设备的配置步骤用“上一步”替换“取消”。
2. 回退时仅清除当前选择与专属创建扩展状态，保留本地 `form`、区域和分组配置；重新进入配置步骤复用原有表单。
3. 通过一次性保留标记调整来源默认值写入逻辑，使首次选择保留默认体验、后续更换设备不覆盖用户已经输入的名称或上传图片。
4. 通过模块 typecheck/lint 与浏览器手工验证产品、设备库两条路径的回退、重选和关闭重置行为。

风险与待确认：

- 重新选择的设备不应静默覆盖用户输入；以一次性保留标记跳过回退后的来源默认值。设备 ID、名称、图片、区域、分组、说明、国际化名称均始终回显。
- 专属创建扩展的内部字段由扩展自行管理；通用抽屉只保证通用设备基础信息回显。

验证结果：

- `git -C runtime-ui/modules/device-manager-ui diff --check`：通过。
- `pnpm --dir runtime-ui --filter device-manager-ui test:device-search`：通过（1/1）。
- `node --test tests/iotAddDeviceStepNavigation.test.mjs`：通过（1/1）；覆盖配置页按钮、回退行为与来源默认值不覆盖表单的回归约束。
- `pnpm --dir runtime-ui exec vue-tsc -p modules/device-manager-ui/tsconfig.json --noEmit`：未通过，未触及的 `views/link/Certificate/type.d.ts:2` 存在 TS1005 语法错误。
- `node --test tests/deviceCreationExtension.test.mjs tests/deviceLibraryMarketplaceSupport.test.mjs`：8/9 通过；失败断言来自已修改的 `../jetlinks-media-ui/views/Device/Save/index.vue` 与既有断言不一致，和本次抽屉回退改动无关。
- 浏览器（`http://localhost:9200/#/resources/devices/list`）：产品路径中，配置页仅展示“上一步”和“确定”；填写“回显验证设备”“回显验证说明”后返回产品选择并改选另一产品，名称和说明均按输入值回显，未提交创建请求。

## 范围树固定节点（已实施）

目标：在运行时前端设备列表的“区域”和“分组”范围树顶部，以带图标的固定子节点展示“全部设备”及对应的“未绑定区域”或“未分组”；固定节点使用统一的设备图标，关闭树的内置叶图标，点击后沿用现有范围筛选语义。

影响范围与 owning module：

- `runtime-ui/modules/device-manager-ui/views/device/list/components/IotDeviceScopeSidebar.vue`：移除树外“全部设备”按钮，将固定范围节点交由树统一渲染，并为固定节点与普通范围节点使用可辨识图标。
- `runtime-ui/modules/device-manager-ui/views/device/list/hooks/useIotDeviceScopeSidebar.ts`：将已存在的全部、未绑定区域、未分组筛选 ID 组装为当前树的最顶部固定节点；不改变现有 `change` 事件。

不做：不修改 `useIotDeviceAssetFilters.ts` 中既有的查询条件与路由同步，不调整范围计数、不改变分组维护入口，也不修改 `ui/`。

实施步骤：

1. 在范围树数据的根节点开头添加“全部设备”和与当前 tab 对应的未绑定范围节点，保留现有区域或分组树及其计数。
2. 使用树节点 title 插槽统一渲染图标、名称、计数和仅分组节点可见的管理菜单，固定节点不暴露管理操作；关闭树的内置叶图标，避免与标题图标重复。
3. 验证切换区域/分组、选择全部/未绑定范围/普通范围时，筛选和 URL 参数保持既有语义。

风险与验证：

- 风险：Ant Design Vue 的树节点渲染及选中态需同时覆盖固定叶子和可展开节点，避免固定节点显示无效展开控件。
- 验证：对 `runtime-ui` 执行相关 typecheck/lint（以仓库脚本为准），并在设备列表手工验证两个 tab 的树顺序、图标、计数、选中态与筛选结果。

验证结果：

- `git -C runtime-ui/modules/device-manager-ui diff --check`：通过。
- `pnpm --dir runtime-ui --filter device-manager-ui test:device-search`：通过（1/1）。
- `pnpm --dir runtime-ui --filter jetlinks-web-core build -- --module-name device-manager-ui`：按实际模块目录名执行，当前生产构建通过（9,629 个模块；仍有既有 CSS 注释、资源路径与大包告警）。
- 先前浏览器验证（`http://localhost:9200/#/resources/devices/list`）：区域和分组 tab 均在树顶部显示两个固定节点，未绑定区域和未配置分组与全部设备使用同一设备图标；选择“未绑定区域”后 URL 为 `scopeType=area&scopeId=__iot-unbound-area__`、列表共 12 条，选择“全部设备”后移除 `scopeId`、列表恢复 33 条；选择“未配置分组”后 URL 为 `scopeType=group&scopeId=__iot-unassigned-group__`、列表共 31 条。关闭内置叶图标与回退分段控件自定义样式后的视觉效果仍待复核。

剩余风险：已完成本模块生产构建；范围树的筛选、选中态已在上述本地页面验证，尚未覆盖更多数据层级与浏览器环境。

本模块与工作区均未提供 lint 脚本，未单独执行 lint；模块 `vue-tsc --noEmit` 仍被未改动的 `views/link/Certificate/type.d.ts:2` 语法错误阻断。

本次视觉收敛提交：`0aee5af`；PR：[device-manager-ui#303](https://github.com/jetlinks-v2/device-manager-ui/pull/303)。
