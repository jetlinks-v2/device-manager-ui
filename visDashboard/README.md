# 仪表盘设备地图

`DeviceManagement/DeviceMapCard` 是设备地图的画布组件，保留 `deviceMapCard` 类型与现有配置。遵循 `runtime-ui/AGENTS.md`：展示组件只消费 props/emits，状态和生命周期放 hooks，连接与数据转换放 services；单个 Vue 文件不超过 300 行。文案统一维护于本模块 `locales/lang/{zh,en}.json`。

## 聚合卡片

- 行为：点击普通聚合点继续放大；同坐标或达到地图最高层级（20）仍聚合时展示设备卡片，单设备点打开详情。聚合在最高层级保持启用，避免重叠设备被拆成无法点击的单点。底部文案为 `{count}台设备位置太近，无法继续展开`，不根据坐标推断房间。
- 交互：卡片支持名称/ID 搜索、分页、关闭、设备详情、失败重试和语言切换。长列表在卡片内滚动，底部提示保持可见；编辑态停止请求，关闭/卸载取消状态和详情请求。自动刷新位置时关闭旧卡片，避免继续操作已失效的位置快照。
- 数据：GeoJSON 的 `properties.objectId` 映射为 `deviceId`，同名同坐标设备分别保留，同设备的后续点位更新覆盖旧值。复用现有设备状态/详情服务，每页最多渲染和查询 10 台，详情按需读取。坐标不提供房间、楼层或告警事实，不生成这些数据。
- 边界：仅修改运行时设备模块，不调整后端接口或其他地图入口；这次不改造为 50 万设备的服务端空间聚合。现有全量 GeoJSON 加载仍需单独优化和压测。

## 实现入口

- `DeviceManagement/DeviceMapCard/DeviceMapCard.vue`：原画布组件，类型/注册入口不变。
- `DeviceManagement/DeviceMapCard/DeviceMapSelectionCard.vue`：仅消费 props/emits 的 Ant Design 展示卡片。
- `DeviceManagement/hooks/useDeviceMap.ts`、`useDeviceMapSelection.ts`：位置流、聚合选择、分页、竞态取消与生命周期。
- `DeviceManagement/DeviceMapCard/{cluster,markers}.ts`：聚合终点规则和安全的 DOM 标记渲染；设备名称通过 `textContent` 写入。
- `DeviceManagement/services/deviceMap.ts`：GeoJSON 身份与坐标归一化；状态和详情复用 `dataCapabilities/deviceInstanceMonitoring.service.ts`。

## 验证与边界

- 在模块目录运行 `node --test tests/deviceMapCluster.test.mjs tests/dashboardRuntime.test.mjs tests/deviceLocationGeoContract.test.mjs`，14 项通过。覆盖同名同坐标、Bounds 顺序与放大、最高层级卡片、分页/搜索、失败重试、过期请求、编辑态、卸载及中英文插值。50 万条模拟聚合的检查仅验证卡片计数与每页 10 行/10 台状态请求的边界，不代表真实地图性能。
- 真实 Vue SFC 与 Ant Design 的隔离 Vite 构建、Chrome 交互验证通过：卡片搜索/空态、分页、详情/返回、语言切换、失败重试、关闭/编辑态、小尺寸卡片边界及底部提示。高德事件、位置流和设备接口使用测试替身，真实地图与权限接口仍需联调。
- 30 个中英文词条键一致，改动文件的 Prettier 格式检查及 `git diff --check` 通过；三个相关 Vue 文件均不超过 300 行。工作区未提供可运行的 ESLint 脚本，本次没有独立 lint 通过结论。
- 整模块 `vue-tsc` 被既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断；收窄到地图入口后的检查仍有共享依赖类型错误，未报告本次改动文件的类型错误。待在 `runtime-ui/` 修复既有问题后运行 `pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json`。未运行完整模块构建，待执行 `pnpm --filter jetlinks-web-core build -- --module-name device-manager-ui`。
