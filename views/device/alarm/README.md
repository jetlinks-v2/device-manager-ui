# 物联告警规则与记录工作区

## 右侧记录卡改用 CardBox

- 目标：`DeviceAlarmRecordCard.vue` 的骨架由 `EntityCard` 换成 `jetlinks-web-core` 的 `CardBox`，对齐用户提供的记录卡截图。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui/views/device/alarm/components/DeviceAlarmRecordCard.vue`；不改 CardBox 源码、不改 `index.vue`、不改查询/分页/hook、不改接口与 i18n。
- 为什么是 CardBox：截图里的两条特征就是 CardBox 的内置行为，不是需要另写的装饰——左上角状态色渐变条来自 `.card-top-line`（`linear-gradient(90deg, var(--card-status-color-solid), var(--card-status-color))`），右上角浅色斜角状态位来自 `.card-state-row` + `.card-state`（`clip-path` 斜角）；`getHexColor(code, pe = 0.1)` 默认返回 `rgba(...,0.1)`，正好是截图里的浅色斜角，传 `1` 就是那条实心色条。
- 组装方式：`status` / `status-text` / `status-names` 走内置状态位（`statusNames = { warning: 'error' }`，其余状态由 `getHexColor` 回退灰色）；`#content` 放「标题 + 等级 StatusTag + 2×2 字段网格」；`#bottom-tool` 放「告警日志 / 处理记录 + 告警处理」。`--panel-padding: 1.25rem` 复用 CardBox 自带的内边距变量。
- 需要注意的 CardBox 行为（已在消费侧处理，未改 core）：默认 `contentList` 是单行等分 `a-col`，做不出截图的 2×2，因此走 `#content` 插槽；不传 `#img` 时 `.card-content-main` 的 flex `gap` 会留下空位，用 `display:none` 去掉空头像位；`.card-warp` 恒定 `cursor: pointer`，记录卡不可点，覆盖为 `default`；`#bottom-tool` 渲染在 `.card-warp` 之外，底栏自带 padding 与上边框；`statusText` 默认是硬编码 key，必须显式传。
- 保留的行为：四个字段仍是快照字段（告警设备 / 最近告警时间 / 告警原因 / 持续时长），`canHandleRecord` 继续控制「告警处理」禁用；卡片改为 flex 列布局，双列网格下底栏贴底等高。
- 文案：沿用现有语义（`最近告警时间` / `告警处理`），未照搬截图里的「告警时长」（其值是时间戳，语义不自洽）与「处理告警」。
- 验证：`node scripts/test-alarm-workspace.mjs` 8 项通过；`pnpm run build:modules device-manager-ui` 通过。用构建产物 `dist/assets/style.*.css` 直接渲染手写 DOM fixture（带真实 `data-v-*` scope）并截图，核对顶部色条、右上斜角状态位、标题+等级、2×2 字段与底栏按钮的位置与配色。
- 未验证：无登录环境，未在真实应用里确认 antd 运行时样式、`j-badge-status` 与 `j-ellipsis` 的实际渲染；fixture 里的 antd 基础样式是静态近似（antd v5 为运行时 CSS-in-JS）。

## 左侧规则列表高保真还原与滚动加载

