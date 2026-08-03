# iot-ui 设备详情改造接手说明

本文档用于承接 `modules/iot-ui` 中“物联 -> 设备列表 -> 设备详情”模块的持续优化。重点记录这次会话已经完成的改造、当前结构、真实接口接入情况、已知差距，以及下一步建议。

## 1. 目标页面

- 菜单：`物联 / 设备列表 / 设备详情`
- 当前实现入口：
  - [IotDeviceDetailView.vue](views/device/list/components/IotDeviceDetailView.vue)
- 参考旧页面：
  - 菜单：`物联网 / 设备管理 / 设备`
  - 路由：`/iot/device/Instance/detail/{id}`
  - 旧详情入口：
    - [modules/device-manager-ui/views/device/Instance/Detail/index.vue](views/../device-manager-ui/views/device/Instance/Detail/index.vue)

## 2. 这次改造的核心结论

### 2.1 页面结构

新设备详情已改成 4 个顶级标签：

- `概览`
- `数据`
- `记录`
- `高级`

并采用旧版详情那种“页内二级标签”的交互方式，而不是简单堆 section。

当前二级标签结构：

- `数据`
  - `属性`
  - `事件`
  - `通信链路`
- `记录`
  - `告警`
  - `日志`
- `高级`
  - `设备功能`
  - `健康配置`
  - `阈值配置`
  - `物模型查看`
  - `设备接入`
  - `数据偏离`
  - `子设备`

### 2.2 产品定位约束

当前页面是 SaaS 平台设备详情，用户目标偏“快速使用标准设备、查看设备信息、排查设备异常”，不是旧版那种偏运维/部署/协议调试的全量设备运维台。

因此当前实现遵循这些原则：

- 详情结构参考旧版，但不照搬其重量级组织
- 设备来自标准设备库模板，但具体数据仍以设备/产品中的真实保存数据为准
- `设备健康` 页面仍是异常风险主阵地，设备详情只做必要联动，不抢概览职责
- 物模型与健康配置查看尽量和设备库详情保持统一

## 3. 当前主要组件

### 3.1 主页面

- [IotDeviceDetailView.vue](views/device/list/components/IotDeviceDetailView.vue)
  - 顶层 4 标签与二级标签切换
  - 聚合概览、数据、记录、高级各子组件
  - 设备、命令、健康诊断、待办、模拟链路等数据整合

### 3.2 数据页

- [IotDevicePropertyCardsTab.vue](views/device/list/components/device-detail/IotDevicePropertyCardsTab.vue)
  - 属性卡片列表
  - 当前值、读写类型、数据类型、更新时间
  - 已补回旧版方向的 `读取 / 设置` 按钮显隐逻辑
  - `历史数据` 走抽屉
  - `查看详情` 已升级为带时间过滤、列表、图表的详情弹层
  - 目前图表与历史数据仍以 `iot-ui` 本地轻量数据生成逻辑为主，尚未切到旧版真实属性接口链

- [IotDeviceEventGroupsTab.vue](views/device/list/components/device-detail/IotDeviceEventGroupsTab.vue)
  - 事件按分组展示的轻量实现
  - 目前是按 `RealtimeEventRow.id` 做分组分页骨架
  - 还没完全做到旧版 `getEventList(eventId)` 那种真实事件字段列表

- [IotDeviceSimulatorTab.vue](views/device/list/components/device-detail/IotDeviceSimulatorTab.vue)
  - 通信链路页
  - 当前复用现有模拟链路/trace 视图
  - 已去掉数据页中额外的“通信链路”顶部空说明

### 3.3 概览页

- [IotDeviceOverviewTab.vue](views/device/list/components/device-detail/IotDeviceOverviewTab.vue)
  - 已多轮重构，目前是偏扁平化、横向信息布局
  - 运行概况：
    - 近 7 天在线率
    - 24h 上下行消息数
    - 当前异常数
    - 最近通信
    - 注册时间
    - 离线提示
    - 右上角 `查看设备健康`
  - 设备接入：
    - 不再是静态快照
    - 当前已改成和 `高级 -> 设备接入` 同源的数据摘要
    - 包含接入地址、配置、设备认证，并支持复制
  - 属性实时值：
    - 只展示关注属性
    - 支持 `查看全部属性`
    - 概览卡片中的 `历史数据` 直接打开抽屉
  - 最近记录：
    - 展示最近告警与日志
  - 当前已补 query 路由化联动：
    - 概览里的跳转可直接落到对应顶级/二级标签

### 3.4 高级页

- [IotDeviceAccessDetailTab.vue](views/device/list/components/device-detail/IotDeviceAccessDetailTab.vue)
  - 新增的“设备接入”详情组件
  - 目标是取代旧的“设备连接”
  - 内容包括：
    - 接入方式
    - 接入地址
    - 配置
    - 设备认证
    - 协议文档
  - 当前已暴露：
    - `refresh`
    - `accessDetail`
    - `addressRows`
    - `configGroups`
    - `principalRows`
    - `connectionRows`
  - 概览页“设备接入”当前依赖这里的同源数据

- [IotDeviceThresholdConfigTab.vue](views/device/list/components/device-detail/IotDeviceThresholdConfigTab.vue)
  - 阈值配置
  - 当前做了本地真实请求封装，不依赖 `device-manager-ui/api/instance.ts` 的导出
  - 最新状态：已改成只读查看，不允许新增、刷新、编辑、删除

