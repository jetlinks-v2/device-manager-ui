# 设备接入网关新增/编辑与详情回归

目标范围是 `runtime-ui/modules/device-manager-ui`。测试使用真实业务组件，HTTP、菜单与跨标签页边界采用假数据，不会写入真实后端。完整逐类型结果及剩余风险见 `docs/plans/device-access-gateway-prototype-alignment.md`。

## 保存请求契约

在聚合工作区根目录执行：

```sh
node runtime-ui/modules/device-manager-ui/tests/gateway/save-contract.cjs
node runtime-ui/modules/device-manager-ui/tests/gateway/known-defects.cjs
node runtime-ui/modules/device-manager-ui/tests/gateway/outline-contract.cjs
```

`save-contract.cjs` 编译真实 Vue SFC script setup 及其引用的业务 hooks，使用 Vue renderer 和 Ant Design Vue `Form.useForm` 挂载并运行生命周期，加载真实 `api/link/accessConfig.ts`，仅替换请求等外部边界。模板表单 `validate` 使用受控替身；原生表单事件、拆分后的表单引用和提交由浏览器回归验证。

当前实现从真实 `wizard.submit()` 进入前置验证与原保存函数；固定基线仍执行原来的保存入口。界面步骤次序可以按原型变化，最终请求、数据及回传必须相同。复合内嵌子编辑通过局部回传保存草稿，父网关确认时才整体写入。

`save-baseline.json` 在运行时布局改造前根据该模块固定提交 `53aa23bacb20f550f11383609417ad04e1b224a3` 生成。132 个用例逐项比较实际序列化 method、URL、body、次数、回调、返回顺序；覆盖 24 种 provider 的新增、编辑、失败响应，以及 Agent HTTP/MQTT、GB 共享/独立、复合子配置、必填/长度/选择/绑定/数量限制。日常回归不应重新生成基线。

需要审计基线来源时，可在模块目录运行 `node tests/gateway/save-contract.cjs --baseline`；它读取固定提交而非当前业务文件，但会覆盖基线 JSON，仅在明确核验来源时使用。

`known-defects.cjs` 独立比较改造前后的 GB28181 快捷创建分支，断言两边均复现 `onBack(rsp)` 未定义异常。脚本通过代表缺陷已复现，**不代表该业务分支正常**，也不计入 132 个通过用例。

## 浏览器验证页

```sh
pnpm -C runtime-ui exec vite --config modules/device-manager-ui/tests/gateway/browser/vite.config.mjs
```

打开 `http://127.0.0.1:9310/?provider=http-server-gateway#/gateway`，通过列表的新增或编辑按钮进入真实配置弹窗。URL 的 `provider` 参数可换成结果文档中的任意 provider；历史 Modbus/OPC UA 仍只显示原有编辑入口。`case` 参数用于区分重新加载后的 fixture。

可选参数：

- `transport=MQTT_SERVER`：Agent 使用 MQTT 网络；默认 Agent 使用 HTTP。
- `independent=1`：GB28181 使用独立集群配置。
- `failure=1`：保存返回失败，检查不关闭、不回传。
- `bound=1`：模拟已绑定产品，检查原编辑限制。
- `locale=en`：切换英文资源。

验证页使用真实 Vue Router、Ant Design Vue、PermissionButton、ValueItem、I18nTextField 及布局组件。JProTable/CardBox、菜单、跨标签 hook、HTTP 等采用受控承载；新增/编辑的协议 Markdown 以原文展示，`outline=1` 的详情模式使用真实 Markdown。页面“验证记录”展示请求和回调，可从 DOM 的 `data-testid=capture` 读取；运行时错误单独记录。

`browser-results.json` 是本次浏览器逐项操作的去重记录：24 类型、52 个不同正常场景（22 种现有新增入口、24 种编辑，加 Agent 和 GB 的配置变体），已替换为 footer 改造后的请求证据。每项确认按钮位于原生 `.ant-modal-footer`；Channel、固定地址视频、Onvif、数采的原生提交按钮还检查 `form` 属性与实际所属表单一致。同时保留动态必填、失败响应、绑定限制、子配置零写入回传等特殊检查。它是验证证据文件，**不是自动化浏览器重放脚本**。

