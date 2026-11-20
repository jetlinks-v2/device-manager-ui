# Device Manager UI

设备管理前端模块，提供设备、产品与物联告警等页面。菜单定义由 `baseMenu.ts` 加载 `baseMenu.json`。

物联告警菜单的数据权限由 `baseMenu.json` 声明，`iot` 和 `app` 两个入口的 `assetTypes` 均需包含 `user`，以支持通知对象的用户资产授权。更新定义后需同步已保存的菜单，并在角色或应用授权中配置用户资产范围；设备的“自己创建的”权限不会自动限制用户列表。验收时使用受限账号核对 `/user/detail/_query` 返回的通知对象范围，JSON 配置检查不能替代部署后的权限验证。

## 设备树与接入列表

`views/device/list/components/IotDeviceScopeSidebar.vue` 使用 core 的 `AutoTree` 自动适配侧栏高度并启用虚拟滚动，保留原有树属性、插槽和选择事件。该入口依赖 [core PR #224](https://github.com/jetlinks-v2/jetlinks-web-core/pull/224)；异步页面首次挂载的滚轮绑定还依赖运行时工作区的 `patches/ant-design-vue@4.2.6.patch`，发布时需同步交付。

`views/link/AccessConfig/index.vue` 为描述列启用 `ellipsis`，长描述省略显示。

## 表单失焦校验

`hooks/useValidateInfosBlur.ts` 在 Network 的 `useNetworkEditor.ts`、GB28181 的 `useGb28181Editor.ts` 和固件 `views/device/Firmware/Save/index.vue` 创建表单后，直接为已有 `validateInfos` 附加 `onBlurCapture`。通过 `@device-manager-ui/hooks/useValidateInfosBlur` 引入，并调用 `useValidateInfosBlur({ validateInfos, validate, rulesRef })`。保留 `Form.useForm`、模板绑定、规则与保存调用；实现与测试均归属 `device-manager-ui`，不使用依赖补丁。

仅处理显式 `trigger: 'blur'` 或触发数组包含 `blur` 的规则，覆盖 `resetFields()` 重建字段信息与动态规则变化。适用于产生原生失焦事件的普通单字段表单项；`noStyle`、嵌套表单项、`mergeValidateInfo` 及依赖 `a-form-item-rest` 上下文隔离的场景不直接适用。

在本模块执行 `node --test tests/validateInfosBlur.test.mjs`，8 项检查通过，覆盖真实 Vue / Ant Design Vue 的必填及长度边界、触发方式过滤、重置、动态规则、字段及实例隔离、Scope 清理和 FormItem 事件传递。`pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --types vue hooks/useValidateInfosBlur.ts` 通过；三个调用文件的编译和模块内导入解析、差异空白检查通过。未配置独立 lint 脚本。

该辅助函数与此前通过 Network / GB28181 浏览器失焦验证的实现一致，本次仅改为模块内落点并重新执行上述定向检查；未重新进行浏览器验收、全量类型检查及生产构建。需要完整验证时，在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，在 `runtime-ui/jetlinks-web-core/` 执行 `pnpm exec vite build --outDir /private/tmp/jetlinks-device-blur-build -- --module-name device-manager-ui`；既有全量类型诊断仍需单独处理。

## 网络组件本地端口

`views/link/Type/Detail/index.vue` 的共享端口选项同时监听网络类型和 `configRef` 资源数据，详情、支持类型与资源请求可以并行回填，消除资源先返回时类型尚未就绪造成的偶发空列表。沿用 TCP／UDP 映射、集群端口交集及独立配置的主机端口规则，选项重算保留已配置端口。

验证：使用实际页面脚本与 Vue 响应式运行时控制响应顺序，资源先返回、详情先返回、类型切换与资源刷新、空资源、独立配置和新增页类型回填共 6 项检查通过，并在 `origin/2.20` 基线复现资源先返回时端口选项为空。三个修改组件的 Vue 脚本、TypeScript 语法、模板编译及差异空白检查通过。既有浏览器人工验证记录覆盖 `view=false` 与 `view=true` 两个入口的真实端口选项和已有端口回显。根项目与本模块未配置独立 lint 脚本。

全量验证：在 `runtime-ui/jetlinks-web-core/` 执行 `pnpm exec vite build --outDir /tmp/jetlinks-network-port-build -- --module-name device-manager-ui`，模块构建通过（11,620 个模块，56.50 秒），仍有资源路径、CSS 注释与大 chunk 警告。在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，当前与 `origin/2.20` 基线均有 1,825 条诊断；映射改动行号后，诊断位置、错误码和末级原因无新增或减少。描述列新增 `ellipsis` 使一条既有 TS2322 的类型展开文本变化，末级原因仍为操作列 `dataIndex` 可为 `undefined`。全量类型检查仍未通过。