- [StandardHealthConfigView.vue](views/device/shared/standard-model/StandardHealthConfigView.vue)
  - 已支持裁剪展示：
    - `showConnection`
    - `showDeviation`
  - 因此 `健康配置` 与 `数据偏离` 已拆成独立子标签

## 4. 已接入的真实接口与数据来源

### 4.1 新设备详情主数据

来自 `iot-ui` 现有服务适配层：

- [iotDeviceApiAdapter.ts](views/device/list/services/adapters/iotDeviceApiAdapter.ts)
- [iotDevice.service.ts](views/device/list/services/iotDevice.service.ts)

已使用真实接口的核心数据：

- 设备详情：`/device-instance/{id}/detail`
- 设备列表：`/device-instance/_query`
- 设备功能执行：`/device/invoked/{deviceId}/function/{functionId}`

额外说明：

- `iotDeviceApiAdapter.ts` 里已补 `createdAt` 的标准时间映射
- 详情页显示的时间当前统一为 `YYYY-MM-DD HH:mm:ss`

### 4.2 设备接入详情

`IotDeviceAccessDetailTab.vue` 里目前直接使用真实请求：

- 产品详情：`/device-product/{id}`
  - 用于拿 `accessId`
- 接入详情查询：`/gateway/device/detail/_query`
- 协议配置/文档：`/protocol/{id}/transport/{transport}`
- 设备认证支持判断：`/device/principal/support`
- 设备认证查询：`/device/principal/{deviceId}`

说明：

- 这里没有继续强依赖旧模块组件，而是复用了旧接口语义，在 `iot-ui` 内做轻量适配
- 这样边界更干净，也更方便继续按新设计打磨

### 4.3 阈值配置

`IotDeviceThresholdConfigTab.vue` 中直接封装了真实请求：

- 设备阈值列表：`POST /message/preprocessor/product/{productId}/{deviceId}/property/_list`
- 产品阈值列表：`POST /message/preprocessor/product/{productId}/property/_list`
- 设备阈值保存：`PUT /message/preprocessor/device/{productId}/{deviceId}/property/{propertyId}`
- 设备阈值删除：`DELETE /message/preprocessor/device/{productId}/{deviceId}/property/{propertyId}`

原因：

- 旧模块 `device-manager-ui/api/instance.ts` 虽然源码里有这些导出，但打包链路里对 `iot-ui` 直接引用存在导出解析问题
- 所以当前在 `iot-ui` 组件内本地封了一层请求，构建已验证通过

## 5. 当前仍然是 mock / 轻量适配的部分

### 5.1 数据 -> 事件

当前 `IotDeviceEventGroupsTab.vue` 是轻量版：

- 已满足：
  - 分组
  - 分页
  - 二级标签结构
- 尚未完全满足：
  - 按旧版真实事件定义 `eventId` 查询
  - 根据事件物模型字段生成动态列
  - 类似旧版 `Running/Event/index.vue + ValueRender.vue` 的字段值渲染

下一步应优先参考：

- [modules/device-manager-ui/views/device/Instance/Detail/Running/Event/index.vue](views/../device-manager-ui/views/device/Instance/Detail/Running/Event/index.vue)
- [modules/device-manager-ui/views/device/Instance/Detail/Running/Event/ValueRender.vue](views/../device-manager-ui/views/device/Instance/Detail/Running/Event/ValueRender.vue)
- 真实接口：
  - `getEventList`

### 5.2 数据 -> 属性详情

当前 `IotDevicePropertyCardsTab.vue` 已具备：

- 紧凑属性卡片
- 读取 / 设置按钮显隐
- 历史数据抽屉
- 详情弹层（时间过滤 + 列表 + 图表）

但尚未完全接入旧版这些真实能力：

- 属性详情图表的真实聚合数据
- 属性历史真实查询链路
- 复杂类型 / 文件 / 地理位置等旧版属性详情渲染深度

可参考旧版：

- [modules/device-manager-ui/views/device/Instance/Detail/Running/Property/index.vue](views/../device-manager-ui/views/device/Instance/Detail/Running/Property/index.vue)
- [modules/device-manager-ui/views/device/Instance/Detail/Running/Property/Detail/index.vue](views/../device-manager-ui/views/device/Instance/Detail/Running/Property/Detail/index.vue)
- 真实接口：
  - `getPropertyData`
  - `getPropertiesInfo`
  - `getPropertiesList`

### 5.3 概览 -> 连接设备

当前该区域已从“连接设备”改名为“设备接入”，并且已不再是简单快照。

当前已做到：

- 复用高级-设备接入的同源数据
- 展示接入地址、配置、设备认证
- 支持复制
- `查看详情` 可直接落到 `高级 -> 设备接入`

仍可继续优化：

- 总览里的信息密度可再压缩
- 配置 / 认证展示顺序可进一步统一到最终版信息架构
- 协议文档是否需要在总览露出入口还可再评估

### 5.4 路由状态

当前 `IotDeviceDetailView.vue` 已支持顶级 / 二级标签 query 状态同步：

- 顶级：
  - `tab=overview`
  - `tab=data`
  - `tab=records`
  - `tab=advanced`
- 二级：
  - `sub=property | event | trace`
  - `sub=alarm | log`
  - `sub=function | health | threshold | thing-model | connection | deviation | children`

因此浏览器前进/后退已能感知 `数据 / 记录 / 高级` 的二级标签状态。

## 6. 与旧页面对齐时的注意事项

不要直接整块搬旧版组件，原因如下：

- 旧版大量依赖 `useInstanceStore`
- 和旧菜单/旧权限/旧详情上下文绑定很深
- 旧组件更偏本地部署/设备运维，不完全适合当前 SaaS 语境

