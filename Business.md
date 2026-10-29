# 物联业务说明

本文件用于记录 `iot-ui` 的业务边界与页面入口说明。当前模块以设备运营为主，覆盖设备总览、设备分组、设备列表、设备详情和设备健康分析。

## 最近变更

本轮产品与设备列表交互调整的代码提交为 `3b6f473`，评审入口为 [PR #300](https://github.com/jetlinks-v2/device-manager-ui/pull/300)；产品详情与分类树、接入设备回退和范围树的实现入口及验证边界分别见 `views/device/Product/README.md` 与 `views/device/list/README.md`。

### 2.20 交付验证与配套要求

- 2026-10-29 基于最新 `origin/2.20`（`08a5b17`）核验本模块的上传、国际化和接入页面改动；26 个文件的原有源码完整迁移，中英文资源同时保留远端新增词条。17 个改动 Vue 文件的脚本／模板、证书详情 Less 及中英文 JSON 检查通过。
- 公共国际化测试 `node scripts/test-i18n-components.mjs` 通过（10/10）；固件国际化流程检查通过（7 组），手工固件、协议包及插件上传适配检查通过，覆盖编辑回显、后缀大小写、上传状态、异常响应、失败恢复、凭证编码、结果回填与移除。定向检查使用真实 Vue 响应式及平台边界替身，不代表真实上传、解析和持久化联调。
- 在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-device-manager-ui-delivery-build-20261029 -- --module-name device-manager-ui` 通过（11,310 个模块，2 分 30 秒），保留既有资源路径、Rollup 输出选项、CSS 注释和包体积告警；`git diff --check` 通过，工作区与模块无独立 lint 脚本。
- 完整类型检查命令为在 `runtime-ui/` 执行 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`。原先两处 TS1005 已由最新基线修复；基线和改动后均报告 1,824 项类型诊断。忽略位置变化后 1,823 项完全一致，插件列表另 1 项仅列联合类型展开变化，底层仍是原有 `search.options` 的 `Promise<unknown>` 类型不兼容，未发现新增诊断原因；完整类型检查仍未通过。
- 文件回显下载及返回按钮公共样式需配套 [jetlinks-web-core PR #201](https://github.com/jetlinks-v2/jetlinks-web-core/pull/201)。插件与固件翻译持久化分别需要支持 `PluginDriverEntity.i18nMessages` 和 `FirmwareEntity.i18nMessages` 的后端；固件还需同步 `dev_firmware.i18n_messages` 映射。真实后端上传／解析／保存、浏览器下载落盘及卡片／证书页面最终视觉效果仍待联调或人工验收，本次未重新执行浏览器验证。

### 接入列表卡片与行操作

- `views/link/AccessConfig/index.vue`、`Certificate/index.vue`、`Protocol/index.vue`、`Type/index.vue` 和 `plugin/Content.vue` 使用现有 `CardBox` 的分区操作布局，编辑为主要操作，删除沿用危险色及原有权限／确认。卡片配置统一提供两列／三列选择；证书管理默认展示卡片，保留表格切换。
- 网络组件表格复用 `TableActions` 收纳次要操作，保留已有查看、编辑、启停、删除回调及权限。协议类型和插件来源只有多个候选时才显示选择区，单一候选继续沿用原有默认值与保存参数。

### 协议包拖拽上传

- `views/link/Protocol/Save/FileUpload.vue` 复用 core `FileUpload`，`useProtocolFileUpload.ts` 将上传结果适配为携带访问凭证的文件地址；支持 JAR／ZIP 单文件、大小写后缀、编辑回显及移除，不增加文件大小上限。
- `Save/index.vue` 在上传期间禁用确认，沿用原有协议类型、地址字段和保存接口；缺少文件 ID 或访问凭证时保留原配置。表单通过 `FormItemRest` 隔离上传过程中的文件列表变化，仅在完成地址变化后触发校验。

### 插件名称与描述国际化编辑

- 运行时插件新增、编辑入口 `views/link/plugin/Save.vue` 复用 core 根入口的 `I18nTextField`，名称和描述均可编辑中文、英文文本，分别沿用 64、200 字符限制。
- 表单回显已有 `i18nMessages`；普通新增、编辑随完整参数提交 `i18nMessages: { name: { zh, en }, description: { zh, en } }`，能力市场安装参数同步携带该映射。取消国际化弹窗不提交草稿，取消插件表单不修改原记录。
- 后端需加载支持 `PluginDriverEntity.i18nMessages` 的新版 `plugin-component`；运行时插件卡片及表格的名称、说明通过 `utils/i18n.ts` 的 `getI18nText` 回显当前语言，缺少翻译时沿用原值；不调整运营端或插件包元数据。
- 验证：在 `runtime-ui/jetlinks-web-core/` 执行 `node scripts/test-i18n-components.mjs`，10 项通过；执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-plugin-i18n-build-20261028 -- --module-name device-manager-ui`，11,178 个模块构建通过（2 分 30 秒），保留既有资源路径、Rollup 配置、循环依赖与包体积告警。目标文件 `git diff --check` 通过。
- 页面验证：本地 `9200` 新增弹窗的名称、描述均出现国际化入口；中文自动回填、英文录入确认、再次打开回显及取消名称修改保留原翻译通过。没有保存业务记录；真实后端持久化、已有翻译记录回显与能力市场安装仍需加载新版后端后联调。
- 验证限制：完整类型检查及配套后端要求以“2.20 交付验证与配套要求”为准；真实翻译保存、编辑回显和能力市场安装仍待联调。

### 插件包拖拽上传

- 当前实现：运行时 `device-manager-ui` 的 `views/link/plugin/UploadFile.vue` 复用 core 根入口 `FileUpload` 的点击和拖拽能力；插件专属的版本、类型和地址回填由同目录 `usePluginFileUpload.ts` 适配，`api/link/plugin.ts` 通过公共上传请求工具调用插件解析接口。
- 实施边界：单个 JAR/ZIP、不增加文件大小上限，沿用 `/plugin/driver/upload` 和现有保存字段；不修改公共组件、运营端或能力市场安装流程。重点保留编辑回显、上传中禁用、失败恢复原文件和移除清空。
- 验证：组件脚本、模板和两个 TypeScript 文件编译、目标文件 `git diff --check` 通过；新增 hook 使用真实 Vue、Ant Design Vue 与 i18n 类型独立严格检查通过。在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-plugin-drag-build-20261028 -- --module-name device-manager-ui` 通过（11,178 个模块，1 分 23 秒），保留既有资源路径、Rollup 配置、循环依赖和包体积警告；随后仅补充父级 `uploading` 禁用条件，最终脚本与模板重新编译通过。
- 页面验证：本地 `9200` 插件新增弹窗显示公共拖拽区、JAR/ZIP 提示，点击可打开单文件选择器；编辑弹窗正确回显已有文件，移除后文件名、版本及类型信息区清空，取消后未持久化。未实际上传插件或保存业务数据，拖放上传、后端解析和失败恢复仍待有效插件包联调。
- 验证限制：完整类型检查以“2.20 交付验证与配套要求”为准；真实插件包上传、后端解析及失败恢复仍待联调。

### 固件名称与说明国际化

- 行为与范围：本模块 `views/device/Firmware/Application/index.vue` 和 `Save/index.vue` 复用 core 根入口 `I18nTextField`，支持固件名称、说明的中英文编辑，分别沿用 64、200 字符限制；`index.vue` 的远程升级列表同步按请求语言回显。运营端 `ui/`、固件上传与版本解析、任务发布、权限／资产关联和筛选参数不变。
- 保存契约：`type.d.ts` 声明 `i18nMessages: { name: { zh, en }, description: { zh, en } }`。自动创建显式携带翻译映射，解析失败时连同已有文件与表单内容传入手工弹窗；手工新增／编辑随完整表单保存映射，编辑时独立复制，取消不会修改原记录。
- 后端落点：`modules/device-manager/src/main/java/org/jetlinks/pro/device/entity/FirmwareEntity.java` 沿用 `DeviceProductEntity` 的 `MultipleI18nSupportEntity` 与 JSON 列映射，保留原始 `name`、`description`，提供只读 `i18nName`、`i18nDescription`。`web/request/FirmwareCreateRequest.java` 和 `service/ProtocolFirmwareService.java` 将翻译传入自动创建记录，手工新增／编辑继续使用现有 CRUD 接口。
- 显示与兼容：列表和编辑初始化复用 `utils/i18n.ts` 的 `getI18nText`，优先使用后端展示字段；没有对应翻译的已持久化固件继续显示原值。没有批量翻译历史数据，也没有增加接口路径、常驻状态、手动追踪或 MBean。
- 后端验证：使用 JDK 21，在 `modules/device-manager/` 执行 `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home /opt/homebrew/bin/mvn -o -Dtest=FirmwareEntityTest,ProtocolFirmwareServiceTest,FirmwareControllerTest test`，模块编译及 21 项测试通过。覆盖实体 JSON 列映射与编解码、清空翻译、只读字段、按语言／响应式请求上下文序列化、旧值回退、请求绑定和自动／可信创建透传。
- 前端验证：定向检查 `/tmp/codex-firmware-i18n-flow-20261028.mjs` 的 7 组场景通过，覆盖自动创建、解析失败回退、手工草稿隔离、新增／编辑保存、旧值回退及列表真实模板插槽的中英文显示。在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-firmware-i18n-build-20261028 -- --module-name device-manager-ui`，11,179 个模块构建通过（2 分 27 秒），保留既有资源路径、Rollup 配置与包体积告警。
- 页面验证：本地 `9200` 的两个固件弹窗均出现名称、说明国际化入口；中文直接输入回填、英文录入确认、重新打开回显、修改后取消均通过。切换英文后旧固件原名称正常回显，验证后恢复中文、关闭草稿，没有上传或保存业务记录。
- 验证与发布限制：完整类型检查以“2.20 交付验证与配套要求”为准。后端需发布／重启以加载新实体并同步 `dev_firmware.i18n_messages` 的映射；真实数据库保存、重新查询及语言切换联调尚未执行，前端单独发布不能保证翻译持久化。

### 固件拖拽上传

- 目标与范围：运行时 `device-manager-ui` 的 `views/device/Firmware/Application/FileUpload.vue` 与 `views/device/Firmware/Save/` 复用 core 根入口导出的 `FileUpload`，新增、解析回退和编辑弹窗均支持点击和拖拽上传；公共回显下载由 `../../jetlinks-web-core/src/components/Upload/README.md` 的“回显文件下载”维护。
- 自动解析入口：保持 JAR/ZIP 单文件、不额外限制文件大小，通过自定义请求与全过程上传事件接回既有上传、SHA256 回填、版本解析和提交禁用流程；非法文件不替换已有列表。
- 手工表单：`Save/FileUpload.vue` 移除地址输入框，仅展示任意格式的固件拖拽区和回显列表；`useFirmwareFileUpload.ts` 清理手填绑定，继续适配原 `/file/upload`、访问凭证和文件元信息回填。上传时禁用确认，移除时清空地址和文件元信息、大小归零；签名输入及校验、保存字段和解析回退流程保持原样。
- 公共下载：`jetlinks-web-core/src/components/Upload/File/` 为能够解析地址的回显文件提供下载按钮，保留文件名和访问凭证，兼容文件 ID 与本次上传响应；无地址、上传中和失败文件不提供下载。跨源读取被限制时使用原生附件下载，保留当前表单；不修改运营端、后端接口或固件数据结构。
- 定向验证：公共下载检查覆盖列表／文件 ID／响应回显、名称和凭证、状态过滤、跨源请求去重、失败提示及原生链接回退、图片预览与移除；手工固件适配检查覆盖已有文件回显、上传状态、失败恢复、异常响应拒绝、访问地址／摘要／大小回填和移除。SFC 脚本、模板、样式及中英文资源检查、目标差异空白检查通过；公共组件与固件适配器的隔离严格类型检查仅保留原组件 `minScale` 的既有 TS2353，与原始组件基线一致。
- 构建：在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-file-download-final-build-20261028 -- --module-name device-manager-ui` 通过（11,179 个模块，1 分 12 秒），保留既有资源路径、Rollup 配置与包体积警告。
- 页面与文件验证：本地 `9200` 的编辑表单已确认无地址输入框、公共拖拽区、回显文件和下载按钮；移除后列表及下载按钮消失、地址清空、大小归零并出现校验提示，签名不变。取消后重新编辑恢复原文件和大小。已有文件直接请求返回 HTTP 200、3,506,305 字节，SHA256 与表单一致；带当前页面 Origin 的跨源请求返回 403，故启用原生附件下载路径。内置浏览器自动化未捕获下载落盘事件，最终浏览器下载需人工验收；未上传或保存业务数据。
- 验证限制：完整类型检查以“2.20 交付验证与配套要求”为准。实际拖放上传和后端版本解析仍需有效固件联调。

### 网络组件详情返回入口（已实施）

- 目标与范围：完善 `views/link/Type/Detail/index.vue` 已有 `PageChrome` 返回按钮的点击行为和国际化文本，仅涉及运行时设备管理模块。
- 实现：返回按钮调用 `useMenuStore().jumpPage('link/Type')` 回到网络组件列表，使用 `Network.detail.backToList` 词条，在 `locales/lang/{zh,en}.json` 同步“返回网络组件 / Back to Network Components”；保留现有布局、表单与保存流程，不依赖浏览器历史。
- 验证：SFC 脚本、模板及 scoped Less 编译、中英文 JSON 校验、相对任务前快照的增量核对与目标文件 `git diff --check` 通过。在 `runtime-ui/jetlinks-web-core/` 使用现有 Node 运行时执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir <临时输出目录> -- --module-name device-manager-ui` 通过（11,178 个模块，1 分 14 秒），保留已有资源路径、CSS 注释、Baseline 数据及大分块告警。真实 `9200` 临时页直接打开详情后，中文按钮返回网络组件列表通过；切换英文后显示完整返回文案并可正确回到列表，验证后恢复中文，未保存业务数据。
- 验证限制：完整类型检查以“2.20 交付验证与配套要求”为准。

### 统一设备列表品牌型号列（已实施）

- 目标：在统一设备列表新增“品牌型号”列，展示 `productManufacturer` 与 `productModel`；任一字段为空时显示既有国际化文案“未配置”。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui/views/device/list/unified/index.vue` 的表格列与单元格展示；不修改接口、筛选、设备数据、其他设备列表或 `ui/`。
- 实施：沿用模块旧设备表的两行信息密度，厂商为主行、型号为副行；复用 `IotDeviceList.table.brandModel` 和 `IotDeviceDetail.common.unconfigured`。
- 验证：定向归一化检查覆盖空值、空字符串、空白字符串、`--` 与真实厂商值，结果通过，`git diff --check -- modules/device-manager-ui` 通过。浏览器在 `http://localhost:9200/#/resources/devices/list?type=gateway` 热更新确认列位于产品名称与区域／分组之间；实际数据“萤火虫 / 123”按两行展示，空字段的两行均显示“未配置”。

### 空空间区域名称国际化回退（已实施）

- 目标：统一设备列表的空间为空或后端占位为 `--` / `—` 时，显示既有国际化文案 `IotDeviceList.scope.unboundArea`。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui/views/device/list/unified/index.vue` 的区域／分组与 scope 单元格展示；不修改接口、区域数据、分组显示、筛选或 `ui/`。
- 实施：将区域显示归一化为本地函数，并由两个同义表格分支复用；保留绑定区域和真实区域名称的原有优先级。
- 验证：`formatAreaName` 已由区域／分组与 scope 两个单元格分支复用；定向归一化检查覆盖空值、空字符串、`--`、`—` 与真实区域值，结果通过，`git diff --check -- modules/device-manager-ui` 通过。浏览器刷新被既有 `src/components/MarkdownEditor/index.ts` 的 `ReferenceError: Cannot access 'MarkdownEditor' before initialization` 阻断，错误不涉及本次文件，待该初始化问题恢复后人工确认页面显示。

### 设备列表批量配置快捷入口（已实施）

- 当前入口：边缘节点分类的“批量操作”提供“算法配置”“插件配置”和状态同步。算法配置跳转 AI 模块注册的“资源中心 → 算法配置”独立菜单 `algorithm-center`（`/resources/algorithm-center`），不携带当前列表选择或查询；快捷项通过新菜单授权控制显示。插件配置继续进入批量页并使用 `batchTab=plugins`，状态同步继续调用原流程。
- 影响范围与 owning modules：仅 `runtime-ui/modules/device-manager-ui` 的统一列表及批量导航 hook，以及 `runtime-ui/modules/jetlinks-ai-ui` 的菜单、页签注销和路由壳。统一列表被网关工作台复用，相关网关入口同步生效；接口、插件组件、列表筛选及运营端 `ui/` 不变。完整共享影响和 AI 侧权限说明见 `../jetlinks-ai-ui/docs/plans/project-algorithm-center-prototype.md` 的“算法配置独立菜单恢复”。
- 实施入口：`views/device/list/unified/index.vue` 负责入口显示与事件绑定；`useUnifiedDeviceBatchNavigation.ts` 负责按快捷项导航，复用 core 菜单 store 和 `ConditionFilter` 查询编码。插件批量页保留已选网关 ID 或原列表查询范围；批量页仍优先应用注册表中存在的 `batchTab`，返回列表时移除临时批量参数。
- 验证：算法独立跳转、三种插件查询范围和状态同步共 5 种内存导航场景通过；同步最新 `2.20` 后保留新增设备配置与空间展示逻辑。列表 SFC 脚本/模板/样式、新 hook TS 语法和 `git diff --check` 通过，列表由基线 391 行减至 378 行，作为窄范围菜单修正保留现有结构。`pnpm --config.verify-deps-before-run=false -F jetlinks-web-core build -- --module-name device-manager-ui` 构建通过（10,934 个模块，3 分 18 秒）；`pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 被未修改的 `views/link/Certificate/type.d.ts:2` 语法错误阻断。没有独立 lint 或样式门禁脚本；未新增或修改测试、CSS，未打开浏览器。实际菜单同步、授权及页面交互待人工验收。

### 统一设备列表操作按钮菜单授权

`views/device/list/unified/index.vue` 的编辑、启停、删除按钮复用 `getIotDeviceListMenuCode(route)` 解析当前入口：资源中心使用 `iot-user-device-list`，物联入口保持其所属菜单。动作仍分别校验 `update`、`action`、`delete`，不以菜单可见性代替按钮授权。修复写死旧菜单编码导致初始化环境按钮提示无权限的问题。验证采用源码与差异检查及 9111 服务模块响应核对，页面由用户人工验收，不执行构建、类型检查、lint、测试或浏览器操作。

### 设备详情摘要 Tooltip 文本锚点（已实施）

- 目标：设备详情头部摘要字段的 Tooltip 以实际文字宽度为触发锚点；例如“直连设备”的提示框居中于该文字，而非整列剩余宽度。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui` 的 `views/device/list/styles/IotDeviceDetailHeader.css` 和本文档；不修改详情字段、接口、路由、点击操作或 Tooltip 内容。
- 实施步骤：将摘要值从填满剩余列宽的 flex 项调整为按内容宽度占位、但在长文本时仍可收缩并显示省略号；完成后做样式差异检查，并在现有设备详情页复查 Tooltip 触发节点的实际宽度与文字宽度一致。
- 验证：已在 `http://localhost:9200/#/resources/devices/list/Detail/2100783691425296384?type=device` 刷新确认，“直连设备”对应触发节点宽度为 `55.109375px`，与文字内容宽度一致，不再占满整列；同一摘要行的设备 ID、产品、区域／分组和最后上报均已按内容宽度占位。长文本仍保留 `max-width`、收缩和省略样式，设备 ID／产品操作及 Tooltip 内容未改动。目标文件 `git diff --check` 通过，`pnpm --filter jetlinks-web-core build -- --module-name device-manager-ui` 通过；构建仅保留既有 Baseline 数据、资源路径解析提示。

### 设备管理列表与分类树视觉统一（已实施）

- 目标：统一固件、接入配置、证书、协议、接入方式与插件列表的标题、搜索和新增操作布局，并为产品分类节点补齐层级图标。
- 影响范围与 owning module：仅本模块的 `views/device/Firmware/`、`views/device/Product/` 和 `views/link/`；不改接口、权限、筛选参数、表格列、行操作、路由或 i18n 文案。
- 实施：搜索筛选器与新增按钮统一放置在表格右侧工具栏，标题字号改用 `--fs-18`，搜索框使用 `25rem` 至 `40rem` 的弹性宽度；产品分类从第三级起显示灰色图标，前两级显示主色图标。
- 验证：`git diff --check` 通过；`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 通过（36.61 秒）。在固件、接入配置、证书、协议、接入方式、插件与产品列表中仍需人工确认筛选、创建权限和分类操作保持原有行为。
- 证书卡片已补齐：仅修改 `runtime-ui/modules/device-manager-ui/views/link/Certificate/index.vue`，参考 `runtime-ui/modules/authentication-manager-ui/views/system/Apply/index.vue` 的卡片布局，复用 core `CardBox`、现有证书图标和字段文案，展示名称、证书标准的 `type.text` 与说明；说明为空时显示公共词条 `comm.table.empty`。卡片使用现有编辑、删除回调及相同权限码，默认展示卡片并保留表格切换，搜索、分页、接口和路由保持原契约。
- 证书卡片验证：脚本、模板、样式编译与 `node ../ui/scripts/check-ui-style.mjs --files modules/device-manager-ui/views/link/Certificate/index.vue` 样式门禁通过。在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-certificate-card-build-20261027 -- --module-name device-manager-ui` 通过，转换 11,043 个模块，耗时 1 分 3 秒，保留既有 Baseline 数据、资源路径与大分块提示；目标文件 `git diff --check` 通过。本地 `9200` 已验证表格/卡片切换、证书图标/字段及空说明、编辑跳转、删除确认取消，以及无匹配筛选空态和清空后列表恢复，未保存或删除业务数据。编辑详情页仍有既有 Form.Item 多控件收集告警，未改动详情表单。
- 证书卡片验证限制：完整类型检查以“2.20 交付验证与配套要求”为准；此前在管理员账号下完成交互验证，未切换无权限账号，也未执行实际删除。
- 证书上传入口已调整：`views/link/Certificate/Detail/CertificateFile.vue` 使用同一相对定位容器，将证书文件与证书私钥的上传按钮放到各自文本域内部右下角；按钮距右边与下边均为 `--space-2`，文本域底部使用 `--space-12` 为文字预留空间，并同步 `locales/lang/{zh,en}.json` 中两处位置说明。上传地址、文件类型限制、上传状态、值回填和表单事件保持原契约，脚本与改动前完全一致，组件为 107 行。
- 上传布局验证：SFC 脚本、模板、样式编译，中文/英文 JSON 校验，样式门禁与目标文件 `git diff --check` 均通过；本轮布局版本在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-certificate-upload-position-build-20261027 -- --module-name device-manager-ui` 构建通过（1 分 20 秒），说明词条随后完成 JSON 校验。本地 `9200` 的空白新增表单已确认两个按钮均位于各自文本域内部，右、下边距各 8px，按钮高度 32px，小于底部预留的 48px，输入框继续支持竖向缩放；未上传文件或保存业务数据。完整类型检查以“2.20 交付验证与配套要求”为准。

### 证书配置页布局

- 目标与范围：`runtime-ui/modules/device-manager-ui/views/link/Certificate/Detail/index.vue` 将原右栏概述、配置说明完整上移，左栏依次为“证书标准 / 证书名称 / 说明”，右栏依次为“证书文件 / 证书类型 / 证书私钥”，保存操作置于底部右侧；窄屏按左栏、右栏顺序堆叠。本次只移动既有表单项，复用现有 `FullPage`、`ContentPanel`、`ResponsiveGrid`、Ant Design 表单及 `CertificateFile`，保留同目录 `detail.less` 中的布局样式；通过模板编译、表单项契约对照和浏览器布局检查验证。
- 实施边界：保留现有表单文案、字段、校验、上传入口、数据回填和保存逻辑；上传按钮仍在文本域右下角，不新增参考图中的字段提示或取消按钮。分栏调整仅移动模板，页面和上传组件脚本保持原样。
- 顶部返回入口：完善同页已有的 `PageChrome` 返回按钮，复用 `menuStore.jumpPage('link/Certificate')` 回到证书管理列表，并在 `locales/lang/{zh,en}.json` 补齐“返回证书管理 / Back to Certificate Management”；仅修改按钮事件与其文案，不依赖浏览器历史记录。通过 SFC 编译、语言资源校验、模块构建及浏览器返回 / 语言切换验证。
- 验证结果：页面 SFC 脚本、模板编译通过；与分栏调整前工作区快照对照，六个表单项的完整契约、业务脚本和 `detail.less` 均保持一致，仅移动表单项位置，页面为 212 行。`node ../ui/scripts/check-ui-style.mjs --files modules/device-manager-ui/views/link/Certificate/Detail/index.vue` 与目标文件 `git diff --check` 通过。上传组件、中英文资源及样式未改动，复用上一布局版本的编译与交互验证。
- 构建与浏览器：在 `runtime-ui/jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/codex-certificate-columns-build-20261028 -- --module-name device-manager-ui` 通过（1 分 32 秒），保留既有 Baseline 数据与大分块提示。本地 `9200` 当前编辑页在 `1404×899` 下，左栏为“证书标准 / 证书名称 / 说明”，右栏为“证书文件 / 证书类型 / 证书私钥”，两栏各宽 540.5px，无横向溢出；空白新增页也已确认同一分组及顶部说明、底部右侧保存按钮。窄屏堆叠、客户端 / 服务端私钥显隐、字数统计和必填校验沿用上次通过证据，本次未改变相关布局或逻辑。未上传文件或保存业务数据，验证用的临时新增页已关闭。
- 返回入口验证：SFC 脚本 / 模板编译、中英文 JSON 和新词条校验、样式门禁、目标文件 `git diff --check` 均通过；与本次改动前的定向快照对照，已有业务脚本、表单模板及其他词条完全一致。使用同一模块构建命令、输出目录 `/tmp/codex-certificate-back-build-20261028` 构建通过（11,178 个模块，3 分 58 秒），保留资源路径、Rollup output option、navigation/menu 循环依赖与大分块警告。本地 `9200` 的空白新增页实测中英文按钮均返回 `/infrastructure/access/Cert` 并显示证书管理列表标题，按钮位于面板外顶部；英文按钮显示完整且无横向溢出，验证后恢复中文，未上传文件或保存业务数据。
- 预览补充：功能实测完成后本地开发服务中断，已重新启动 `9200` 服务；最终效果截图受浏览器连接错误页限制未能生成，未将空白截图作为验收证据。
- 验证限制：完整类型检查以“2.20 交付验证与配套要求”为准。原有 Form.Item 收集 Textarea / Upload 多控件告警仍存在；未验证实际上传、持久化保存、英文长文案与其他浏览器。

### 设备列表状态切换抽取为 core 公共组件 SwitchGroup（已实施）

- 目标：把统一设备列表工具栏中的状态切换组（状态点 + 文案 + 计数，单选）抽成 `runtime-ui/jetlinks-web-core` 的公共组件，并按设计稿重做样式：容器圆角 4px、1px `#ECEFF3` 描边、内边距 1px、底色 `#F7F8FA`、文字使用次级文本色；选中项圆角 6px、白色底、主题色文字。
- 影响范围与 owning module：新增 `jetlinks-web-core/src/components/SwitchGroup/`（组件、类型、使用说明），在 core 组件入口注册为全局 `SwitchGroup` 并具名导出；`device-manager-ui` 只改 `views/device/list/unified/index.vue` 的模板、状态选项组装和已删除的局部样式。组件不绑定设备状态语义，类型切换、视图模式切换等单选场景都可复用。
- 不做：不改接口、查询条件、路由回显，也不改 `changeStatus` 的“再次点击已选中项回到全部”交互；不改 `ui/` 运营端、其他设备页面、core 全局主题 token 和既有 `SegmentPanel`/`ChipGroup`。
- 实现入口：模板改为 `<SwitchGroup :model-value="status" :options="statusOptions" :aria-label="t('IotDeviceList.filter.status')" @change="changeStatus">`，状态点通过 `#option` 插槽在页面内渲染；`statusOptions` 只组装 `label` 与 `count`（`statusCounts[value] ?? '—'`），`statusTones`（online→success、offline→error、disabled→default）留在页面侧。组件不带任何状态点/徽标字段，后续其他场景可用同一插槽自定义前缀内容。原 `.unified-device-list__status*` 五条局部样式随模板一并删除。
- 文档：core 组件索引 `jetlinks-web-core/src/components/README.md` 的场景映射与详细文档索引已补充 `SwitchGroup`，单组件说明见 `jetlinks-web-core/src/components/SwitchGroup/README.md`（含 `option` 插槽的状态点示例）。
- 验证：`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 通过（exit 0）；产物 CSS 中 `--line`(#ECEFF3)、`--r-1`(4px)、`--r-2`(6px)、`--bg`、`--accent`、`--ink-2` 与 1px 内边距/描边、`#f7f8fa` 底色均已按设计落地。模块 `vue-tsc` 仍被既有 `views/link/Certificate/type.d.ts(2,30)` 语法错误提前阻断，改用仅覆盖 `views/device/list/unified/**` 的临时 tsconfig 做前后对照：改动前后错误多重集完全一致（均 273 条，逐条文案相同），即本次改动新增 0 条类型错误（临时配置已删除）。类型只按目录入口 `@jetlinks-web-core/components/SwitchGroup` 导入，避免把 core 组件根 barrel 拉进类型图。
- 未验证：当前没有运行中的 `runtime-ui` dev server（`9100`/`9101` 属于 `ui/` 运营端），未执行浏览器视觉与交互回归；`#F7F8FA` 在 core 暂无等价语义 token，先以组件局部变量承载。

### 设备详情返回入口与摘要对齐调整（已实施）

- 目标：将设备详情的返回入口移到内容面板外，明确显示“返回设备列表”；摘要中的设备图标、基础信息和操作按钮统一从顶部开始排列。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui` 的设备详情宿主、摘要头局部样式及中英文文案；不修改运营端 `ui/`、详情路由、接口、权限或设备操作行为。
- 实现入口：`views/device/list/components/IotDeviceDetailView.vue` 承载面板外返回入口，`views/device/list/components/device-detail/IotDeviceDetailHeader.vue` 只保留摘要内容，`views/device/list/styles/IotDeviceDetailHeader.css` 使用顶部对齐并移除标签展开时的居中位移补偿。
- 验证：中英文 locale JSON 解析、目标 worktree `git diff --check`、`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 均通过（9642 个模块）；在 `http://localhost:9200/#/resources/devices/list/Detail/2100095778810372096?type=device` 实测确认返回按钮位于内容面板上方且摘要整体顶部对齐。构建仅保留既有资源路径、CSS 注释、Rollup output option 和大 chunk 警告。

### 设备批量页扩展约定（算法配置已迁至独立菜单）

- 当前结论：算法工作区由 AI 模块的独立菜单承载，AI 模块不再向 `device-list-batch:tabs` 注册 `algorithms`。网关列表的“算法配置”仍作为快捷跳转入口；批量页继续承载插件配置等实际注册的工作区。
- 宿主契约：`views/device/list/unified/BatchPage.vue` 仍按动态注册表装配页签，同时识别注册项声明的按钮权限与 `menuCode` 菜单所有权；`KeepAlive + code key` 保留已打开工作区状态，本次不改宿主及插件业务。
- 权限边界：设备列表菜单现有权限不做无关删减；独立算法配置菜单在 AI 模块声明当前工作区所需权限，不依赖设备菜单授予其接口权限。接口、矩阵业务、草稿保护和保存下发保持原流程。
- 验证与生效方式：导航、页签注销、语法与差异检查结果见上方“设备列表批量配置快捷入口”；系统同步/初始化并授权新菜单后刷新页面，人工验收独立算法配置及插件批量页。

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

### 设备告警通知内容兼容收敛（已实现）

- 目标：新增设备告警和使用平台默认内容的存量告警不再展示“通知内容”选项，统一直接使用平台默认内容；只有打开编辑时已经保存自定义内容的存量告警继续展示原编辑能力。
- 影响范围与 owning module：仅修改 `runtime-ui/modules/device-manager-ui`，实现入口为 `views/device/alarm/components/DeviceAlarmNotificationConfig.vue`；告警规则页和设备详情告警配置复用同一通知编辑器，因此遵循同一兼容口径。同步更新本说明，不修改 `ui/` 或中英文语言资源。
- 不做：不修改后端 `device-manager` 的默认消息和自定义模板解析能力，不迁移或批量改写存量规则，不改变通知渠道、通知对象、告警触发和发送链路，也不调整页面壳层、列表或详情信息架构。
- 实施步骤：在每次切换编辑表单模型时记录其初始通知内容模式；初始模式为自定义时保留现有 `DeviceAlarmMessageTemplateConfig`，新增规则或初始模式为默认时不渲染。历史自定义规则在当前编辑会话中切回默认后仍保留选项以便撤销，保存并再次打开后再按默认模式隐藏。
- 风险与兼容：自定义模式仍由 `parameters.template` 对象判定，具体内容读取 `parameters.template.message`；历史异常数据若仅存在空 `template` 对象，仍按自定义模式展示并沿用现有必填校验。取消编辑不会改写服务端配置，重新打开时重新按持久化数据判定。
- 验证：`alarmWorkspace` 定向测试 9 项通过，覆盖默认/自定义模式判定及自定义切回默认后当前会话仍可撤销；`device-manager-ui` 窄构建通过（9,640 个模块），`DeviceAlarmNotificationConfig.vue` 为 190 行，`git diff --check` 通过。`pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 仍被既有 `views/link/Certificate/type.d.ts:2` 的非法 `interface` 声明阻断，本次修改文件已由 Vite 构建完成编译。真实浏览器中保存后再次打开的显隐结果仍待联调确认。
- 交付：commit `a6dfc538e117c135db651d8f43f9aad3bb4324ff`；Pull Request `https://github.com/jetlinks-v2/device-manager-ui/pull/310`。

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
