# Device Manager UI

设备管理前端模块，提供设备、产品与物联告警等页面。菜单定义由 `baseMenu.ts` 加载 `baseMenu.json`。

物联告警菜单的数据权限由 `baseMenu.json` 声明，`iot` 和 `app` 两个入口的 `assetTypes` 均需包含 `user`，以支持通知对象的用户资产授权。更新定义后需同步已保存的菜单，并在角色或应用授权中配置用户资产范围；设备的“自己创建的”权限不会自动限制用户列表。验收时使用受限账号核对 `/user/detail/_query` 返回的通知对象范围，JSON 配置检查不能替代部署后的权限验证。

## 物联告警按钮权限

`baseMenu.json` 为 `iot-user/device/alarm` 的 `iot`、`app` 两个入口定义以下按钮；菜单本身仅保留查询权限，日志和处理记录沿用查询授权。

| 按钮 | ID | 接口资源授权 |
| --- | --- | --- |
| 新增 | `add` | `device-product:save`、`device-instance:save` |
| 编辑 | `update` | `device-product:save`、`device-instance:save` |
| 删除 | `delete` | `device-product:save`、`device-instance:save` |
| 处理告警 | `handle` | `alarm-record:save` |

`views/device/alarm/hooks/useDeviceAlarmPermissions.ts` 复用 auth store，以 `iot-user/device/alarm:<按钮 ID>` 校验操作授权，不以菜单可见性或设备编辑权限代替。`useDeviceAlarmPage.ts` 保护编辑器入口及保存、删除提交，`useDeviceAlarmHandling.ts` 保护处理弹窗和提交；异步读取规则后会再次检查写权限。`views/device/list/components/device-detail/IotDeviceAlarmWorkspace.vue` 的处理按钮使用相同授权。页面布局及后端接口保持原有行为。

删除告警规则是修改属性预处理配置，因此沿用产品/设备 `save` 权限，不授予产品/设备 `delete` 权限。本次区分的是前端按钮授权；新增、编辑、删除仍共享后端现有的保存动作。已有菜单需同步定义并重新配置角色或应用按钮权限，否则前端不会放行未授权操作。

运行时初始化入口是 `runtime-ui/jetlinks-web-core/src/views/init-home/Menu/index.vue`：它通过 `src/utils/modules.ts` 加载同一工作区的 `modules/*/baseMenu.ts`，再按后端支持的资源过滤并提交菜单。运营端 `ui/` 的同名模块不会参与这条初始化链路。使用更新后的运行时前端刷新或部署，再重新初始化菜单并配置按钮授权。

验证：在本模块使用 Node.js 22.18.0 执行 `node scripts/test-alarm-workspace.mjs`，244 项检查通过，包括两个入口的按钮定义、运行时初始化页面的真实权限过滤、四项独立授权、只读访问及授权撤销后的提交拦截。Git 差异空白检查通过。在 `runtime-ui/jetlinks-web-core/` 使用 Node.js 22.18.0 执行 `node --max_old_space_size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/jetlinks-runtime-alarm-permissions-build -- --module-name device-manager-ui`，构建通过（13,208 个模块），输出仍有资源路径、Rollup 输出配置、循环依赖与大 chunk 警告；构建生成的本模块 `dist/baseMenu.json` 已核对，两个物联告警入口均包含 4 项按钮。未进行浏览器初始化或受限账号验收。本工作区没有独立 lint 和样式检查脚本，本次不改样式。全量类型检查未执行；待执行命令（在 `runtime-ui/`）：`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`。

## 设备树与接入列表