推荐方式：

1. 复用旧版接口语义
2. 复用旧版交互结构
3. 按 `iot-ui` 当前数据模型和设计语言重新包一层

优先参考价值最高的旧文件：

- 接入详情：
  - `Detail/DeviceAccess/index.vue`
  - `Detail/DeviceAccess/InstanceAccessGuide.vue`
  - `Detail/Info/components/Config/index.vue`
  - `Detail/Info/components/Principal/index.vue`
- 属性：
  - `Detail/Running/Property/index.vue`
  - `Detail/Running/Property/Detail/index.vue`
- 事件：
  - `Detail/Running/Event/index.vue`
  - `Detail/Running/Event/ValueRender.vue`
- 阈值：
  - `Detail/Threshold/index.vue`

## 7. 这次会话新增/重点修改的文件

### 新增

- [views/device/list/components/device-detail/IotDeviceAccessDetailTab.vue](views/device/list/components/device-detail/IotDeviceAccessDetailTab.vue)
- [views/device/list/components/device-detail/IotDeviceEventGroupsTab.vue](views/device/list/components/device-detail/IotDeviceEventGroupsTab.vue)
- [views/device/list/components/device-detail/IotDevicePropertyCardsTab.vue](views/device/list/components/device-detail/IotDevicePropertyCardsTab.vue)
- [views/device/list/components/device-detail/IotDeviceThresholdConfigTab.vue](views/device/list/components/device-detail/IotDeviceThresholdConfigTab.vue)

### 重点修改

- [views/device/list/components/IotDeviceDetailView.vue](views/device/list/components/IotDeviceDetailView.vue)
- [views/device/list/components/device-detail/IotDeviceOverviewTab.vue](views/device/list/components/device-detail/IotDeviceOverviewTab.vue)
- [views/device/list/components/common/Icon.vue](views/device/list/components/common/Icon.vue)
- [views/device/shared/standard-model/StandardHealthConfigView.vue](views/device/shared/standard-model/StandardHealthConfigView.vue)

### 2026-07-07 国际化修复

- [locales/lang/zh.json](locales/lang/zh.json) / [locales/lang/en.json](locales/lang/en.json)
  - 补齐设备接入内层页签、设备指令参数区、调用弹窗、执行结果和指令元信息的中英文 key
- [views/device/list/components/IotDeviceAssetTable.vue](views/device/list/components/IotDeviceAssetTable.vue)
  - 设备图片 `alt` 文案改为语言包 key
- [views/device/list/hooks/useIotDeviceCommandMeta.ts](views/device/list/hooks/useIotDeviceCommandMeta.ts) / [hooks/useIotDeviceCommandMeta.ts](hooks/useIotDeviceCommandMeta.ts)
  - 指令分类、风险和执行状态 label 改为通过 `@jetlinks-web-core/locales` 解析语言包
- [views/device/list/hooks/useIotDeviceLogMeta.ts](views/device/list/hooks/useIotDeviceLogMeta.ts) / [hooks/useIotDeviceLogMeta.ts](hooks/useIotDeviceLogMeta.ts)
  - 日志级别、来源 label 改为通过 `@jetlinks-web-core/locales` 解析语言包
- 日志相关语言包
  - 补齐设备日志列表、方向、列头、空态、分页、日志来源和级别的中英文 key

## 8. 当前验证结果

已验证：

- `pnpm --filter iot-ui build`
- 2026-07-07：`PATH=/Users/hukaiyu/.nvm/versions/node/v22.18.0/bin:$PATH pnpm -C ui --filter iot-ui build`
- 2026-07-07：中英语言包 JSON 解析、key 数量对齐、设备列表 / 设备接入 / 设备指令相关 `$t` key 缺失检查
- 2026-07-07：设备日志相关 `$t` key 缺失检查、日志英文 key 中文泄漏检查

结果：

- 构建通过
- 2026-07-07：构建通过；仅保留既有 Vite/Rollup chunk 与 CSS 注释类警告

## 9. 下一步建议优先级

### P1

- 把 `数据 -> 事件` 真正切到旧版 `getEventList(eventId)` 的动态事件列表实现
- 把 `数据 -> 属性` 详情切到旧版真实属性接口链（列表 / 图表 / 时间过滤）
- 继续打磨 `概览 -> 设备接入` 的信息密度与展示顺序

### P2

- 设备接入中的协议文档渲染继续对齐旧版模板变量替换逻辑
- 通信链路继续贴近旧版 trace 交互，而不是仅停留在模拟 trace
- 顶部主标签 icon / 对齐 / 高度可继续做纯视觉打磨

### P3

- 阈值配置可继续抽离服务层，而不是只放在组件内请求
- 评估是否把“设备接入 / 物模型查看 / 健康配置”的只读能力进一步沉淀为 `iot-ui` 共享组件

## 10. 给下一次会话的建议提示词

可以直接用下面这种方式续上：

```text
请先阅读 modules/iot-ui/DEVICE_DETAIL_HANDOFF.md，然后继续优化 iot-ui 的设备详情。
本轮优先做：
1. 数据 -> 事件，改成按旧版 getEventList 的真实分组分页列表
2. 数据 -> 属性，补真实属性详情与历史查询
3. 概览 -> 连接设备，继续优化动态认证与连接信息展示
```

## 11. 设备助手受控操作能力优化计划（待确认）

### 11.1 当前结论

当前 `/iot-user/device/list/Detail/{id}` 使用的是 `iot-ui` 自己的设备详情助手，不是
`device-manager-ui` 的设备助手。现有契约同时从三处把会话限定为只读：