- 目标：按用户提供的高保真截图重做 `/alarms/rules/iot` 左侧规则列表，页脚分页改为滚动到底自动加载下一页，“新增告警”从标题行移到列表底部通栏按钮。
- 影响范围与 owning module：仅 `runtime-ui/modules/device-manager-ui`，落点 `views/device/alarm/{index.vue,components/DeviceAlarmRuleCard.vue,hooks/useDeviceAlarmPage.ts,hooks/useDeviceAlarmWorkspace.ts}` 与 `locales/lang/{zh,en}.json`；不改接口、权限、菜单和右侧告警记录栏。
- 视觉：标题行保留 `DeviceAlarm.workspace.rules` 与 `DeviceAlarm.workspace.total`（“告警规则 共 N 条”，数量超长时省略并保留 title），新增按钮按截图移到列表底部；搜索框圆角与卡片对齐；卡片为白色圆角块 + 蓝色渐变圆形告警灯图标 + 名称 + 单行摘要（Tooltip 全文）+ 状态/等级两枚 StatusTag，右上角 ⋮ 菜单承载编辑/删除；选中态为蓝色描边 + 主色浅底。
- 图标：截图造型为“警灯”（穹顶 + 底座 + 五道光束），Ant Design 与仓库 iconfont 均无对应字形，因此在 `DeviceAlarmRuleCard.vue` 内联固定 SVG；⋮ 复用 `MoreOutlined` 旋转 90°。
- 滚动加载：`useDeviceAlarmPage` 拆出 `fetchRulePage`，`tableRequest` 仍为替换语义，新增 `appendRulePage`（追加下一页，按稳定 key 去重）与 `reloadRuleRange`（编辑/删除后重取已加载 0..N 页，保留滚动深度）。`useDeviceAlarmWorkspace` 新增 `loadingMore`/`loadMoreError`/`hasMore` 与 `loadMore()`；服务端返回空页时置 `exhausted` 立即停止，避免偏移分页在总数不一致时反复请求。
- 状态隔离：`searchKey`（搜索/首次加载，回到第一页）与 `reloadKey`（编辑/删除，保留范围）分成两个信号，替代原 `tableParams`。告警数量改为增量合并（`mergeCounts` 只保留当前列表仍显示的规则），追加页的并发结果不会被更早的全量结果抹掉；失败仍显示“状态未知”而不是 0。
- 删除确认：删除动作由卡片菜单直接 emit，确认交给页面 `Modal.confirm`（复用 `DeviceAlarm.confirm.delete`），保持卡片为无副作用展示组件。
- 明确不做：不改右侧告警记录栏及其分页、不改接口契约、不新增后端能力、不改 `ui/`。
- 与截图的有意差异：搜索占位仍为语义正确的 `DeviceAlarm.workspace.keywordSearch`（“搜索产品、设备或属性标识”），未照搬原型里属于视觉告警页的“搜索建筑、楼层或区域”；状态文案沿用既有 `告警中 {count}`，未改成原型的“告警 N”；摘要沿用 `ruleSummary` 真实内容而非原型里的产品名。
- 验证：`node scripts/test-alarm-workspace.mjs` 8 项通过；`pnpm run build:modules device-manager-ui` 通过（仅既有资源路径/chunk 体积警告）。另用与 `DeviceAlarmRuleCard.vue`、`StatusTag/index.vue` 逐行同源的 CSS 在 340px 侧栏宽度渲染静态 fixture 并用 Chrome 截图，核对标题、搜索、卡片、选中态、标签、⋮ 与底部新增按钮的位置与配色。
- 未验证：无登录环境，未做真实数据下的滚动加载、删除确认、增量数量合并联调；模块级 `vue-tsc` 仍受既有 `views/link/Certificate/type.d.ts:2` 语法错误阻断。

## 规则关键词搜索

