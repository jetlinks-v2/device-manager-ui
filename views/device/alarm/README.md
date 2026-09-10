# 物联告警规则与记录工作区

## 已确认方案与实施边界
用户已确认最新 HTML 原型并授权生产实现。本次为 runtime-ui 单模块页面改造，入口仍为 /alarms/rules/iot，componentCode 为 device/alarm。

采用规则筛选与记录处置工作台：
```
规则搜索 + 新增     | 记录独立搜索
全部规则           | 当前规则范围 / 返回全部
名称 状态数量 等级  | 名称 等级 状态
产品设备阈值摘要…   | 设备 / 最近告警时间 / 持续时长 / 原因
编辑 删除          | 告警处理 / 告警日志 / 处理记录
规则分页           | 记录分页
```

- 默认查询全部设备属性预处理告警；点击规则按稳定 alarmConfigId 过滤。两边搜索、分页彼此独立，规则搜索不自动选中首条或清除右侧范围。
- 左侧摘要合并产品、设备范围和实际区间内/外条件，单行省略，Tooltip全文；状态及数量在等级左侧。数量来自当前页规则的服务端 COUNT 聚合，失败显示未知，不能把失败当成0。
- 右侧宽屏双列卡片，记录区域不超过760px时单列，状态优先，无统计面板与彩色侧条。独立 ConditionFilter，过滤字段只使用真实记录字段。
- 编辑梯度：规则新增/编辑沿用原720px弹窗与34.75rem表单，条件配置需要完整校验；记录处理就近打开说明弹窗，直接填写并确认。历史按recordId分页，在弹窗展示。
- 处理后重新查询服务端记录和规则数量；不乐观删除记录，normal状态仍保留历史。切换查询与弹窗时作竞态保护。
- 不新增后端接口，不改ui，不增加启停、还原配置、批量、视频或AI。历史快照不能用当前规则覆盖。

## 分解与复用
- index.vue：页面组合及两栏布局；DeviceAlarmRuleCard.vue：紧凑规则摘要；新增 DeviceAlarmRecordCard.vue：复用 EntityCard / StatusTag / AIcon / j-ellipsis 展示卡片。
- hooks/useDeviceAlarmWorkspace.ts：规则选择、分页加载、当前页状态汇总；保留 useDeviceAlarmPage.ts 的查询构造和完整编辑逻辑。
- hooks/useDeviceAlarmHistory.ts：仅记录历史查询；新增 hooks/useDeviceAlarmRecords.ts：记录独立筛选与分页；新增 hooks/useDeviceAlarmHandling.ts：表单提交状态；新增 DeviceAlarmHandleModal.vue：无请求的表单展示。
- workspaceApi.ts / workspaceTypes.ts / workspaceUtils.ts：接口、真实字段和展示转换；中英文文案与菜单权限在本模块维护。
- 核验了 jetlinks-web-core 的 EntityCard、SelectableListCard、StatusTag 导出与实现，复用 EntityCard 插槽组合。规则卡继续现有独立选择按钮，避免把嵌套操作放进整块键盘点击的 SelectableListCard。
- 目录已有 components、hooks、API/types 的职责边界，继续归入这些目录，不新增跨模块深引用。

## 接口与权限
- POST /message/preprocessor/device-alarm/_query：规则搜索，保留产品/设备/属性字段。
- POST /alarm/record/device/_query：固定 alarmConfigSource=device-property-preprocessor，可选 alarmConfigId，服务端分页。
- POST /alarm/record/device/_aggregation：仅当前页规则ID、warning状态，按alarmConfigId分组COUNT。
- POST /alarm/history/alarm-record/{recordId}/_query：告警日志。
- POST /alarm/record/{recordId}/handle-history/_query：处理记录。
- POST /alarm/record/device/_handle：复用 handlePreconditioning，参数 alarmRecordId / alarmConfigId / alarmTime / describe / type=user / state=normal。2.12控制器此方法为SaveAction，需要alarm-record:save；在使用此页面的菜单中补充该既有权限。
- GET /alarm/config/default/level：原等级配置。EnumDict显示text，业务比较value；normal不等同本地虚构handled状态。

## 验证范围
接口契约测试覆盖来源与规则范围、搜索隔离、按记录处理、历史分页隔离、聚合COUNT、空ID与错误响应、过期请求；结合模块构建、针对性类型检查、diff --check、真实Vue组件fixture浏览器检查。全模块vue-tsc被views/link/Certificate/type.d.ts既有语法错误阻断。登录环境联调仍需验证真实权限和数据；原型截图不充当生产验证。

## 本次验证结果

- `node scripts/test-alarm-workspace.mjs`：7项通过，覆盖真实ConditionFilter查询构造、单次通配符编码、规则范围、默认全部、按记录处理与历史路由、聚合数量及失败处理、过期响应。
- `pnpm run build:modules device-manager-ui`：最终构建通过；存在已有资源路径、Rollup output.input、CSS注释和chunk体积警告。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`：仍被既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断。告警目录定向vue-tsc中本目录无诊断；依赖展开仍有共享代码类型错误，未宣称全模块类型检查通过。
- 本模块没有统一lint脚本；`git diff --check`通过。所有新增/修改Vue组件不超过300行。现有大型useDeviceAlarmPage仅修正搜索接收逻辑，不进行无关重构。
- 浏览器使用真实index.vue、规则卡、EntityCard记录卡、处理弹窗、历史组件、原编辑弹窗和FullPage，业务接口由fixture替代：默认全部、规则选择、摘要Tooltip、必填说明、按记录处理、处理历史隔离、编辑720px、1920/1327/390px视口与无脚本错误检查通过。
- 额外装配真实ConditionFilter并用浏览器操作搜索：右侧名称查询、与规则范围AND组合、返回全部仍保留搜索，左侧产品搜索不触发右侧请求、通配符只转换一次、桌面与窄屏搜索输入与操作按钮不重叠，均通过。
- 搜索兼容修正：ConditionFilter.change.filter/terms已是服务端条件，右侧直接使用filter；左侧继续从modelValue原始条件构造查询，不再重复转义like通配符。左侧只按容器压缩输入最小宽度并使用简短提示，复用原搜索组件而不改共享源码。
- 仍待登录环境联调：菜单权限同步（两处device/alarm入口均增加alarm-record:save）、真实资产可见性、处理后再次触发、规则删除后的历史、多设备同规则、大数据分页。未调用真实处理接口；此前403不通过前端绕过。

## 记录卡片视觉调整
按用户最新截图改为宽屏双列、窄栏单列；卡片顶部名称与等级、右上状态角标，主体按设备/原因/告警时间/时长纵向排列，底部保留三个真实操作。复用EntityCard、StatusTag与本模块设备图标；只改展示布局，不改变查询、处理与历史接口。验证双列对齐、长文案、状态角标、单列降级和原操作。

卡片调整验证：模块构建通过，diff --check通过；真实Vue组件在1920/1327宽度双列、900/390宽度单列，状态角标对齐、字段顺序、无横向溢出检查通过。告警处理/历史隔离/编辑弹窗等既有浏览器回归通过，无脚本错误。未新增行为测试，沿用既有功能回归。
本次定向类型检查：告警目录无诊断，依赖共享代码仍有既有类型错误；全模块检查限制同上。
