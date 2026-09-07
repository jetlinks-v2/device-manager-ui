# 设备详情：设备接入

## 展示边界

Owning module：`runtime-ui/modules/device-manager-ui`。详情页 `asyncComponent.ts` 的 `Diagnose` 标签加载本目录 `index.vue`，由 `InstanceAccessGuide.vue` 展示接入配置。

- 接入方式、接入地址、设备配置和设备身份是通用区域，不应因 `plugin_gateway` 而整体隐藏。
- 设备配置复用 `../Info/components/Config/index.vue`：通过 `api/instance.ts` 的 `getConfigMetadata(deviceId)` 获取字段定义，结合设备详情的 `configuration` 展示和编辑；没有配置定义时沿用组件空态规则。
- 设备身份复用 `../Info/components/Principal/index.vue`，是否展示由已有身份能力和数据决定。
- 普通协议的说明来自 `api/product.ts` 的 `getConfigView(protocol, transport)`；插件接入跳过这个协议说明接口，但仍展示通用区域。组合接入继续使用已有子网关查询。
- 产品类型映射和产品配置仍归产品详情管理，不能用产品页跳转代替设备级配置。

## 实现范围

`InstanceAccessGuide.vue` 统一在取得接入信息后展示通用区域，移除了插件专用跳转分支及其无用状态、路由依赖。插件跳过普通协议说明请求的规则保留在查询分支中，不再控制通用区域的可见性。

仅调整本模块的页面组合和设备 ID 映射入口，不改后端接口、配置或映射保存逻辑、产品配置和通信链路功能。

## 设备 ID 映射入口

详情页 `../index.vue` 将设备 ID 与 `../components/DeviceIdMapping.vue` 组成紧凑的行内组，间距 6px，避免 ID 伸展推远映射入口。入口复用 Ant Design Vue 按钮、Tooltip 和 `LinkOutlined`，未设置映射时显示“ID映射”，已设置时显示“已映射”；Tooltip 显示第三方设备 ID，未配置时说明双方 ID 相同则无需映射。宽度不超过 768px 时隐藏短文字，保留图标和包含状态的无障碍名称，点击继续打开原有映射弹窗。长设备 ID 省略展示，Tooltip 保留完整 ID 和复制提示。中英文文案同步维护。

对齐规则：ID 行内组采用垂直居中，避免嵌套 flex 按钮的首个图标基线导致映射文字高于 ID；不通过固定偏移补偿。浏览器测量确认：904px 下 ID 与映射文字的行框、文字范围纵坐标均一致；768px 下图标与 ID 的垂直中心差小于 0.01px。此次样式修正由开发服务器编译并在宽窄屏验证，未重复执行完整模块构建。

验证通过：904px 下入口与 ID 同行且间距 6px，768px 下仅显示图标并保留无障碍名称；Enter 和鼠标均可打开现有弹窗并取消。已映射文案和第三方 ID Tooltip 使用临时页面内存状态验证，未写入真实映射；普通 JT808 设备不显示映射入口。两处组件的生产模式 SFC 编译、中英文 JSON 和新增文案键检查通过，模块构建通过。完整类型检查沿用下述已有阻断结论。

弹窗验证限制：最后一次打开时页面提示“服务器内部错误”且第三方设备列表为空，未验证真实映射保存。该弹窗和请求逻辑未在本次调整中修改，需插件服务恢复后补验设备选择和保存。

## 验证

- 浏览器验证通过：插件设备的配置元数据接口返回 200，API 地址、认证密钥字段正常展示，编辑表单正确回显并可关闭；未提交配置或执行应用操作，插件未请求普通协议说明接口。
- 普通协议回归通过：JT808 设备的接入方式、TCP 地址、认证配置、接入身份和协议说明均正常展示。
- 组件生产模式 SFC 脚本和模板编译通过；`git diff --check` 通过。
- 在 `runtime-ui` 执行 `pnpm --filter jetlinks-web-core build -- --module-name device-manager-ui` 构建通过，现有 Rollup `output.input` 配置和大体积 chunk 警告仍存在。
- 完整类型检查未通过：`pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 被已有 `views/link/Certificate/type.d.ts:2` 的 `export interface TypeObjType = {` 语法错误（TS1005）阻断。需在该问题修复后重跑同一命令；本次未调整证书功能或类型检查配置。
- 当前模块及 runtime-ui 未配置独立 lint 命令/配置，未运行 lint。配置保存行为未变更，浏览器验证覆盖展示、回显和取消；不同插件最终显示的字段仍由其后端配置定义决定。

## 交付引用

- 实现提交：`113dd83ded23e4e51f73d567d2fd912483ea0005`。
- Pull Request：[device-manager-ui #250](https://github.com/jetlinks-v2/device-manager-ui/pull/250)，目标分支 `2.12`。