- `views/device/list/agent/useDeviceDetailAgent.ts` 注入 `systemPrompt.readonly`，明确禁止设备控制、属性写入和功能调用。
- 同文件把工具组说明声明为只读，并为未单独声明风险的工具设置 `readOnly=true` 默认值。
- `views/device/list/agent/deviceDetailAgent.tools.ts` 只注册查询、短时取证和页签导航工具，没有注册设备功能调用工具。

因此模型回复“当前会话是只读模式”符合现有页面契约，不是设备离线、物模型缺少功能或全局通用智能体权限被降级。页面本身已经通过
`views/device/list/services/iotDeviceDetailReal.service.ts` 的
`POST /device/invoked/{deviceId}/function/{functionId}` 支持真实功能调用，缺口在设备助手的工具暴露与风险治理。

### 11.2 目标与范围

目标是把设备详情助手从“整会话只读”改成“查询默认只读 + 动作显式注册 + 执行前确认”的混合能力模型：

- 查询、分析、文档和诊断工具继续直接执行，不弹确认。
- 设备功能调用作为首个受控动作工具暴露；模型能发现并选择功能、补齐参数，真正下发前必须由用户确认。
- 权限、目标设备、物模型、参数和后端运行条件在执行边界校验；不能由提示词提前推断成“无权限”或“不可执行”。
- 设计面向所有物模型功能，不按 `informationReportRequest`、产品、协议、租户或设备 ID 特判。

本轮不做：

- 不全局放开属性写入、告警处理、配置修改、设备启停或删除能力。
- 不修改 `runtime-ui/` 或 `device-manager-ui` 的另一套设备助手。
- 不绕过后端权限，不新增前端伪权限，不让模型自行确认高风险动作。
- 不在 WebSocket 重连后自动重放任何已确认或提交状态不明的写操作。

### 11.3 工具与权限契约

会话不再声明“首期只读”，而是明确以下边界：

1. `readOnlyHint` 是单个工具的副作用声明，不是会话级权限模式。
2. 普通查询工具继续继承 `riskDefaults.readOnly=true`；动作工具必须显式覆盖为
   `readOnly=false`、`parallelSafe=false`。
3. 浏览器拥有页面上下文和确认 UI，设备功能工具使用本地确认：工具定义声明 `confirm.localConfirmation=true`；共享运行时继续把后端
   HITL 标记归一为 `needsApproval=false`，避免前后端重复弹确认，但业务语义仍是“必须确认后执行”。
4. 工具不接受 `deviceId`，始终闭包绑定详情查询成功后的当前 subject，防止模型越权切换目标设备。
5. 功能 ID、名称、输入定义和必填参数来自当前设备真实物模型。功能不唯一或参数不完整时仅返回候选项 / 缺失项，不触发确认，也不调用后端。
6. 参数完整后，确认卡展示设备、功能、关键参数和调用影响；用户取消时不得执行请求。
7. 真正执行时复用现有真实功能调用接口，由后端继续裁决账号权限、设备状态、功能有效性和协议运行条件；前端只把错误转换为结构化业务结果，不伪造成功。

工具路由声明采用通用能力语义，例如：

- capability：`subject.function.invoke`
- accepts：`subject-function-id`
- produces：`function-invocation-receipt`
- dataAccessMode：`action`

这样 flat 模式和后续能力检索模式都能根据声明发现该动作，不依赖功能名称关键词或提示词猜测。

### 11.4 实施步骤与代码落点

1. **收敛会话文案**
   - 更新 `locales/lang/zh.json`、`locales/lang/en.json`：移除“整会话只读”表述，改为查询与受控动作的分层边界。
   - 更新 `views/device/list/agent/useDeviceDetailAgent.ts`：保留查询工具的只读默认值，但不再把它解释为会话权限；工具组说明同时列出查询与受控动作。

2. **建立 subject-bound 功能调用服务**
   - 在 `views/device/list/agent/` 内新增或抽取功能调用服务，负责加载真实物模型、按 ID/名称/说明解析唯一功能、校验必填参数并调用现有真实接口。
   - 服务只返回稳定、有限的功能候选、缺失参数、调用回执和结构化错误；不得复用会回退到 mock 执行的路径。

3. **注册通用动作工具**
   - 在 `views/device/list/agent/deviceDetailAgent.tools.ts` 增加设备功能调用工具及 routing/result binding。
   - 候选发现和缺参返回保持无副作用；只有功能唯一且参数完整时进入本地确认，确认后最多发送一次真实请求。
   - 在 `views/device/list/agent/deviceDetailAgent.service.ts` 组合该能力，并删除“全部能力只读”的过期注释。

4. **保持执行安全与恢复语义**
   - 沿用 `jetlinks-web-core` 现有客户端工具确认和初始化契约指纹，不新建第二套确认协议。
   - 工具目录变化后应触发新的初始化契约；活跃轮次结束后再刷新，避免执行中途切断客户端工具通道。
   - 断线时取消待确认操作；对已发送但结果未知的调用返回“提交状态未知”，重连后只允许查询当前状态或由用户明确再次发起，不自动重放。

5. **为后续动作保留统一扩展方式**
   - 属性写入、告警处理、配置修改等后续能力必须各自显式注册 action 工具、声明风险与确认内容，并复用同一 subject/权限/不重放边界。
   - 不通过移除 `riskDefaults`、把所有工具设为可写或添加场景白名单实现扩展。

### 11.5 验证目标

