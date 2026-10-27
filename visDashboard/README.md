# 仪表盘设备地图

`DeviceManagement/DeviceMapCard` 是设备地图的画布组件，保留 `deviceMapCard` 类型与现有配置。遵循 `runtime-ui/AGENTS.md`：展示组件只消费 props/emits，状态和生命周期放 hooks，连接与数据转换放 services；单个 Vue 文件不超过 300 行。文案统一维护于本模块 `locales/lang/{zh,en}.json`。

## 请求凭证

`DeviceManagement/services/deviceMap.ts` 与模块内 `views/device/DashBoard/components/Amap.vue` 的 GeoJSON SSE 请求统一通过 `@jetlinks-web/utils` 的 `getToken()` 获取凭证。项目环境按当前项目读取 `project_<项目编码>.token`，独立部署读取全局 Token，避免直接读取 `LocalStore.get(TOKEN_KEY)` 导致项目凭证为空或误用残留的全局凭证。范围仅限这两处读取及现有测试 mock；接口、查询参数、项目会话结构和地图交互沿用现有行为。

验证：模块目录执行 `node --test tests/deviceMapCluster.test.mjs tests/dashboardRuntime.test.mjs tests/deviceLocationGeoContract.test.mjs`，24/24 通过。使用已安装工具库的真实存储实现和模拟 localStorage，执行 service 与编译后的 Amap 组件，覆盖项目会话没有全局凭证、存在残留全局凭证、不同项目、独立部署及根入口，10/10 通过；Amap 脚本与模板编译、差异空白检查通过。工作区与模块无 lint 脚本。在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json`，修改前后均被 `views/device/Product/ResourcePackage/index.vue:187` 与 `views/link/Certificate/type.d.ts:2` 两处原有 TS1005 语法错误阻断，输出完全一致，修复后需重跑。本次未运行完整生产构建，待执行 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui`；真实项目页面与后端尚未联调，需刷新地图确认请求携带当前项目凭证。

## 位置流空结果

已确认现象：用户补齐地图查询权限后，`GET /geo/object/device/_search/geo.json` 返回 200、响应为空，页面仍显示加载失败。后端查询是有限事件流，无位置记录时不发送消息即正常结束；当前 `event-source-polyfill` 将正常 EOF 与传输失败都通知到 `onerror`，原 Hook 未区分完成和失败。

已确认交互：底图只按高德 JS API Key（`amap.apiKey`）和密钥（`amap.secretKey`）是否配置决定挂载；缺少任一项（含空白）时提示前往“系统设置 → 基础配置 → 地图配置”完成配置，取消社区版对底图的限制。复用高德容器实际使用的这两项，不依赖 Web 服务 Key（`webKey`）。配置齐全后底图先加载，不等待设备位置，也不因点位为空或取数失败而卸载。点位数组仅控制设备标记；运行态空结果只显示底图，移除“暂无设备位置信息”提示，请求失败仍在地图上方提示并可重试。编辑态保留“运行时展示设备位置”的说明。

实现：`DeviceManagement/DeviceMapCard/DeviceMapCard.vue` 将底图挂载条件与点位状态分离，复用原有高德容器与 Ant Design 提示；`services/deviceMap.ts` 根据已成功打开的 SSE 连接及结束事件中是否携带真实错误，区分完成与失败，并关闭本次连接防止库自动重连；`hooks/useDeviceMap.ts` 在正常完成时结束加载并保留空结果。保留 403、错误响应类型及网络异常的失败态，不修改接口、权限或点位数据。

容器高度修复（S 级）：真实资源中心页面中地图已初始化，但正文高度为 441px 时，Spin 外层、内容层与高德容器均为 0px。Ant Design Vue 的 `class` 传给转圈元素，嵌套内容外层只接收 `wrapperClassName`；原本设置高度的 `.device-map-card__spin` 未出现在外层 DOM。仅将地图 SFC 的类绑定改为 `wrapper-class-name`，沿用既有 100% 高度样式与正文最小高度，不调整画布、配置和点位逻辑。真实 `http://localhost:9200/#/resources/dashboard` 热更新及重新加载均验证通过：Spin 外层、内容层、高德容器和瓦片画布均恢复为 441px，高德底图正常显示，地图正文不溢出卡片。移除运行态空数据提示后再次打开页面复验，高德容器仍为 441px，提示条数量为 0，仅显示底图。

验证：`node --test tests/deviceMapCluster.test.mjs tests/dashboardRuntime.test.mjs tests/deviceLocationGeoContract.test.mjs` 在移除运行态空数据提示后重新运行，24/24 通过。新增用例先复现空流误报及无点位不挂载底图，再验证修复；使用工作区真实 `event-source-polyfill` 与 HTTP Response 复现空流完成、有点位完成、403/500、响应类型错误及连接失败，读取异常由 reader 替身注入。真实 Vue Hook 覆盖空结果、失败后重试及连接/重连定时器清理；编译真实地图 SFC 并挂载，验证社区版配置齐全时立即挂载，加载中、无数据和请求错误时地图持续存在，点位变化仅影响标记，运行态空结果与清空点位均不显示提示条。配置缺失、缺少任一项或值为空白等 8 种情况均仅显示配置引导且禁用取数；补齐后恢复地图，没有 Web 服务 Key 仍可挂载。中英文地图词条 30 个键一致，加载和失败文案明确指向设备位置。SFC 测试中的高德容器和图层为替身；空数据底图已通过上述真实页面复验，非空真实点位、聚合及设备详情尚待联调。

质量检查：容器修复后地图 SFC 的脚本、模板及两段 Less 样式重新编译通过，组件共 204 行，`git diff --check` 通过。沿用本轮逻辑修复的定向 `vue-tsc` 证据：以地图 SFC、Hook 和 service 为入口，依赖链有 163 项诊断，三个改动入口无诊断；完整类型检查仍未通过。后续仅调整模板的 Spin 外层类属性、空数据提示显示条件及一条样式注释，未重复执行类型检查或完整生产构建，工作区及模块无 lint 脚本；后续可在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p modules/device-manager-ui/tsconfig.json` 与 `pnpm -F jetlinks-web-core build -- --module-name device-manager-ui`。本轮修复尚未提交或推送。

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
