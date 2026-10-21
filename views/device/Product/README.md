# 产品管理

## 产品资源包导入导出

产品列表支持将单个产品导出为可移植的 ZIP 资源包，并从工具栏导入同一格式的资源包。产品 JSON 的既有导入导出入口保持不变。

资源包导入使用 `ResourcePackage/index.vue` 的分步弹窗：上传并预览脱敏清单、补充产品信息、选择本地协议/插件/证书/网络/网关后确认导入。存储策略属于产品基础信息，策略在当前环境不存在时会在“基础信息”步骤显示错误并禁止继续；网络类型、端口等接入资源校验保留在“设备接入”步骤。清单不含接入资源时跳过“设备接入”步骤，直接开始导入。导入进度使用 NDJSON 展示；关闭弹窗或组件卸载会取消订阅并清理导入状态。

接口定义位于 `api/product.ts` 与 `api/link/type.ts`，对应后端 `/device-product/resource-package` 的解析、导入和导出接口。用户可见文案统一使用 `Product.resourcePackage.*` 的中英文语言包；资源包导出复用 `device/Product:export` 权限。

## 列表状态列宽

目标：将产品列表的状态列宽从 80 调整为 90，减少状态内容拥挤。仅涉及 `views/device/Product/index.vue` 的表格展示；不改状态值、筛选、接口或其他列。列定义与 `git diff --check` 已核对；按本次交付要求不执行构建，也未运行 lint、typecheck 或浏览器验证，页面实际宽度仍需人工复核。

## 分类树虚拟节点

目标：将产品分类筛选中的“全部产品”和“未分类”统一作为分类树顶部的虚拟叶节点显示，并提供分类图标。

- 影响范围：`views/device/Product/components/ProductCategoryTree.vue` 与 `hooks/useProductCategoryTree.ts`。
- 不涉及：产品分类接口、分类数据、筛选参数或增删改分类权限。
- 实施：在 hook 中构造并优先展示两个虚拟节点；组件复用树节点标题渲染图标，并避免为虚拟节点显示分类操作菜单。树连接线保留，内置叶图标关闭，由标题图标表达分类类型。
- 风险与验证：确认选择“全部产品”“未分类”和真实分类仍触发原有筛选语义；核对树叶不再出现冗余图标，并执行目标模块的前端构建验证。

## 验证结果