- 工具契约测试：查询工具仍为 `readOnly=true`；功能调用工具为 `readOnly=false`、`parallelSafe=false`，具有本地确认和 action routing。
- 解析测试：无参数功能、必填参数功能、名称模糊匹配、多候选、功能不存在和非法参数均返回预期结构，测试数据不绑定具体 JT808 功能。
- 确认测试：取消确认时真实接口调用次数为 0；确认后为 1；重复事件、超时和重连不增加调用次数。
- 权限/业务错误测试：详情无权访问时不创建工具闭包；后端返回无权限、设备离线、功能不存在或调用失败时不得声称完成。
- 初始化契约测试：`session.init` 中可见功能调用工具；工具目录变化或 WebSocket 重连后仍能恢复最新目录。
- 浏览器验收：在当前设备上请求“执行驾驶员身份信息上报”，应先出现包含设备与功能名称的确认卡；确认后页面产生一次真实调用并展示回执，取消则不产生调用。
- 回归验收：设备状态、属性历史、告警、日志等只读问题仍直接调用查询工具，不出现无意义确认。
- 质量门禁：中英文 key 对齐，运行 `iot-ui` 单元测试、相关 `jetlinks-web-core` 客户端工具测试、类型检查和模块构建。

### 11.6 风险与决策

- 页面现有命令风险等级包含名称关键词推断，不能把它升级为智能体授权依据；本轮所有设备功能调用至少统一确认，高风险分级只能使用后续明确的物模型 / 平台风险元数据。
- 当前已有客户端本地确认和后端功能调用接口，预计不需要后端改造。若联调证明后端无法返回稳定权限 / 提交状态错误，再单独进入后端设计与测试门禁，不在前端吞错或补假成功。
- 该改动不新增常驻缓存、队列或会话管理器，MBean 不适用；前端调用链复用现有请求与 WebSocket 观测，本轮不新增后端 TraceHolder 埋点。
- subject 绑定、确认前后边界和断线不重放属于非显而易见的安全约束，实施时需在对应服务 / 工具代码旁保留简短注释。

## 12. 设备属性聚合工具临时迁移计划（已确认）

### 12.1 目标与范围

先保留 `device-manager-ui` 的现有实现不动，将其设备属性聚合工具的模型可见定义和输入兼容规则机械迁入
`iot-ui` 设备助手，验证两套设备详情助手在属性趋势、统计和地理轨迹场景中的调用行为是否一致。

本轮 owning module 为 `modules/iot-ui`，只调整设备属性聚合工具及其定向测试；不修改页面结构、
`device-manager-ui`、`runtime-ui` 或后端接口，也不建立 `iot-ui -> device-manager-ui` 的深层源码依赖。

### 12.2 实施边界

- 保留 `iot-ui` 当前真实 API、权限边界、GeoPoint 原始历史降级和 typed client-tool 输出交付。
- 对齐 `device-manager-ui` 的 `propertyId/propertyIds`、聚合别名、时间桶别名和按属性类型选择默认聚合的规则。
- 迁移逻辑落在 `iot-ui` 自己的设备分析能力目录，设备详情助手和企业问数入口复用同一服务，不复制页面生命周期或 API 请求层。
- 这是临时重复实现；后续再将稳定、无副作用的聚合内核统一下沉到公共包，本轮不提前建立跨业务子模块公共 API。

### 12.3 风险与验证

- 风险：两份实现后续可能漂移，因此必须用同一组数值、枚举、GeoPoint、自然语言聚合别名和时间桶别名用例锁定行为。
- 验证：运行 `iot-ui` 属性聚合定向测试、客户端工具契约测试、相关类型/构建检查，并确认工具 schema 不产生
  `schema.required.undeclared`。
- 浏览器验收：设备详情询问指定月份轨迹时，工具应接受单个属性选择，返回经纬度语义字段，并由通用展示层生成轨迹预览。

### 12.4 实施与验证结果

- `agentCapabilities/deviceAnalysis/devicePropertyAggregate.support.ts` 已迁入单/多属性选择、自然语言聚合别名、
  时间桶别名和类型默认策略；数值默认 `AVG`、GeoPoint 默认 `LAST`、其他类型默认 `COUNT`。
- 企业问数与设备详情工具均声明 `propertyId/propertyIds` 和单值 `agg`，并将属性选择与预设/自定义时间范围编译为
  四个闭合 schema 分支；旧的多聚合输入不再向模型暴露，避免同一属性同时生成 `FIRST/LAST` 两组歧义序列。
- `1M` 已进入公共时间桶值域；GeoPoint 原始历史降级按升序分页并共享 10,000 条硬上限，达到上限时输出真实的
  partial evidence。轨迹有效粒度按观测时间跨度细化，现有权限、经纬度语义字段和 typed presentation 契约保持不变。
- 定向属性聚合契约测试、`pnpm exec vue-tsc --noEmit --pretty false` 与 `pnpm --filter iot-ui build` 已通过
  （保留现有 Rollup output option、CSS 注释和大 chunk 警告）。
- 浏览器真实设备对话待前端服务加载本次构建后执行，不将旧页面或特定设备 ID 写入工具分支。

### 12.5 双前端收口与 PR 交付扩展计划（已确认，实施中）

#### 目标与 owning module

- 将已经在 `runtime-ui/modules/device-manager-ui` 真实验证通过的通用复杂属性聚合边界同步到本仓库
  `modules/iot-ui`，使运营端设备详情也能稳定完成属性趋势、分桶统计和有序位置路径任务。