每项正常保存检查 provider、POST/PATCH、运行时错误及返回后列表状态；此外验证原生提交、0/false 配置、自由步骤及概览跳转与草稿、缺项定位、取消、重选、失败不关闭、绑定产品协议锁定、复合子接入取消/重选/新增/编辑的零写入，并确认复合配置切换 footer、重选后隐藏 footer、取消零写入。9200 真实运行时页面另做两列「接入」按钮、新增/编辑回显、资源候选、文档、取消和 390px 窄屏只读冒烟；本轮补充长字段/代码换行、Topic 表格自身横向滚动、概览只纵向滚动、空值「未配置」、宽窄屏配置区与概览不重叠及 footer 可见。真实保存后的 ProTable 状态、跨标签消息、权限拒绝、创建资源后的回选、完整英文页面以及真实后端/设备联调仍需运行时测试环境验证。

数采说明移至右侧后的补充证据位于 `special` 中的 `collectorGuideRight` 项，覆盖数采新增/编辑、共用 Channel 视图的历史 Modbus TCP/OPC UA 编辑共 4 个受控场景，以及真实页面的桌面/390px 只读验证。数采新增实际使用 Channel 视图，编辑使用 Edge/geteway 视图，验证时必须分别进入，不能以其中一处的结果代替另一处。原 52 个正常场景记录继续保留。

全部同类说明移至右侧的补充证据位于 `allGuidesRight` 项，覆盖固定地址视频、Onvif、GB28181、OneNet 新旧版、Ctwing、数采、历史 Modbus TCP/OPC UA、边缘网关/子设备和复合网关共 12 类、24 个保存场景及 86 次布局检查。云平台基础/网络步骤分别显示对应说明，协议步骤隐藏；GB 说明仍仅在基础步骤显示，边缘网关保留原显示条件。另在真实 9200 OneNet 新版页面验证说明展开、步骤切换、纵向滚动及 390px 窄屏，无真实后端写入；不将该窄屏证据等同于全部类型的逐项窄屏验证。

## 只读详情

`outline-contract.cjs` 运行真实详情加载器、分区映射和 Vue watcher，覆盖 24 类、33 个场景。原配置深冻结，复合子项故意不提供实体 ID、补全结果故意反序，检查原配置顺序、各子项资源和协议隔离、插件 0/false/数组、GB 共享/独立、空复合、引用缺失、重试及过期响应。请求边界拒绝保存、启停和删除；原有 POST 查询端点仍允许。

打开 `http://127.0.0.1:9310/?outline=1&provider=composite-device-gateway#/gateway`，点击卡片进入真实详情弹窗。全部 24 个 provider 均可替换验证；该模式也允许进入复合编辑，再点击子卡片验证未保存配置预览。

详情参数：

- `independent=1`：独立 SIP 集群，包含端口 0、启用值 false。
- `emptyChildren=1`：空复合网关。
- `missingNetwork=1`、`missingProtocol=1`：关联资源失效。
- `outlineFailure=network`、`detail`、`children`：对应查询首次失败，点击「重试」后恢复。
- `long=1`：长协议代码块，使用真实 Markdown，检查换行与表格自身横向滚动。

`browser-results.json` 的 `outlineModal` 特殊项保留 24 类详情、7 个变体、复合草稿预览及宽窄屏证据，原 52 个正常保存场景和其他特殊项不变。真实 9200 首次收尾时重载为空白，页面恢复后已补验 HTTP/MQTT/GB/复合及390px只读详情，证据追加至 `gatewayDefaultHeader`；同时确认详情、新增、编辑均使用项目默认 header。详情受控回归和真实只读冒烟不能推断真实设备联调完成。