- 先前本地 `http://localhost:9200/#/resources/devices/products` 热更新验证：分类树前两项依次为“全部产品”和“未分类”，且分类操作菜单未显示在这两个虚拟节点上；关闭内置叶图标后的视觉效果仍待复核。
- 本次交付的全部源码与文档通过 `git diff --check`。
- 使用实际模块目录名执行 `pnpm --dir runtime-ui --filter jetlinks-web-core build -- --module-name device-manager-ui`，当前生产构建通过（9,629 个模块；仍有既有 CSS 注释、资源路径与大包告警）。
- 模块 `vue-tsc --noEmit` 被未改动的 `views/link/Certificate/type.d.ts:2` 语法错误阻断；模块与工作区均未提供 lint 脚本，未单独执行 lint。
- 本次视觉收敛提交：`0aee5af`；PR：[device-manager-ui#303](https://github.com/jetlinks-v2/device-manager-ui/pull/303)。

## 详情摘要 Tooltip 定位

目标：使产品详情摘要中产品 ID、产品分类、设备类型、品牌和型号的 Tooltip 对齐各自文字，而非整列字段区域。

- 影响范围：`views/device/Product/Detail/components/ProductDetailSummary.vue`。
- 不涉及：产品详情接口、字段数据、Tooltip 文案或页面布局。
- 实施：以可伸缩容器承载摘要值，Tooltip 仅绑定内容宽度的值节点；长文本仍保持省略展示。
- 验证：本地详情页热更新后，DOM 中“直连设备”触发节点宽度为 55px，而其可用字段区域为 128px，Tooltip 将以文本区域定位；其余四个摘要字段使用相同结构。`git diff --check` 通过。
- 构建验证：交付时使用 `--module-name device-manager-ui` 的生产构建通过；`pnpm --dir runtime-ui/modules/device-manager-ui test:agent-tools` 此前因现有脚本未配置 `.png` loader 失败，与本次修改无关。

## 详情页删除产品

目标：在产品详情摘要右侧增加受权限控制的删除按钮；用户确认删除成功后返回产品列表。

- 影响范围：`views/device/Product/Detail/index.vue` 与 `components/ProductDetailSummary.vue`。
- 不涉及：删除接口、产品列表行为、产品数据结构、路由注册或 i18n 文案；复用现有 `api/product.ts` 的 `deleteProduct` 及列表页已有的确认、提示文案。
- 实施：详情容器传入 `device/Product:delete` 权限并执行删除请求；摘要组件新增危险样式的 `j-permission-button` 与确认弹窗，保持已启用产品不可删除的限制。成功后提示并调用现有 `backToProductList`，失败时展示既有失败提示。
- 验证：本地详情页热更新确认删除按钮位于编辑与启停按钮之间；当前已启用产品的删除按钮禁用，符合列表页限制。源码通过 `git diff --check`；交付时使用 `--module-name device-manager-ui` 的生产构建通过（9,621 个模块）。仍未覆盖确认删除后的真实接口调用与跳转。

## 条件筛选查询参数

产品列表 `views/device/Product/index.vue` 直接使用 `ConditionFilter` 的 `change` 事件输出的 `filter`；“包含”和“不包含”的查询值由组件统一补齐 `%` 并转义，页面不再调用 `buildQueryFilter` 重复转换。既有条件分组与产品字段转换仍由页面处理。

验证：实际查询构造函数与页面搜索处理函数的 9 组定向检查通过，覆盖 `like`、`nlike`、百分号与反斜杠转义、嵌套分组、产品字段转换及清空筛选；原实现的重复处理已复现。`pnpm --dir runtime-ui --filter jetlinks-web-core build -- --module-name device-manager-ui` 与 `git diff --check` 通过。`pnpm --dir runtime-ui exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 被未改动的 `views/link/Certificate/type.d.ts:2` 既有 TS1005 语法错误阻断，修复该错误后需重跑；工作区与模块未提供 lint 脚本。浏览器实际请求及后端搜索结果未验证。

## BUG-41686：私有化产品创建问答（代码与本地会话复验通过）

目标：让智能助手依据当前私有化产品页面回答创建产品、配置物模型和添加首台设备的操作问题。任务级别为 M，代码、定向验证及 `localhost:9200` 连接同一后台的真实会话复验已完成；尚未替换 `192.168.33.76:9000` 的静态前端资源。

### 已确认事实

- 复现环境：`http://192.168.33.76:9000/#/resources/devices/products`。在同一新会话中询问“如何创建产品？”并追问“给我创建 MQTT 直连产品的详细步骤。”，两次回复均错误地要求在新增产品表单中选择接入方式或 MQTT 选项。
- 实际新增弹窗包含名称、产品分类、设备类型、品牌、型号、说明和图片；名称与设备类型必填。设备类型为直连设备、网关子设备、网关设备。没有接入方式或手工填写产品 ID 的表单项，接入配置位于保存后的产品详情“设备接入”页。代码入口为 `Save/index.vue`、`DialogTips/index.vue` 和 `Detail/DeviceAccess/index.vue`。
- 已查看复现环境中的现有零设备产品：设备数量 0 为普通文本；物模型“属性定义”使用可编辑表格，填写标识、名称、数据类型等并保存，没有“新增属性”按钮。代码入口为 `Detail/components/ProductDetailSummary.vue` 和 `../components/Metadata/Base/Base.vue`。
- 修复前 `homeAgentProvider.ts` 仅声明产品查询及产品 ID 解析流程；`agentCapabilities/deviceGuidance/homeAgentProvider.ts` 只声明功能入口。实际会话请求的系统提示包含“详细引导留给目标功能，不展开步骤”，没有产品创建的页面事实。第三轮追问物模型及首台设备步骤时，回复仍只推荐功能入口；本轮没有重现历史截图中另外三项错误步骤的完整长回答。

### 影响范围与实施内容

Owning module：仅 `runtime-ui/modules/device-manager-ui`，复用 core 现有 `getWorkflowGuides` 和系统提示注入机制。

1. `homeAgentProvider.ts` 的 `getPrivateProductCreationGuides` 补充私有化产品创建流程；使用现有 `isPrivateDeployment()` 和产品菜单可见性控制声明范围，保留已有产品搜索与 ID 解析行为。`getProductSystemPromptLines` 同时将关键页面事实放入每次请求的系统提示。
2. 流程依据实际组件说明：在产品列表点击“新增”，填写名称、设备类型及可选字段并确定；保存后进入详情选择设备接入配置；物模型通过表格逐格填写并保存；添加首台设备从已授权设备列表的“接入设备”入口选择所属产品继续，不依赖设备数量 0 的跳转。
3. 中英文说明同步明确三种设备类型、产品 ID 非手填项，以及 MQTT 接入配置所在阶段；协议、Topic、认证和连接参数只依据已选接入配置或其使用引导回答，不编造通用参数。
4. 细化 `DeviceFunctionGuidance.prompt` 的入口导览规则：用户明确要求详细步骤、且当前已声明对应页面流程时，按流程回答；缺少流程事实时继续推荐入口，不自行补全。具体改动落点为产品 provider、`locales/lang/zh.json` 和 `locales/lang/en.json`。
5. 首台设备步骤通过 `createDeviceGuidanceCapabilities` 复用 `DEVICE_GUIDANCE_MENU_CODES.onboarding` 的现有菜单身份，只在当前账号可访问设备列表时提供；权限撤销后不再返回该步骤。已有产品从用户所问阶段继续，不重复创建。`tests/productCreationGuidance.test.mjs` 覆盖这些边界，并接入现有 `scripts/run-agent-tool-tests.mjs`。
6. 本地真实对话复验发现模型仍会把产品弹窗“确定”写成“保存”，将成功提示框误说成自动跳转，并按设备列表标题猜测不存在的 `device/Device` 菜单。进一步在每次请求中明确“确定”、成功后点击“查看详情”及“物模型→属性定义”路径，并复用现有设备功能声明及 core 的 `compactHomeAgentCapability` 提供真实受控入口链接，供模型直接引用。

边界：不调整产品表单、设备数量跳转、物模型编辑器、菜单与路由、后端接口或 `ui/`；不将该私有化创建流程应用到 SaaS 模板创建场景。

### 风险与验证

- 权限与部署：验证私有化且可访问产品菜单时可提供流程；无产品菜单权限和 SaaS 环境不声明该流程。默认入口推荐与明确追问详细步骤分别验证，避免提示规则互相矛盾。
- 内容与交互：用新会话依次验证“如何创建产品”“创建 MQTT 直连产品的详细步骤”“如何定义属性”“产品还没有设备如何添加第一台设备”，并对照实际字段、按钮和页签；模型输出存在不确定性，静态契约验证不能代替实际会话验收。
- 本轮只读验证：已确认上述实际错误回复、表单字段、三种设备类型、物模型表格和零设备数量行为；未保存产品、物模型或设备数据。
- 在模块目录执行 `node --test tests/productCreationGuidance.test.mjs`，8 项定向验证通过，覆盖实际 provider 的私有化/SaaS 分支、产品菜单权限、设备菜单身份、权限撤销、文案占位符及四类页面事实；测试只加载 provider、真实部署判定函数和必要依赖，不连接后端。
- 在模块目录执行 `node scripts/run-agent-tool-tests.mjs`，145 项助手工具回归全部通过，包含上述 8 项新增验证；既有功能入口导览、设备查询和工具契约保持通过。
- 中英文 JSON 校验通过：两侧各新增 16 个产品指引键，修改 1 个入口提示键；变更键集合与占位符一致，新增英文文案无中文残留。`git diff --check` 通过。
- 开发模块验证：现有 Vite 服务正常转换修改后的 provider 并返回 HTTP 200。本次进一步使用用户新启动的 `http://localhost:9200`，连接 `192.168.33.76:9000` 的同一后台复验，不再以先前 `.env` 文件的静态值判断该运行进程。
- 实际请求验证：刷新本地前端并新建会话后，抓取发送给模型的系统提示，确认包含私有化表单事实、“确定”按钮、成功后手动点击“查看详情”、“物模型→属性定义”路径以及真实的 `#feature=device-entry%3Aonboarding` 受控入口。
- 真实对话验证：先后验证“如何创建产品”和 MQTT 详细步骤；补齐复验发现的按钮文案、成功提示与入口链接后，使用最终代码新建独立会话，一次完整提问涵盖 MQTT 产品创建、创建后进入详情、物模型属性定义及零设备产品的首台设备入口。最终回复正确说明必填/可选字段、选择直连设备、点击“确定”、在成功提示中点击“查看详情”、创建后进入“设备接入”页配置 MQTT，以及在物模型表格空白行填写并保存；没有要求填写产品 ID、在新增弹窗选择接入方式、点击“新增属性”或通过设备数量 0 跳转。
- 链接交互验证：实际点击最终回复中的“接入设备”，成功进入 `http://localhost:9200/#/resources/devices/list?type=all`，并自动打开“请选择要接入的设备”产品选择弹窗；完成检查后取消。整个复验只创建问答会话并打开/关闭页面弹窗，没有保存产品、物模型或设备业务数据。
- 按设备性能限制，未执行应用生产 build、完整 typecheck 或 lint。需要时待执行命令为 `pnpm --dir runtime-ui exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 和 `pnpm --dir runtime-ui --filter jetlinks-web-core build -- --module-name device-manager-ui`；完整 lint 命令当前未在工作区或模块脚本中提供。
- 交付依赖：本地新前端连接现有 AI 服务和模型已完成上述复验；正式使用 `192.168.33.76:9000` 的页面仍需发布新的 runtime-ui 私有化前端资源并刷新。本次没有后端服务修改，不需要因本次改动重启后端。