- `device-manager-ui` 继续由其独立仓库 PR #224 持有；`cloud.jetlinks.ui` 只持有 `iot-ui` 的适配和测试，
  `saas-runtime-ui` 只更新已验证的子模块 commit 指针。三个仓库不复制彼此无关改动。
- 当前 `cloud.jetlinks.ui` PR #389 属于视联聚合索引主题；本批设备助手变更从 `2.12-uat` 建立独立分支和 PR，
  不追加到 #389。

#### 明确不做

- 不修改页面布局、消息 renderer、ECharts 公共实现、后端接口、权限、FLAT/HYBRID 策略或模型配置。
- 不根据设备、产品、属性名称、日期、页面路径、用户句式、模型或 provider 选择查询或展示分支。
- 不让 `iot-ui` 深层导入 `device-manager-ui` 私有源码；本轮沿用已确认的机械迁移边界，公共内核下沉另立任务。
- 不提交当前工作树中与本批无关的文件，不远程合并任何 PR。

#### 实施步骤

1. 在 `iot-ui` 现有聚合 service/support 上补齐缺口，而非重写：复杂值历史改为升序分页，单页 1,000、全局共享
   10,000 条预算；多属性共享预算，达到上限时返回 `complete=false`、`truncated=true`、`limitReason=records`。
2. 仅对物模型 `GeoPoint + FIRST/LAST` 使用复杂值回退；标量继续走聚合 API。根据已观测时间戳和记录预算细化
   有序路径的有效 interval，并在 summary/evidence 中同时保留 requested/effective interval、原始记录数和桶数。
3. 将原始历史 producer 的物理名称收窄为 `device_property_raw_records`，保持
   `subject.property.history.read → property-history-records`；趋势与位置路径仍只能由
   `subject.property.aggregate → property-aggregate` 交付。这是通用能力边界纠正，不是用户句式映射。
4. 扩展 `iotDevicePropertyAggregateContract` 与 catalog 测试，覆盖对象、JSON 字符串、逗号字符串、数组坐标，
   分页完整/截断、分辨率调整、空结果、详情/领域声明一致性和 `schema.required.undeclared` 守卫。
5. 集中运行 UI 定向测试、公共 client-tool 契约、`vue-tsc`、`iot-ui` 生产构建与 diff 检查；再重启 9101 前端，
   以全新会话验证设备详情自然执行 `device_model_get → device_property_aggregate`，直接交付有正文、业务标题、
   有序 line、横纵缩放和 restore 的 canonical 结果，且不调用原始历史、文件、Dataset 或通用图表工具。
6. 验证通过后：更新并推送 `device-manager-ui` PR #224；创建独立 `cloud.jetlinks.ui` PR；再创建只包含
   `modules/device-manager-ui` 指针的 `saas-runtime-ui` PR。PR 均使用数字化测试证据，不提交或合并无关改动。

#### 风险与待确认点

- `iot-ui` 与 `device-manager-ui` 暂时仍有两份业务适配实现；本批用等价契约测试控制漂移，不在交付阶段扩大为
  跨仓库公共包重构。
- 浏览器验收依赖 9101 已加载新 UI 构建和当前后端；若进程未加载新产物，先报告部署态证据，不用旧会话替代验收。
- `device-manager-ui` PR #224 和新的 `cloud.jetlinks.ui` PR 可以并行评审；`saas-runtime-ui` 指针 PR 依赖前者的
  commit 保持远端可达，但不在本任务中远程合并。

### 12.6 有界摘要完整性修正（实施中）

#### 根因与目标

- 浏览器新会话已证明 `device_property_aggregate` 能完整生成 1,339 条原始记录对应的 33 个有序位置点，
  line、横纵缩放与 restore 均已生效；后端重启或缓存不是本次失败原因。
- 同一轮较早执行的 `device_property_history_summary` 已获得完整 `total`，但把少量代表样本当作分页
  `returnedCount`，因此被共享结果契约判定为 partial，进而污染后续完整聚合产物的终态。
- 本轮从通用契约修正该问题：完整统计结果保持完整记录基数，代表样本只通过不可见的 `modelSample`
  元数据声明；样本上限不再等同于结果截断。

#### 影响范围与不做事项

- owning module 仍为 `modules/iot-ui`；在设备助手共享 service helper 中统一补充 `modelSample` 证据，
  供属性、上下线、日志、告警等摘要共同使用，不改动独立的 `jetlinks-web-core` 子模块。
- 浏览器复测证明完整 presentation producer 后仍可能直接落入“本次可用结果已生成”的后端兜底，因此本阶段扩展
  owning module 到 `modules/jetlinks-ai-agent/ai-agent-general`：当当前轮为空、完整 canonical deliverable 已存在且
  空输出重试预算可用时，必须先执行既有的一次无工具总结轮；只有该轮仍为空或预算耗尽时，才保留产物并使用确定性兜底。
- 为属性历史摘要和原始明细补齐 `notFor` 路由边界，使趋势、分桶统计和地理路径优先交给聚合能力；
  该边界按能力语义声明，不匹配设备、属性、日期、页面或用户句式。
- 完整客户端工具已经直接交付可展示产物时，设备助手优先复用该产物完成回答；只有用户明确要求原始明细、
  逐条核验或额外图表时才继续进入原始记录、Dataset 或通用图表链路，避免完整轨迹之后再重复生成散点图。
- 聚合工具的用户可见名称统一为“属性趋势与轨迹”，不在卡片标题中暴露聚合实现术语。
- 不修改后端缓存、模型配置、FLAT/HYBRID、ECharts renderer、权限或页面布局；不通过隐藏已有 partial
  结果来伪造完成状态。后端增量只调整通用空输出终态分支顺序，复用现有重试预算、无工具投影和总结提示，
  不新增设备、轨迹、属性、日期、页面或用户句式条件。

