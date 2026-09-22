# 设备列表范围侧栏

## 范围树滚动区布局

目标：将 `views/device/list/components/IotDeviceScopeSidebar.vue` 的侧栏内容改为纵向弹性布局，使范围树滚动区占用剩余高度，分组创建按钮保留在底部。仅调整样式，不改范围筛选、树节点、权限或接口；样式差异与 `git diff --check` 已核对。按本次交付要求不执行构建，也未运行 lint、typecheck 或浏览器验证，长列表及不同容器高度下的实际滚动效果仍需人工复核。

## 统一列表状态快捷筛选（2026-09-22）

目标：将“在线 / 离线 / 禁用”从自定义切换外观收敛为与工具栏一致的 Ant Design 按钮组；仍然只有三个状态，默认均不选中，重复点击已选状态清除筛选，不增加“全部”选项。影响范围仅为 `views/device/list/unified/index.vue` 的状态控件展示，保留 `useUnifiedDeviceList.ts#changeStatus`、状态计数、URL 筛选及其他工具栏操作。

实施：复用 `a-button-group`、`a-button` 和 `a-badge`，显示三种状态、各自计数及明确的选中反馈；不改 API、列表字段、范围侧栏或公共 `SwitchGroup`。验证：定向测试、页面逐项点击与重复点击、差异检查；考虑本机性能，不运行全量构建。

验证结果：`node --test modules/device-manager-ui/tests/unifiedDeviceStatusFilter.test.mjs modules/device-manager-ui/tests/unifiedDeviceTabs.test.mjs` 4 项通过，包含页面脚本／模板编译与三状态、再次点击清除筛选的源码契约；本模块 `git diff --check` 通过。`unified/index.vue` 原本已超过 300 行，本次只是局部替换，现为 309 行。浏览器窗口正在由用户操作，本次没有切换或刷新其 SaaS 页签；实际三种状态切换、宽度与颜色仍需在 `http://localhost:9200/#/resources/devices/list?type=gateway` 人工复核。未运行完整 typecheck、lint 或生产构建；发布环境需更新运行时前端静态资源，无后端变更。

## 暂隐视频分类页签（已实施）

目标：运行时资源中心统一设备列表的顶部分类栏暂不显示“视频”页签；保留“全部”和其他分类，视频设备仍可在“全部”中查看。

影响范围：`device-manager-ui/deviceListProvider.ts` 的分类可见性契约、`views/device/list/unified/useUnifiedDeviceList.ts` 的页签选项，以及 `jetlinks-media-ui/deviceListProvider.ts` 的视频分类配置。

不做：不删除视频 Provider、设备数据、`?type=video` 直达处理、详情页通道能力或独立的“视频管理 / 视频列表”菜单；不改 `ui/`、后端接口与权限。

实施：为分类 Provider 增加可选的页签可见性设置，仅在生成顶部页签时过滤视频；分类识别与直达 URL 仍按原逻辑运行。保持现有表格工作区、筛选和详情承载方式，不引入新的交互壳层。

风险与验证：直达 `?type=video` 时视频数据仍显示，但顶部不再有对应的选中页签。`tests/unifiedDeviceTabs.test.mjs` 检查页签隐藏与分类直达逻辑，连同 `tests/deviceDetailContent.test.mjs` 共 11 项通过；三处 TypeScript 文件语法解析通过，两个模块的 `git diff --check` 通过。未执行浏览器手工验证、lint、完整 typecheck 或生产构建：本机性能有限，且设备模块已有 `views/link/Certificate/type.d.ts:2` 的类型检查语法错误。后续可运行 `pnpm --dir runtime-ui exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json`、媒体模块对应命令及生产构建，并实测顶部页签、“全部”列表、视频直达与独立视频菜单；部署环境需要重新发布运行时前端资源。

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