交付入口：[前端 PR #275](https://github.com/jetlinks-v2/device-manager-ui/pull/275)。

- 左侧保留 a-input-search，提示“搜索产品、设备或属性标识”，不再显示字段/运算符/条件标签。沿用视觉告警搜索控件和当前标题布局，右侧继续使用 ConditionFilter。
- `hooks/useDeviceAlarmRuleSearch.ts` 区分输入草稿与已提交文本，回车/搜索提交，清空恢复全部规则，重复提交相同值不重复请求；提交时规则分页回到第一页，不改变已选规则或右侧搜索。
- `hooks/useDeviceAlarmRuleSearch.ts` 将一个关键词组合成三项 OR 条件：`templateId/product-info` 内的产品 `name like`、`thingId/dev-instance` 内的设备 `name like`、`property like`。`hooks/useDeviceAlarmPage.ts` 保持整个搜索组与附加条件隔离，继续使用现有分页接口 `POST /message/preprocessor/device-alarm/_query`；不发送虚拟 keyword，不新增后端条件或数据库专用查询。
- 复用共享 escapeLikeValue 对百分号和反斜杠的转义，补充下划线字面匹配，不重复编码。范围沿用原筛选器的产品名称、设备名称、属性标识；配置 JSON 中的告警名称与通知文本不属于该搜索范围。后端保留通用查询与既有资产权限，只需发布 runtime-ui。
- 验证：更新后的 `node scripts/test-alarm-workspace.mjs` 8项测试与 `pnpm run build:modules device-manager-ui` 通过；真实前端 hook 输出交由既有 product-info/dev-instance/like 查询组件执行，独立 PostgreSQL 11 临时库10项断言通过，覆盖三字段、中文与通配符、空查询、附加条件隔离、count/list与分页。未使用已撤回的后端关键词类。
- 搜索框与按钮结构未改，复用此前浏览器 fixture 的300/260px宽度、长输入、回车、清空、标题按钮同排与无脚本错误验证。完整登录页面联调仍待执行。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍被既有 Certificate/type.d.ts:2:30 的TS1005阻断；未修改该文件。当前模块无统一lint脚本，diff --check通过。未新增页面组件或跨模块抽象，改动Vue文件不足300行；已有大型useDeviceAlarmPage仅替换搜索职责并抽出独立hook，未扩展其他业务。

## 规则栏局部修复（已确认实施）

- 目标：修复点击编辑时新增按钮触发加载动画的问题；标题与新增按钮同排；移除左侧搜索与规则列表之间的“全部规则”按钮。
- 范围与入口：仅 runtime-ui/modules/device-manager-ui/views/device/alarm/index.vue 及 hooks/useDeviceAlarmWorkspace.ts；用户已确认实施，沿用当前规则筛选与记录处置工作台。
- 根因与修复：index.vue 的新增按钮原使用共享 busy 作为 loading，而编辑、删除、保存同样调用 run 切换 busy。现在 create() 复用 run 的操作互斥，新增加载状态 creating 仅在新增动作期间开启，并在 finally 中复位；其他动作期间新增按钮禁用但不显示加载动画。加号改用按钮 icon 插槽，加载时由组件替换图标。
- 布局：告警规则标题、现有数量与“新增告警”同排；下一行为关键词搜索框，随后直接展示规则卡片。参考 runtime-ui/modules/jetlinks-ai-ui/views/visual-alarm-preview/components/VisualAlarmCategorySidebar.vue 的标题/操作排列，复用现有 Ant Design 按钮、AIcon 及 DeviceAlarm.action.create 文案；不引入视觉告警业务逻辑。
  ```text
  告警规则 共 N 条     [+ 新增告警] | 告警记录
  [筛选规则                   ] | [记录搜索]
  [规则卡片                   ] | 查询范围 [已选规则 ×]
  ```
- 保持紧凑规则卡、状态与等级位置、原编辑弹窗及双栏布局；不改 ui、后端、接口、权限和时长计算。
- 实现：已分离新增加载状态并保留重复点击保护；标题、数量和按钮同排，数量过长时省略并保留 title；已删除左侧全部入口及废弃样式。未新增组件或跨模块抽象，模板无新增复杂业务逻辑，状态隔离原因已在 hook 注释。
- 验证：node scripts/test-alarm-workspace.mjs 的 7 项测试通过，包括规则范围切换保留记录搜索。另用真实 useDeviceAlarmWorkspace 与 Vue renderer、模拟页面异步依赖核验：编辑/删除/保存不触发 creating，新增期间重复点击和其他操作被拦截，失败后 busy/creating 均复位。git diff --check 通过；index.vue 共149行；按钮复用键的中英文解析正常。
- 构建：runtime-ui 下 pnpm run build:modules device-manager-ui 通过；存在资源路径与 chunk 体积等已有警告。
- 验证限制：pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json 被既有 views/link/Certificate/type.d.ts:2:30 的 TS1005 阻断；模块暂无统一 lint 脚本。未进行登录页面的浏览器验证，仍需核验真实页面编辑前后按钮位置、标题/按钮同排与窄屏无溢出，以及关闭右侧规则标签后返回全部记录。

## 已确认方案与实施边界
用户已确认最新 HTML 原型并授权生产实现。本次为 runtime-ui 单模块页面改造，入口仍为 /alarms/rules/iot，componentCode 为 device/alarm。

采用规则筛选与记录处置工作台：
```
告警规则 数量 新增  | 告警记录
规则搜索           | 记录独立搜索 / 当前规则范围 / 返回全部
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