#### 验证

- 补充中性契约用例：完整记录总数 + 有界模型样本必须为 complete，且记录基数不得降为样本数。
- 校验设备详情属性摘要/原始明细的 `notFor` 与聚合工具 intents 对齐，并回归聚合契约、catalog、类型检查和
  `iot-ui` 构建。
- 使用全新设备详情会话复测同类时间范围轨迹问题：终态必须包含正文和轨迹图，不再出现“当前结果不完整”；
  图表继续保持有序折线、横纵缩放和 restore，且没有未经明确要求的原始明细/第二图表调用。
- 后端契约用例覆盖“完整 presentation + 空模型输出”：第一次进入既有无工具总结轮，第二次仍为空才确定性交付一次产物；
  同时回归无产物空输出、失败结果和普通 evidence fallback，确保不放宽工具重放或事实校验。

### 12.7 统计与有序路径显式契约（已实施，待浏览器复测）

- 企业问数与设备详情的 `device_property_aggregate` 统一要求结构化 `analysisMode`，值域仅为
  `statistics|ordered_path`。统计模式支持 GeoPoint `COUNT/DISTINCT_COUNT`；有序路径仅接受一个 GeoPoint 属性和
  `FIRST/LAST`，输出同 measure 的 longitude/latitude 语义及 producer-guaranteed ordering。
- 参数校验只读取物模型 value type、显式模式和聚合枚举；不读取设备、产品、属性名、日期、页面或用户原文。工具结果仍只
  声明 renderer-neutral binding，是否制图继续由后端统一 presentation advisor 决定。
- 前端验证：属性聚合契约、client-tool catalog、presentation safety 三个独立测试通过；中英文 locale JSON 可解析；
  `pnpm --filter jetlinks-web-core build -- --module-name iot-ui` 成功（8,052 modules）。全工作区 `vue-tsc` 保留 734 行既有
  错误，本批目标文件无错误；`git diff --check` 通过。
- 浏览器验收需在新前后端代码加载后以全新会话执行：先做 GeoPoint 计数统计，再要求有序路径，第二轮必须获取新的有序坐标
  binding 并交付 line option；不得复用第一轮计数图，也不得把“我来检查/我将生成”等过程文本固化为最终正文。

### 12.8 双前端统一交付结果

- `iot-ui` 已完成 `statistics|ordered_path`、独立 raw-record producer、完整性与 model sample 语义、字段语义和
  producer-guaranteed ordering 的统一契约；不按设备、产品、属性名、页面、日期或用户句式选择图形。
- `jetlinks-web-core` 的核心实现提交为 `3ee591bc9acbaa2a4cacd86e5a2d588503a09b1b`（PR #98），只交付
  renderer-neutral 结果；`jetlinks-ai-agent-ui` 固定到提交 `76ce6f0398b0e2def07d1bee781f4884797e38b4`
  （PR #40），只校验并渲染 canonical option。运行时父仓库通过 PR #22 引用同一个 agent-ui 提交。
- `agentConversationVisualizationSafety`、`clientToolCatalogCoverage`、`iotDevicePropertyAggregateContract`
  三组定向契约测试通过；`iot-ui` 生产构建完成 8,052 个模块转换，只有仓库既有 warning。
- `device-manager-ui` 已同步统一后的属性分析、时间范围与聚合契约，提交为 `4885159`（PR #224）；
  `pnpm run test:agent-tools` 共 19 项通过、0 项失败，且未引入设备、产品、属性名、固定日期、页面路径或模型/provider 特调。
- 运营端核心实现提交：`66d54c17`；Pull Request：`https://github.com/jetlinks-v2/cloud.jetlinks.ui/pull/390`。

### 12.9 稀疏聚合与多轮交付契约优化计划（已实施，待发布验收）

#### 当前结论与 owning module

- 长时间范围按细粒度聚合时，后端接口可能返回大量全空时间桶；当前 `iot-ui` 把它们原样放入 `data`，随后
  `jetlinks-web-core` result guard 因超过 64 KiB 将完整结果压成 partial。后续轮出现 PDF 不是卡片 renderer 错误，而是 general-agent 没有把
  当前图表请求、当前任务资源和文件导出区分为不可替代的交付契约。
- 前端主责为 `modules/iot-ui` 的 `devicePropertyAggregate.support.ts`、设备详情 aggregate service/tool 与契约测试；共享 typed result 主责为
  `jetlinks-web-core/src/layout/components/AiChat/clientToolResult.ts`、`clientToolDefinition.ts` 与 `domainAgentTools.ts`。告警和视觉搜索的
  typed DomainAgent wrapper 同步改用同一共享 adapter，不改变各自 output definition 或业务数据。后端主计划见
  `modules/jetlinks-ai-agent/docs/plans/general-agent.md`
  的 9.24.12 节。
- 本批不修改 `runtime-ui`、页面布局、ECharts 公共 renderer、设备查询接口、权限或模型配置；不提高 result guard 上限，也不按设备、属性、日期、
  页面、用户句式、模型/provider 或工具 ID 分支。

#### 前端契约与实施步骤

1. 聚合 producer 在输出 binding 前移除所有 measure 均缺失的空桶，保留合法零值，并显式返回 requested/effective interval、
   `bucketCount`、`populatedBucketCount`、`measurementCount`、实际 `recordCount`、observed range 与 complete/truncated；
   `samplingSemantics=observed_only` 和可推导的 missing bucket 作为 summary/facts 诊断信息返回。省略空桶不等于补零，也不改变查询完整性。
