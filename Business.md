# 物联业务说明

本文件用于记录 `iot-ui` 的业务边界与页面入口说明。当前模块以设备运营为主，覆盖设备总览、设备分组、设备列表、设备详情和设备健康分析。

## 最近变更

### 设备告警自定义通知内容（已实现）

- 目标：在设备告警编辑弹窗的通知配置中支持“平台默认内容 / 自定义内容”切换；自定义内容只作用于当前设备、当前属性的告警配置，并作为统一 `${message}` 发送给站内信及已选通知渠道。
- 影响范围与 owning module：仅修改 `ui/modules/iot-ui`，主要入口为 `views/device/alarm/components/DeviceAlarmNotificationConfig.vue`、`views/device/alarm/components/DeviceAlarmMessageTemplateConfig.vue`、`views/device/alarm/utils.ts` 以及中英文语言资源；设备详情告警配置与告警配置管理页继续复用同一编辑器。后端 `device-manager` 已支持 `parameters.template.message` 渲染，本次不新增接口、数据库字段或发送链路。
- 不做：不修改通知中心平台模板；不为邮件标题、短信模板编码或不同渠道分别建立设备级模板；不改变告警触发、首次告警判断和通知对象/渠道选择规则；不调整页面壳层、列表或详情信息架构。
- 实现入口：通知配置在设备级告警下提供内容模式切换，支持 `targetName`、`alarmConfigName`、`propertyName`、`propertyValue`、`level`、`alarmTime` 变量的光标位置插入与示例预览。自定义内容保存到 `parameters.template.message`；切回默认时仅移除根消息模板字段，保留各通道的 `templateId`、`notifierId` 等参数。两个保存入口都校验自定义内容不为空且最长 1024 字符。
- 风险与兼容：存量配置没有 `parameters.template.message` 时继续使用后端默认消息；平台外部渠道模板必须引用 `${message}` 才能展示设备级内容；设备级配置优先于产品级配置，编辑产品继承项时仍按现有逻辑生成设备级覆盖。
- 验证：中英文 JSON 语法校验通过；基于真实 `buildPreprocessPayload` 的静态请求校验已确认自定义内容保存/回显、切回默认和通道参数保留；使用 Node 22 执行 `pnpm --filter jetlinks-web-core build -- --module-name iot-ui` 通过（7911 个模块，退出码 0）。新增消息编辑组件 148 行，复用的通知配置组件 188 行；`IotDeviceAlarmConfigTab.vue` 与 `useDeviceAlarmPage.ts` 为已有超 300 行文件，本次仅窄范围接入校验并清理未接通的模板通道残留。实际外发联调仍需确认平台邮件等模板已引用 `${message}`。
- 交付：commit `a34049e6fb626b01c2b4fe6d048d302a833f3f8c`；Pull Request `https://github.com/jetlinks-v2/cloud.jetlinks.ui/pull/318`。

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