`views/device/list/components/IotDeviceScopeSidebar.vue` 使用 core 的 `AutoTree` 自动适配侧栏高度并启用虚拟滚动，保留原有树属性、插槽和选择事件。该入口依赖 [core PR #224](https://github.com/jetlinks-v2/jetlinks-web-core/pull/224)；异步页面首次挂载的滚轮绑定还依赖运行时工作区的 `patches/ant-design-vue@4.2.6.patch`，发布时需同步交付。

设备接入网关列表由 `views/link/AccessConfig/index.vue` 渲染。协议和连接信息列使用列表接口返回的协议名称、通道名称和地址。没有连接信息时，按网关的通道类型和 `NetworkTypeMapping` 判断，数采和固定地址等无需网络组件的接入方式显示「无需配置」，需要网络组件的接入方式显示「暂无连接信息」。网关类型和默认说明优先使用当前语言的接入方式目录，目录缺少数采网关时使用模块的中、英、日文文案。说明优先展示网关自身的文案，长文本沿用 `j-ellipsis`。

验证结果：本地 `/infrastructure/access/gateway` 已复核七条记录，数采和固定地址显示「无需配置」，MQTT 与 Agent 显示实际连接信息。中英日文各七个连接信息场景、Vue 编译、样式门禁及模块构建通过。工作区和模块未配置独立 lint 脚本。在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍有 1,737 条既有诊断，按文件、错误码和末级原因对比无新增。

## 表单失焦校验

`hooks/useValidateInfosBlur.ts` 在 Network 的 `useNetworkEditor.ts`、GB28181 的 `useGb28181Editor.ts` 和固件 `views/device/Firmware/Save/index.vue` 创建表单后，直接为已有 `validateInfos` 附加 `onBlurCapture`。通过 `@device-manager-ui/hooks/useValidateInfosBlur` 引入，并调用 `useValidateInfosBlur({ validateInfos, validate, rulesRef })`。保留 `Form.useForm`、模板绑定、规则与保存调用；实现与测试均归属 `device-manager-ui`，不使用依赖补丁。

仅处理显式 `trigger: 'blur'` 或触发数组包含 `blur` 的规则，覆盖 `resetFields()` 重建字段信息与动态规则变化。适用于产生原生失焦事件的普通单字段表单项；`noStyle`、嵌套表单项、`mergeValidateInfo` 及依赖 `a-form-item-rest` 上下文隔离的场景不直接适用。

在本模块执行 `node --test tests/validateInfosBlur.test.mjs`，8 项检查通过，覆盖真实 Vue / Ant Design Vue 的必填及长度边界、触发方式过滤、重置、动态规则、字段及实例隔离、Scope 清理和 FormItem 事件传递。`pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types vue hooks/useValidateInfosBlur.ts` 通过；三个调用文件的编译和模块内导入解析、差异空白检查通过。未配置独立 lint 脚本。

该辅助函数与此前通过 Network / GB28181 浏览器失焦验证的实现一致，本次仅改为模块内落点并重新执行上述定向检查；未重新进行浏览器验收、全量类型检查及生产构建。需要完整验证时，在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，在 `runtime-ui/jetlinks-web-core/` 执行 `pnpm exec vite build --outDir /private/tmp/jetlinks-device-blur-build -- --module-name device-manager-ui`；既有全量类型诊断仍需单独处理。

## 网络组件本地端口

`views/link/Type/Detail/index.vue` 的共享端口选项同时监听网络类型和 `configRef` 资源数据，详情、支持类型与资源请求可以并行回填，消除资源先返回时类型尚未就绪造成的偶发空列表。沿用 TCP／UDP 映射、集群端口交集及独立配置的主机端口规则，选项重算保留已配置端口。

验证：使用实际页面脚本与 Vue 响应式运行时控制响应顺序，资源先返回、详情先返回、类型切换与资源刷新、空资源、独立配置和新增页类型回填共 6 项检查通过，并在 `origin/2.20` 基线复现资源先返回时端口选项为空。三个修改组件的 Vue 脚本、TypeScript 语法、模板编译及差异空白检查通过。既有浏览器人工验证记录覆盖 `view=false` 与 `view=true` 两个入口的真实端口选项和已有端口回显。根项目与本模块未配置独立 lint 脚本。

全量验证：在 `runtime-ui/jetlinks-web-core/` 执行 `pnpm exec vite build --outDir /tmp/jetlinks-network-port-build -- --module-name device-manager-ui`，模块构建通过（11,620 个模块，56.50 秒），仍有资源路径、CSS 注释与大 chunk 警告。在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，当前与 `origin/2.20` 基线均有 1,825 条诊断；映射改动行号后，诊断位置、错误码和末级原因无新增或减少。描述列新增 `ellipsis` 使一条既有 TS2322 的类型展开文本变化，末级原因仍为操作列 `dataIndex` 可为 `undefined`。全量类型检查仍未通过。