2. `claims` 只暴露真实用户事实；理论桶容量、诊断计数和 model sample 不自动成为样本结论。字段 claim 绑定 output binding 的
   measure/statistic/unit，未查询的维度不生成 claim。
3. shared result guard 保持现有预算：被裁剪的 inline binding 必须 partial；只有 producer 给出完整 typed external ref 时可保留 complete。
   guard 压缩后仍保留 canonical 计数、binding、claims 和通用 recovery/limit reason，不猜文件存储、不自动导出文档。
4. 工具 routing/output 继续只声明 renderer-neutral aggregate shape 与字段语义；图表/文件意图、task lineage 和历史资源选择由
   `ai-agent-general` 的统一契约完成，`iot-ui` 不识别“图表展示”等自然语言。
5. 阶段完成后集中运行 contract/catalog/presentation safety、shared client-tool guard 测试、类型检查与 `iot-ui` 生产构建；再加载新前后端，使用
   全新会话执行稀疏细粒度分析、简短图表续问和明确 PDF 导出。

#### 验收、风险与非目标

- 代表性边界用例使用 44,640 个理论桶、33 个非空桶：传输 33 条且保持 complete，serialized result 小于当前预算；全空、多属性、零值、缺失首尾、
  原查询 partial 和真正 oversized inline 分别断言。
- 图表轮必须交付当前任务的 ECharts presentation，不能用 PDF 满足；明确导出轮仍生成包含所选 canonical 图表的真实 PDF。较老图表和较新的 partial
  结果并存时不得回退旧图；多候选不得由 runtime 猜测。
- 稀疏化的主要风险是折线可能让缺失区间看似连续，因此 evidence 必须保留 sampling semantics/缺失桶数量，标题或正文按统一 presentation policy
  披露稀疏性；若必须修改公共 renderer 才能正确表达间断，先扩展计划并重新确认。
- 不新增第二套数据集协议，不把大结果变成 Base64/临时 PDF，不复制修改到 `runtime-ui` 或 `device-manager-ui`。若后续确认共享 producer 也存在同类
  问题，再以同一 typed contract 单独同步，不在本批无证据扩散改动。

#### 实施与验证结果

- `iot-ui` 聚合 producer 已在 transport 边界移除全空桶，保留合法 `0`、`false` 与空分类值，并分别投影理论桶、非空桶、有效测量和缺失桶数量；
  `samplingSemantics=observed_only` 明确省略空桶不代表补零或连续采样。
- 最终契约收敛为“definition 声明逻辑输出，typed result 只返回执行事实，shared adapter 生成 canonical evidence”：
  `aggregate-series` cardinality 只保留 bucket/populated/measurement 三个通用计数；可推导的 missing bucket 和
  `observed_only` 采样说明继续放在业务 summary/facts，不扩张共享 cardinality。
- `clientToolResult.success/partial` 通用携带 cardinality、claims 与 absence authority；adapter 将其写入最终 evidence，
  并仅在实际输出唯一时从 definition 自动补齐 claim binding。多输出不猜 binding，未声明或有歧义的 claim fail closed。
- user claim 只提供 statistic/unit 等执行事实，不再硬编码 `property-aggregate`；最终 output binding 的 name、shape、path、
  fields、ordering 与 record count 由 typed definition/result adapter 合成。带完整 typed external ref 的 oversized 结果保持
  complete，普通 inline 截断仍按既有 guard 降级为 partial。
- 复合分析增量保持静态 binding name/shape 不变，执行时 label 只根据 producer 声明的字段 label、semantic role、measure、
  aggregation 与 ordering 生成；value/count/ordered-path 使用不同标签。`requestedRange` / `observedRange` 在 inline、record stream
  和文件交付后继续保留到 binding，交付方式不改变后端目标覆盖判断。
- 前端定向契约覆盖 44,640 个理论桶/33 个非空桶、合法零值、typed claim、cardinality、partial 与 external-ref guard；
  Web Core 53 项 client-tool 契约测试和专用 typecheck 通过，设备完整 runtime、cardinality、aggregate、routing、assistant-blocks
  focused specs 通过；`iot-ui` production build 完成 8,082 个模块转换，仅保留仓库既有 Rollup、chunk 与 CSS warning。
  发布后仍需以全新会话完成“稀疏分析 → 会话内图表 → 明确 PDF 导出”验收。
- 父仓库稀疏 producer 提交：`56ad4b0b59b11bdd2ec0830e9e18e1f24bcea0d4`；typed adapter 优化提交：
  `cfd9fd9d5df04f95a1b0fa3e1d7d8c884d8da07a`；复合分析实现提交：`7ab6f8b061cc4cd42bb87b77f865338a10f32227`；
  Pull Request：`https://github.com/jetlinks-v2/cloud.jetlinks.ui/pull/394`。共享 Web Core 实现提交
  `4b672a286f812f9dcb142b85d76622072621c44e`，当前引用 `aa3f0562216bf4c0e84620cfd08efac8793f6c12`
  （PR `https://github.com/jetlinks-v2/jetlinks-web-core/pull/99`）；Agent UI 提交 `937b72c38396b345d2d23ed44b586d4bc9ed2ccd`
  （PR `https://github.com/jetlinks-v2/jetlinks-ai-agent-ui/pull/42`）；配套后端 PR：
  `https://github.com/jetlinks-v2/jetlinks-ai-agent/pull/114`。
