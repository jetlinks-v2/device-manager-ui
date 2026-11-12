# 物联告警规则与记录工作区

## 物模型属性已配置告警提示

- 目标与范围：运行时新增告警选择物模型属性时，清楚说明已配置属性不可选择的原因；仅修改 `components/editor/DeviceAlarmTargetForm.vue` 和本模块中、英、日文资源。
- 实施：复用 `alarmConfigured` 禁用标记，在下拉选项后显示“已配置告警”，并在存在此类选项时通过 Form.Item 的辅助说明提示不可重复选择、可选择其他属性或编辑已有告警；保留原有选择、编辑和保存语义。
- 验证：Node 22.18.0 下执行 `node scripts/test-alarm-workspace.mjs`，原工作区 151/151 通过，迁移至最新远端 `2.20` 后复跑 158/158 通过（临时运行器仅调整依赖定位）；迁移前在运行时根目录执行 `pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 成功，产物含新增文案，仍有资源路径与 chunk 体积等构建提示；`git diff --check` 通过。运行时无独立 lint / 样式门禁脚本。
- 类型检查：迁移前在运行时根目录执行 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，报告 1841 条诊断，涉及模块与共享依赖；本次修改的 `DeviceAlarmTargetForm.vue` 无诊断，全模块类型检查不能视为通过。
- 页面核验：本地临时样例装配真实 TargetForm 与 Ant Select，确认温度禁用并显示“已配置告警”、湿度可选择、全部可选时隐藏辅助说明、编辑只读时隐藏重复配置说明，中英日文切换正常；未连接真实后端，登录环境联调仍待验证。组件共 62 行，保留现有表单结构，无新增组件或公共抽象；不涉及后端接口、权限或运营端。
- 作者 Review：PASS。提示复用现有禁用标记，未扩展公共模型、请求或保存行为。


## 运行时新增 / 编辑弹窗展示优化

- 目标：设备管理员配置单条物联告警时，能清楚识别当前配置项、编辑其内容，并从预览直接返回修改；新增和编辑采用一致布局。采用已确认的 M 级方案，已在运行时实现。
- owning module：`runtime-ui/modules/device-manager-ui`，入口为 `views/device/alarm/index.vue` → `components/DeviceAlarmEditorModal.vue`。本次仅处理运行时，不同步运营端。
- 设计参考：`ui/modules/jetlinks-ai-ui/views/visual-alarm-preview/components/VisualAlarmRuleDialog.vue` 的左栏分区入口、中栏单列等级和右栏可跳转预览。仅复用交互结构，运行时使用自身组件与依赖，不跨前端边界导入私有组件。
- 作者判断 / 开发前检查：源码事实已确认，复用物联告警原模型、表单、资源查询和保存事件；展示职责留在现有 feature 内。Router 路由至 `jetlinks-web-style` 固化结构，再由 `jetlinks-web` 实施，新增文案按 `jetlinks-conventions` 核对。不触发后端设计门禁；按已确认方向实施。

### 方案档案

- 推荐方案：参考视觉告警的“三栏分区配置弹窗”，映射为配置向导的自由分区编辑变体。名称保持左侧常驻；左栏四个等高入口为“告警等级 / 告警对象 / 触发与解除 / 通知配置”；新增和编辑初始展示等级，允许随时切换，保留草稿，最后统一保存。
- 信息密度：左栏只展示名称、分区名与配置状态，中栏每次只展示一个分区，右栏按等级、对象、属性、触发、解除、通知展示紧凑预览。等级使用单列选项、等级色点、完整选中描边和勾选；默认等级及数值语义沿用现有配置，不复制视觉告警的等级颜色映射。
- 编辑梯度与动作：已处于强关联字段的完整编辑弹窗中，分区切换只改变展示；预览的“修改 / 去配置”返回对应中间分区，不新开弹窗。底部固定取消 / 保存，保存期间所有修改入口沿用禁用保护。
- 组件：保留 Ant Modal、Form、Input 和原有 `DeviceAlarmTargetForm`、`DeviceAlarmTriggerForm`、`DeviceAlarmNotificationConfig`；等级优先配置当前 `j-card-select` 的单列呈现。布局面板落地前核验 core 已导出的 `ContentPanel`，选中、状态和提示复用现有组件与主题 token，避免新增公共基础控件。
- 状态锚点：选中导航与配置状态分开表达，完成状态依据真实必填值和原校验规则；通知未启用显示中性“未开启”，不作为必填未完成。尚未选择属性或阈值时，预览给出待配置提示，避免显示 `[-, -]` 等不完整条件。
- 视觉与适配：白色紧凑标题区、统一关闭按钮与面板间距；宽屏中栏为主、右侧预览适当加宽，中窄屏顺序下沉，内部滚动且底部操作保持可见。使用现有圆角、背景、间距与状态 token，不新增渐变、装饰统计区或单侧彩色状态条。
- 搜索层：不新增列表搜索；产品和设备继续使用现有远程选择器。详情承载仍为原弹窗，无新增路由或页面侧栏。
- 不借鉴：视觉告警的事件选择、摄像头、告警时间、算法任务、资源查询和业务保存逻辑。
- 替代方案：仅缩小左侧等级选项并调整间距。虽改动更小，但仍保留左栏信息拥挤与右侧预览无法返回修改的问题，故不推荐。

```text
新增 / 编辑告警                                      关闭
┌ 配置入口 ────┬ 当前配置 ───────────┬ 配置预览 ───────┐
│ 告警名称     │ 告警等级            │ 等级     修改   │
│ 告警等级  ●  │ ○ 超紧急            │ 告警对象 去配置 │
│ 告警对象  ○  │ ○ 紧急              │ 物模型属性      │
│ 触发与解除 ○ │ ● 严重           ✓  │ 触发条件        │
│ 通知配置  ○  │ ○ 一般              │ 自动解除        │
│              │ ○ 提醒              │ 通知配置        │
└──────────────┴─────────────────────┴─────────────────┘
                                             取消  保存
```

### 实现与验证

- 实现入口：`components/DeviceAlarmEditorModal.vue`（211 行）组合四个分区、单列等级和六项预览；`DeviceAlarmEditorModal.less` 负责三栏、局部标题/间距及响应式布局；`components/editor/useDeviceAlarmEditor.ts` 派生导航状态和预览，不发请求或修改保存协议。新增文案同步中、英、日文 `locales/lang/`。
- 状态与边界：复用 `conditions.ts` 和 `utils.ts` 的条件/通知校验；数值 0、布尔 false 均参与正常预览，不完整条件显示“待配置”，未开启通知显示中性状态。保存期间禁用切换、修改、取消和关闭。原有对象/触发解除/通知表单、默认等级、接口字段、资源查询、保存事件、权限、菜单和路由保持既有语义。
- 适配：桌面为左侧 18.75rem / 中间自适应 / 预览 23.75rem；宽度不超过 1200px 时预览下沉，不超过 720px 时单列全屏；底部操作保持可见。标题和内容区的局部选择器兼容当前运行时 Modal 的全局样式。
- 自动验证：运行时目录执行 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs`，158/158 通过；新增覆盖完整性、0/false、冲突解除、通知接收维度、草稿保留、预览去向、保存保护及重新打开。`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 成功（约 10 分钟），产物包含模块入口与 `baseMenu.json`，有大体积 chunk 提示。SFC/LESS 随实际构建编译通过，`git diff --check` 通过。使用 Node 22.18.0；运行时无独立 lint / `check:ui-style` 脚本。
- 类型检查限制：`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 未通过，共 1841 条诊断，涉及模块/共享组件/依赖与测试 Node 类型；本次修改的生产文件无诊断。本次未清理这些全模块类型问题，类型检查不能视为通过。
- 页面验证：使用运行时真实弹窗与子组件的本地临时样例检查新增、编辑回显、预览跳转、切换后保留草稿、阈值 0、保存禁用，以及 1600×900、1000×800、390×844 布局；无横向溢出，底部按钮可见。样例替代了远程人员查询，未连接真实后端，实际保存及通知发送待联调；控制台无运行异常，仅有 Select 弃用提示。
- 作者 Review：PASS。符合分区编辑与原逻辑复用的设计，范围仅运行时物联告警 feature；未修改公共模型、引入跨模块依赖或新增通用抽象，无后端 Reactive 改动；关键展示派生逻辑已覆盖测试。运营端本次修改已撤回。

## 设备详情规则展示与直接编辑

### 未保存离开提示与主动退出

- 属性规则卡片和独立编辑器通过 `views/device/components/PropertyRules/useRuleLeaveConfirmation.ts` 合并并发离开请求，一次待决导航只显示一个所属确认框。取消保留草稿；确认仅放行，不提前删除草稿；销毁时关闭所属弹窗，旧弹窗关闭动画不会干扰新确认。
- 主动退出免提示仅在设备模块实现，无需修改 Core。`useRuleLogoutNavigation.ts` 使用 `@jetlinks-web/core` 公开的 `getInstance()` 在规则作用域存活期间共享一个可释放请求拦截器，只观察现有 GET `/user-token/reset`，在原 JSON 转换之后、Core 的响应处理及退出菜单回调之前，识别 HTTP 2xx 且 `success: true`，或未携带 success 且 `status: 200` 的成功响应。响应原样返回，不改变退出接口、token 清理、跳转目标或其他表单。
- 成功退出后，卡片与独立编辑器关闭所属待决确认框、放行已有导航与后续退出导航，并跳过 beforeunload 提示，保存中也不阻断退出。退出接口失败、普通切页、刷新/关闭及会话失效继续保留原保护。
- 成功抵达 Login 后清理本次标记并作废此前请求；失败导航及中间公开路由不提前清理。最后一个规则作用域销毁时释放请求拦截器与路由监听，迟到响应不影响后续规则作用域。完整页面跳转由新文档重建状态，不新增持久化存储或前端退出入口。
- 验证：实际 Axios 请求/响应转换链与 Vue hooks 回归 188/188 通过，覆盖退出成功/失败/HTTP 错误/网络异常、普通接口、响应与原转换保留、已有弹窗释放、普通导航与卸载保护、共享监听及销毁、迟到响应、登录到达后恢复保护和保存中退出。当前四个生产 hook 按模块 tsconfig 定向语义检查通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（2m51s，保留既有资源路径、循环 chunk、Rollup output 和大 chunk 提示），`git diff --check` 通过；本轮未执行完整宿主构建或全工作区 vue-tsc，模块无独立 lint 脚本。真实后端退出/重新登录联调尚未执行，未实际退出当前账号。
- 交付范围：仅 `runtime-ui/modules/device-manager-ui`；不修改 Core、运营端、后端、权限、持久化或自动保存。退出端点与成功响应形态是本地观察契约，后续调整退出接口时需同步检查该 hook。

### 单位、浮层可读性与通知状态优化（M 级，已实施）

- 物模型单位来源统一（已实施，沿用已确认 Phase 1 单位字典方案）：设备运行页优先展示后端 `formatValue`，物模型只有 `unit: kWattsHour` 时不能直接将标识作为可读符号。规则页读取完整 `valueType`，优先使用返回的 `unitName/unitText/unitLabel`，缺失时复用现有 `api/instance.ts/getUnit` 的 `/protocol/units` 字典 `symbol`；字典未知项、失败及自定义单位保留原值，无单位不占位。字典由页面入口共享一次加载，并发卡片不重复请求，完成后响应式更新。移除页面内置符号替换。影响规则卡头、条件/解除、缺省补齐、摘要与编辑器的既有单位读取，不修改物模型、实时值、后端、权限或保存协议。验证字典加载合并与失败重试、显示名优先、扩展符号、未知单位、百分比差值语义及既有规则回归。
- 单位修复验证：Node 22.18.0 下 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 166/166 通过，包含字典失败后重试、并发合并、异步到达后已渲染标签更新、后端扩展单位、物模型显示名优先与百分比差值语义。实际 9200 设备 `2095759470932828160` 的规则页添加 BLE 信号强度临时卡后，辅助功能树确认卡头显示 `int(整数型) · kW·h`；未保存设备规则。随后会话初始化抛出 `DefaultApplicationEntryError: Default application entry unavailable` 并转到 403，无法继续核验设备数据页或记录有效结果截图；已回到原设备详情 URL，未改动应用/会话配置。
- 单位修复工程验证：终版模块构建通过（3m9s，既有资源路径、循环 chunk、Rollup output 与大 chunk 警告）；`git diff --check` 通过。全模块 `vue-tsc` 仍未通过，包含既有共享 API/测试环境类型诊断；检查发现新增 hook 两处隐式 any 后已补齐接口字段类型，并用当前 tsconfig 与实际 API/Vue 声明执行 TypeScript Compiler API 的定向语义复检，通过。最终类型注解不改变运行行为，复用上述构建；未重复全模块类型检查，模块无独立 lint 脚本。
- 单位修复作者 Review：PASS。使用后端既有 ValueUnit 字典与现有 getUnit API，局部共享缓存没有改变持久化或公共模型；缓存仅保存不按设备/租户过滤的单位注册表，失败可重试且不阻断规则编辑。修改保持运行时 feature 范围，没有后端 Reactive、权限或菜单变更；关键回归已覆盖，环境 403 与真实保存联调限制如上。不提交/推送，不新增 knowledge。
- 其他单位检查（S 级，已完成代码与回归检查）：通过模拟 `/protocol/units` 返回覆盖摄氏/华氏、百分比、功率/电能、电压/电流、电阻、长度、时间、压力、加速度和 kgce 等 14 个单位，与设备运行格式化值的展示拆分函数逐项比较，零值、负值、小数及物模型显示名优先均一致；无单位、自定义文字和未知单位保持预期。修复 `hooks/usePropertyUnits.ts` 过滤掉字典空符号、进而暴露内部 ID 的边界，已注册的 `symbol: ""` 现在正常不展示单位。没有新增前端符号映射或修改后端、物模型、实时值。Node 22.18.0 下现有回归及新增用例 181/181 通过（修复前仅空符号用例失败）；当前 tsconfig 与实际 Vue/API 声明的定向语义检查、`git diff --check` 通过。本轮仅调整字典过滤条件，复用前一轮模块构建，不重复全量 build/vue-tsc；模块无独立 lint 脚本。作者 Review：PASS，公共契约不变，空符号行为有回归。当前 9200 服务无法连接，检查基于模拟字典及当前生产展示函数，真实字典全量与逐单位页面验证仍待服务恢复；未提交或推送。


- 目标：修正用户截图中单位与条件值挤靠、浮层文案过小、关闭通知图标错位和未配置误报已配置四项问题。
- 源码事实与归属：本机 9200 服务工作目录为 `runtime-ui/jetlinks-web-core`，本次 owning module 为 `runtime-ui/modules/device-manager-ui`。入口为 `views/device/components/PropertyRules/PropertyRulesPanel.vue`，复用 `views/device/alarm/components/{PropertyAlarmCondition.vue,DeviceAlarmNotificationConfig.vue,DeviceAlarmTemplateStatus.vue}`。`RuleMenuOption.vue` 紧凑标题/描述、通知选择与状态浮层仍使用 12px；通知关闭斜线在 `DeviceAlarmNotificationConfig.less` 中固定 top 值，detail 外层却将铃铛高度改为 32px。模板汇总将 `unneeded` 合并为 `ready`，实际截图中绑定状态误判的完整来源仍待接口数据核验。
- 作者简报 / 决策：保留设备详情原位规则卡与既有通知模型，在 feature 内修正显示和状态派生。已确认复用现有组件；实际模板配置以当前用户可访问、启用且完整的绑定为依据，未知、缺失、无需模板分别表达，不通过改文案掩盖错误判定。Router 选择 `jetlinks-web`，涉及状态文案时补 `jetlinks-conventions`；不需要页面壳层重新选型或后端设计。
- 非目标：不修改运营端 `ui/`、页面壳层、后端接口、持久化协议、通知方式准入、默认选择、权限、菜单或实际模板配置；不提交或推送。
- Phase 1（单位）：核对物模型单位与现有单位字典，优先使用返回的单位显示名，再按后端单位字典读取 symbol，未知单位保留原值；数值输入与单位留出固定间距，单值/区间成组显示并合理换行。有单位正常展示，无单位不显示空后缀或额外占位，阈值 0 正常回显；触发和解除条件保持一致。
- Phase 2（文字与图标）：解除方式菜单、通知类型菜单及模板状态浮层的标题/说明统一为 14px，匹配行高与浮层宽度；检查该 feature 共用菜单的可读性。通知开关图标按真实控件尺寸居中，关闭斜线相对图标定位，保留启用/关闭/禁用状态和原有点击行为。
- Phase 3（配置真值）：核验 `/notify/channel/all` 与 `/notify/channel/providers` 现有返回及通知中心绑定结构；修正 `views/device/alarm/api.ts` 和现有状态派生中必要的判定，分别覆盖触发/解除、启用/停用、完整/不完整绑定、站内信无需第三方模板、加载失败与历史不可用选择。仅有类型定义、未绑定或失效配置不能显示“已配置”；“无需模板”保持独立、中性表达。若发现必须改变通知准入或接口契约，先回写本节并再次确认。
- 作者开发前检查：源码事实已获取，修改限定于同一前端 feature，无公共模型、权限、事件或 Reactive 变更。Review 重点为数值/单位不重叠、浮层文字可读、通知图标状态明确及模板状态符合真实绑定；共享调用方须一并回归，避免影响产品默认呈现和告警编辑弹窗。
- 验证方式：在 `runtime-ui/` 执行 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs`、`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui`、`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，区分既有诊断与本次新增问题；执行变更 SFC/Less 编译、定向样式检查与 `git diff --check`。在 9200 实页验证有/无/长单位、单值/区间、0、触发/解除、通知开关及配置状态、宽窄布局，不为验证写入真实设备规则或修改消息模板。
- 执行与实现：用户已确认计划，按 `jetlinks-web` 实施。`PropertyAlarmCondition.vue` 将条件值/区间和单位成组，间距 8px，长单位可换行，无单位不渲染占位；`utils.ts/formatPropertyUnit` 复用 `hooks/usePropertyUnits.ts`：使用物模型显示名或 `/protocol/units` 字典 symbol，保留自定义单位与未知原值，不维护前端符号映射。`RuleMenuOption.vue`、通知选择/状态/帮助浮层使用 14px；铃铛保持 18px 内部盒，关闭斜线按盒中心定位，开关高度跟随 detail 的 32px 控件。
- 配置真值：`api.ts` 在原有类型准入规则之外，复用现有 `/notify/channel/{providerId}/_query-with-templates`，仅查询相关、启用且存在模板绑定的设备告警/解除配置；不新增后端接口或权限。`notificationTemplateStatus.ts` 核验真实通道、模板 ID、通知配置 ID 和启用状态，避免已删除/替换模板仅凭旧 ID 显示已配置；查询无权、失败或返回异常显示状态未知，通知方式不因该查询失败而消失。`useAlarmNotification.ts` 与 `DeviceAlarmTemplateStatus.vue` 共用状态汇总，未配置优先提示，站内信无需模板使用中性信息图标；保留历史解除使用触发主题的语义。未新增用户可见文案，沿用现有国际化键。
- 自动验证结果：Node 22.18.0 下最终 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 161/161 通过，新增覆盖单位缺失/标准符号/自定义文本、真实模板缺失/错绑/停用/读取失败、状态汇总、触发/解除及历史主题。模块构建通过（5m5s），保留既有资源路径、循环 chunk、Rollup output 与大 chunk 警告；构建后最后的样式微调已由最终 7 个变更 SFC 的脚本/模板/样式编译和定向样式门禁覆盖。`git diff --check` 通过；模块无独立 lint 脚本。全模块 `vue-tsc` 未通过，1822 条工作区诊断（如共享 `api/account/center.ts` 及测试缺 Node 类型），本次修改的生产文件无诊断。
- 页面验证与限制：9200 当前仅开放告警中心菜单，设备详情路径被重定向，因此使用临时本地页面挂载真实条件/解除/通知/模板状态组件，并加载 detail 样式检查。1920、1000、760、390 宽度下组件卡无横向溢出；有/无单位与阈值 0 正常，触发和解除的单位间距均实测 8px，长单位在 390 宽度换行，相关菜单与说明实测 14px，通知开关与居中的关闭斜线正常，未配置和无需模板分别显示。临时页面已关闭、视口已恢复；实际后端模板状态由现有接口契约和模拟传输回归覆盖，尚未对真实设备详情、保存和消息发送进行联调，未写入设备规则或消息模板。
- 作者 Review 门禁：PASS。范围限定于运行时现有 feature；复用 Ant 控件、现有 API、资源缓存和保存模型，未改变公共契约、通知方式准入、默认选择、权限或后端 Reactive 链路。状态核验与汇总集中复用，行为回归和展示验证覆盖本次改动；无新增经验沉淀或提交/推送。

- 卡片头部操作对齐（S 级）：设备 detail 卡片将右侧统计/图例/撤销/保存/更多与属性名称、类型、来源所在首行对齐，属性标识仍在第二行；首行统一 32px，宽度不足才自然换行。仅修改 `PropertyRulesPanel.vue` 的 detail 局部样式，不改变操作和保存语义。验证：最终 Panel SFC 脚本/模板/Less、定向样式门禁和 diff 检查通过；9200 实页测得标题、来源标签、操作区中心完全一致。宽屏及 1000×850 保持同行，760×850 操作区自然换行且无横向溢出；视口已恢复，预览页已关闭，未保存临时配置。最终模块构建通过（3m24s），复用 155/155 行为回归。

### 仅展示已配置属性（M 级，已实施）

- 目标与边界：仅调整运行时设备详情 `presentation="detail"` 的属性列表，主区展示有实际规则的属性（包括继承的产品规则），其余通过“添加属性”选择后原位配置；保留未保存草稿。owning module 为 `runtime-ui/modules/device-manager-ui`。不修改产品默认呈现、运营端 `ui/`、后端接口、权限或手动保存协议。
- 推荐方案：沿用“对象详情工作区”，顶部保留属性名称/标识搜索，以“添加属性”替换 detail 的全部/已配置/未配置切换；添加入口打开可搜索的轻量属性选择浮层，展示名称、标识与来源。选择后显示原有配置卡，不自动创建或保存规则。没有规则时展示空态及添加入口；无候选时禁用添加入口，候选搜索无结果时明确提示。替代方案为在末尾保留一张添加占位卡，但它仍占用主区卡位，本次不推荐。
- 排序与入口（用户已确认）：选中属性后置于所在分组首位，并展开分组、清除阻挡它的搜索，以便立即配置。编辑期间不随草稿内容跳动；保存成功后取消临时置顶，按已保存规则项数从多到少排列，同数保持物模型原始顺序。计数按规则项（如值过滤、有效范围、告警各一项），不按条件值或通知人数；既有分组保留，排序在组内生效。保存失败保持当前位置和草稿；未解析历史规则保留可见且不猜测内部规则数量。顶部展示已配置/未配置数量，添加按钮与“未配置”同行、字号和高度一致，位于右侧。

```text
[搜索已配置属性] 已配置 N / 未配置 N          [+ 添加属性]
分类
┌ 已配置属性 A · 来源 ┐  ┌ 已配置属性 B · 来源 ┐
│ 原位规则配置       │  │ 原位规则配置       │
└────────────────────┘  └────────────────────┘
添加浮层：[搜索名称或标识] → 属性名称 / 标识 / 来源 → 选择
```

- 展示与编辑：保持当前双列/窄屏单列密度与 14px 控件；窄屏搜索独占首行，数量与右侧添加按钮保持同行，不新增侧栏、统计区、向导或独立编辑表单。复用 Ant Input/Button/选择浮层、现有属性分组与 `PropertyRuleFields` / `PropertyRuleActions`；核心视觉仍为规则卡片，来源状态在标题旁，不使用单侧色条。原位编辑和手动保存保持一致，浮层只选属性。
- 配置判定与风险：未配置及空的“不应用规则”卡片进入添加列表，保留空覆盖阻止产品继承的语义，选择器明确标记“不应用规则”；不因隐藏卡片而删除覆盖。继承的有效规则和无法解析的历史/自定义规则继续显示。新增空卡在本次操作中可配置，取消/撤销且无规则时回到添加列表；有草稿的卡片保持可达与离开保护。
- 实施入口：`views/device/components/PropertyRules/PropertyRulesPanel.vue` 负责列表与添加入口；`usePropertyRules.ts` 隔离 detail 展示判定、搜索、分类、分块及深链接；复用 `cards/usePropertyRuleCards.ts` 的编辑器生命周期。`PropertyRulePicker.vue` 独立承载属性选择浮层，不访问接口或全局状态；Panel 291 行、Picker 62 行。已完成展示判定、选择状态、空态及权限接入，复用原有保存/撤销与设备切换保护。
- 验证计划：覆盖有效/继承/空覆盖/历史规则、新增置顶、保存后按规则数降序、同数稳定、保存失败不重排、撤销、隐藏后草稿保留、重复添加、只读权限、搜索/分组/30 条分块、深链接与设备切换隔离；执行现有回归、SFC 编译、定向样式检查、模块构建及类型检查并如实记录既有诊断；9200 实际页面核验宽窄布局和添加操作，临时草稿不保存。验证结果回填本节，不新增任务流水文档。
- 验证结果：Node 22.18.0 下 `node scripts/test-alarm-workspace.mjs` 155/155 通过，新增 4 项真实 Vue hook/编辑器回归，覆盖规则可见性、空覆盖、分组稳定排序、只读、30 条分块、重复添加/取消、深链接及清空后保留设备覆盖；保存失败保持置顶，成功后基于返回快照重新排序。最终 `pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（3m24s，保留既有资源/chunk 警告），Panel/Picker SFC 脚本/模板/样式编译、定向样式门禁与 `git diff --check` 通过。全模块 `vue-tsc` 仍有 1841 条工作区既有诊断，变更生产文件无诊断；既有测试文件缺 Node 类型等诊断仍在，模块无独立 lint 脚本。9200 实页核验已配置列表、搜索候选及无匹配空态、新增首位、原位规则入口与编辑操作栏；添加按钮实测为 14px/32px，靠右且与数量同行，760px 时搜索独占一行、数量与添加按钮仍同行。临时配置未保存，真实持久化排序由实际编辑器配合模拟接口回归覆盖，未实测真实规则写入或消息通知。
- 作者 Review 门禁：PASS。改动限定于运行时 detail 展示与 feature 内选择状态，复用现有字段、保存协议、权限和生命周期；产品默认筛选语义保持原样，无新增公共模型或后端接口。

- 值过滤留白修复（S 级）：detail 纵向规则表单显式 `flex-wrap: nowrap`，覆盖 Ant inline 的横向自动换列，修复首段固有高度被多算的问题，保留卡片等高、字段字号与语句内部换行。仅修改设备详情局部样式；不修改规则或保存行为。验证：9200 同一值过滤配置的清洗段由 142px 恢复为 72px（标题 24px、间隔 8px、规则行 40px）；添加缺省补齐后两段均按内容占 72px。多值换行后清洗段自然增至 136px，内容底部与分区底部一致；1000×850 窄屏无横向溢出，补齐句换行后也完整包含于分区中。最终 Less 编译、定向样式门禁与 `git diff --check` 通过；纯 CSS 修正复用此前模块构建和业务回归证据，未重复全量构建或类型检查。临时草稿已撤销，视口已恢复。作者 Review：PASS。

- 告警等级与工具栏统一（S 级）：设备详情内的告警等级入口沿用条件值的 14px 正文色、白底灰框和 32px 高度；图例/撤销/保存/更多统一 14px，保留保存的主操作色与状态反馈。仅修改 `PropertyRulesPanel.vue` 的 detail 局部样式，不改变等级值、下拉选项或保存行为。验证：最终 Panel SFC 脚本/模板/Less 编译、定向样式门禁及 `git diff --check` 通过；9200 真实页面测得等级与条件值文字同为 14px、rgb(29,33,41)，等级白底灰框高 32px，四个工具栏按钮均为 14px/32px；卡片无横向溢出。预览草稿已撤销，未保存设备规则。此次仅 CSS，复用上一轮模块构建和业务回归结果，未重复执行全量构建或类型检查。作者 Review：PASS。

- 告警可读性补充（S 级）：沿用设备详情原位配置，只将卡片中的比较条件回显为现有国际化文字（如等于、大于、小于），保留独立下拉箭头；统一告警等级/解除/通知的 14px 字号和 32px 控件行高，图标对齐每行首行中心。复用 `PropertyAlarmCondition` / `PropertyAlarmRecovery` 的 detail 呈现及现有规则局部样式，不改变比较运算符、条件切换、校验、保存、权限或产品默认呈现。验证：模块构建通过（3m1s，保留既有构建警告），4 个变更 SFC 的脚本/模板/样式编译与定向样式门禁通过，现有告警/属性规则回归 151/151 通过，`git diff --check` 通过。9200 真实页面核验枚举“等于”、数值“大于或等于”及指定解除“小于”回显；主条件、等级、解除均为 14px，触发/解除/通知图标中心分别与本行 32px 控件中心一致。宽屏双列、1000×850 和 760×850 单列无横向溢出，视口已恢复，临时条件已撤销且未写入设备。全模块 `vue-tsc` 仍有 1841 条工作区诊断（例如共享 `api/account/center.ts`），此次四个变更文件无诊断；模块无独立 lint 脚本。作者 Review 门禁：PASS，未扩展业务行为。

- 可读性微调（S 级）：在现有运行时设备详情属性卡内，统一规则正文/控件为 14px、控件高 32px，增强阶段标题和可编辑边界，扩大数值/条件输入区域并保持单位成组换行。范围为 `PropertyRulesPanel.vue` 的 detail 局部样式，复用既有 Ant 控件；不改变规则含义、校验、保存或产品默认呈现。验证：Node 22.18.0 下模块构建通过（5m56s，保留既有 chunk/资源等警告）；随后只补标签列宽、字号继承与 focus token，最终 SFC 脚本/模板/Less 编译、复用 `ui/scripts/check-ui-style.mjs` 的定向样式门禁、`git diff --check` 均通过。9200 真实页面验证宽屏双列与 1000×850 单列，规则正文 14px、标签与语句不重叠、规则与面板无横向溢出，临时最大跳变量/缺省补齐草稿已撤销，未保存设备规则。纯 CSS 修改未重复执行完整类型检查；既有全模块类型诊断见下文，模块无独立 lint 脚本。手机宽度与真实保存流程本次未复测。作者 Review：PASS，范围仅 detail 展示样式。

- 当前结论（用户已确认的 M 级方案）：设备详情默认只展示有规则的属性，新增属性先在所在分组置顶，保存后组内按已保存规则项数降序、同数保持物模型顺序。当前展示的每张属性卡始终使用截图中的原位配置结构，保存、切换属性、筛选后返回与刷新后都展示相同的输入/选择控件、阶段标题、记录无效数据、移除和添加入口。保存更新基线、反馈与卡片排序，有修改才显示保存/撤销；保留图例、统计、清空和恢复产品规则。
- owning module：运行时 `runtime-ui/modules/device-manager-ui`，设备详情显式传入 `presentation="detail"`。产品默认呈现沿用原来的摘要/单属性编辑；不修改运营端 `ui/`、后端、保存协议、权限、菜单或路由定义，不增加向导、独立表单、弹窗或自动保存。
- 风格方案：沿用用户指定的 `/Users/hukaiyu/.cc-switch/skills/jetlinks-web-style/SKILL.md` 的“对象详情工作区”分区卡片。顶部保留属性搜索、已配置/未配置数量及右侧添加入口，内容是已配置属性卡，详情承载为设备 Tab，编辑原位，动作就近放在右上角，紧凑密度、无新增侧栏。宽度达到 1100px 时每行两张、同组等宽等高，空间不足一列；内容撑高且不裁切。不借鉴向导、全字段弹窗、卡片墙或额外统计区。
- 组件复用：继续组合 Ant List/Tag/InputNumber/Select 与 `PropertyRuleFields.vue`、`PropertyRuleActions.vue`，共用平台 `--panel-background/padding/radius/gap` 契约；已核对的 `SectionCard`/`EntityCard` 不增加额外壳层。来源始终位于标题旁，卡片头无额外编辑态分隔线；规则内部阶段标题及分区线在保存/编辑时保持一致。只读和产品继承规则仍显示配置控件，并沿用禁用与“设备单独配置”入口。

```text
属性搜索 / 已配置·未配置数量                 + 添加属性
┌ 属性 A · 类型 · 来源 · 操作 ┐  ┌ 属性 B · 类型 · 来源 · 操作 ┐
│ 属性标识                   │  │ 属性标识                   │
│ 阶段标题 / 原位配置控件 │  │ 阶段标题 / 原位配置控件 │
│ + 添加规则               │  │ + 添加规则               │
└──────────────────────────┘  └──────────────────────────┘
┌ 属性 C · 类型 · 来源      ┐  同组卡片等宽等高
│ 阶段标题 / 原位配置控件 │  容器小于 1100px 时一列
└──────────────────────────┘
```

- 状态入口：`views/device/components/PropertyRules/cards/usePropertyRuleCards.ts` 在面板生命周期内保留已访问属性的编辑器，只按当前展开分类的可见分块初始化。筛选或折叠销毁字段 DOM 时草稿仍保留。复用 `usePropertyRules.ts` 的完整列表快照，不逐属性重新查规则；`usePropertyRuleEditor.ts` 提供共享上下文，使通知方式、等级和人员缓存按设备范围共用。保存期间串行保护其他卡片；刷新只更新没有草稿的邻居，设备切换和卸载清理旧状态并隔离迟到响应，加载新设备期间不从上一设备的快照创建可编辑卡片。
- 保存与撤销：沿用原规则校验、手动保存与刷新，撤销恢复对应卡片最近保存基线并保留同一种配置结构。移除最后一项但尚未保存时保留空卡片与添加入口，可继续保存/撤销；保存为空后卡片收回添加列表，空设备覆盖仍表示“不应用规则”，恢复产品规则才删除覆盖。面板统一提供离开/刷新保护，覆盖筛选后隐藏的草稿及尚未改字段的显式设备覆盖。
- 保留此前已确认的通知模板过滤、默认站内信、未选通知方式隐藏人员、清空方式清空人员、名称按可用宽度展示与触发方式名称回显。
- 自动验证：Node 22.18.0 下 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 151/151 通过，新增覆盖可见分块初始化、多卡独立草稿、筛选/折叠后保留、保存后继续配置、刷新隔离、统一离开确认、共享资源、写入互斥、迟到响应、权限/继承/空覆盖与设备切换加载隔离。Panel/Fields/Actions 的 SFC 脚本、模板与样式编译通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（6m4s，保留既有资源路径/循环分块/chunk 体积警告）。随后增加加载隔离条件并由回归覆盖，复用构建证据。完整 `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍是既有 1834 条诊断，本次修改的生产文件无诊断；既有测试文件仍缺 Node 类型。模块无独立 lint 脚本，`git diff --check` 通过。修改的 Vue 文件均少于 300 行。
- 浏览器验证边界：此前版本已验证 9200 的两列等大布局、添加/移除/撤销、1000×800 一列与内部无溢出。当前统一配置结构这一轮的 Chrome 扩展连接反复超时/Debugger unattached，未完成实际页面实测，不将旧截图作为本次效果证据。待连接恢复后，需核验已保存规则直接显示控件、编辑/撤销/保存后样式稳定、刷新后一致、筛选/折叠草稿保留和只读控件禁用；可从设备详情的“规则配置”Tab 进入。保存与恢复由真实 Vue hook + 模拟传输覆盖，本轮未写入真实设备规则、未实测消息发送。390×844 下既有全站侧栏不收起仍可能挤压详情区，外壳适配不在本次范围。
- 实现自查：复用现有字段与保存模型，设备卡片通过 feature 内 hook 管理生命周期；未新增公共模型或后端协议。

## 通知已选名称按可用宽度展示

- 目标与范围：S 级局部展示调整，仅修改运行时告警通知类型、通知对象的名称回显；空间足够时展示所有已选名称，超出一行空间时才显示 `+N`，悬停仍可查看完整名称。
- 实施：`components/DeviceAlarmSelectionSummary.vue` 与 `hooks/useAlarmSelectionOverflow.ts` 由通知类型和人员入口共同复用，根据实际字体、名称宽度和计数占位计算展示数量；容器宽度、名称异步回查及语言变化后重新测量。紧凑按钮保持完整名称的固有宽度，避免折叠后按钮继续缩小。保留当前通知选择浮层、模板筛选、人员查询、默认值与保存逻辑。
- 复用判断：现有项目 `ChipGroup` 是可交互选项组，无名称摘要溢出计数能力；共享包 `Ellipsis` 只提供文本省略与 Tooltip；Ant Select 的响应式标签承载选择器，当前两个入口需继续使用通知类型与人员专用浮层，因此仅在告警 feature 内复用展示摘要，不改公共组件。
- 自动验证：Node 22.18.0 下 `node scripts/test-alarm-workspace.mjs` 145/145 通过，覆盖全部名称恰好放下时不预留计数、溢出数量、容器拉宽、单个长名称与空选择。模块构建通过（2m42s，保留既有构建警告）；随后将 DOM NodeList 展开改为 `Array.from` 以兼容项目 lib 配置，新 hook 定向 `tsc --noEmit --target ES2020 --module ESNext --moduleResolution bundler --lib ES2020,DOM --skipLibCheck` 及实际 SFC 再打包均通过，`git diff --check` 通过。完整 `vue-tsc` 仍存在既有 1837 条诊断；模块无独立 lint 脚本。
- 浏览器验证：9200 实际新增页面已确认同时完整显示“站内信、邮件”，人员名称回查正常。用同一实际摘要组件在本地场景验证三个人员：600px 全部展示、180px 两人加 `+1`、90px 一人加 `+2`，类型在90px也正确折叠；恢复600px后两处均完整展示。真实人员搜索后续出现网络错误，多人宽度验证由实际组件场景覆盖；检查草稿未保存，预览页与临时服务已关闭。
- 作者 Review 门禁：PASS。调整限定于回显，未改变通知配置与保存契约；测量逻辑集中于 hook，两个入口复用同一展示组件，无新增公共层依赖。

## 通知类型按当前用户可用设备告警模板展示

- 目标：未启用设备告警消息模板时不提供任何通知方式；启用后默认提供站内信，其他方式仅展示已启用且具有完整模板配置的类型。新配置首次开启通知时默认选择站内信，已有选择不被覆盖。未选择通知方式时隐藏“通知对象”（推送人），选中至少一种方式后再展示；用户取消全部通知方式时同时清空已选人员，重新选择方式后需重新选择人员。
- 级别与归属：M，运行时 `runtime-ui/modules/device-manager-ui`。复用 `views/device/alarm/api.ts` 的 `/notify/channel/all` 当前用户可访问配置及 `/notify/channel/providers` 类型定义，不新增接口，不修改消息模板管理或个人订阅。
- 实现入口：`api.ts/toNotifyMethods` 从当前用户可访问且启用的设备告警配置生成可选类型，`hooks/useAlarmNotification.ts` 处理默认值与选择联动，`utils.ts/selectAlarmNotificationTypes` 在用户清空方式时同步清空人员。共享调用方包括告警主页面与产品/设备属性规则编辑。
- 选择规则：以已启用的 `alarm-device` 配置为入口，站内信不要求第三方模板；其他方式要求启用渠道和完整模板绑定，仅有解除模板不作为触发通知的可用依据。读取失败使用错误/重试状态，不退回展示全部类型。无既有选择的新配置在异步加载完成后初始化站内信；通知总开关保留草稿，用户主动清空方式后不会自动重选。历史失效选择保持回显与持久化内容，不再追加到可选方式；显式重新选择时移除失效绑定。
- 边界：沿用现有通知模型、保存协议与模板状态提示，不自动保存或修改模板、不启用个人订阅、不修改运营端 `ui/` 或后端。
- 刷新与错误状态：告警主页面每次打开编辑时重新查询并清除旧选项；`index.vue`、`DeviceAlarmEditorModal.vue` 透传加载失败与重试操作。属性规则编辑在重新打开时通过 `usePropertyRuleEditor.ts` 刷新 `useRuleResources.ts` 的配置快照，普通浮层操作继续复用已加载资源。
- 自动验证：Node 22.18.0 下 `node scripts/test-alarm-workspace.mjs` 144/144 通过，覆盖无配置、配置停用、仅站内信、已配置邮箱、未配置短信、渠道停用、仅解除模板、查询失败、旧规则回显、异步默认选择、清空方式与人员、关闭/重开及组件重新挂载。运行时根目录 `pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 最终构建通过（2m21s），`git diff --check` 通过；模块没有独立 lint 脚本。
- 类型检查：`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍有工作区既有 1837 条诊断，例如 `jetlinks-web-core/src/api/account/center.ts:65` 的 TS2347；本次修改组件、hook 与适配函数未出现诊断。
- 浏览器验证：本机 9200 当前账号无可用设备告警配置时，开启通知并展开类型列表显示“暂无可用通知类型”，不展示通知对象。启用模板后的筛选、站内信默认值及清空后不恢复人员由真实 Vue hook 与 API 适配测试覆盖；未为验证修改真实消息模板配置或保存告警草稿，未实测消息发送。
- 作者 Review 门禁：PASS。用户确认后按 `jetlinks-web` 实施，复用已有 API 适配与通知 hook，未扩大到模板管理、公共模型或后端；新行为已补测试，所有改动 Vue 文件不超过 300 行。

## 告警编辑三个配置分区适配

- 目标与 owning module：改善运行时 `runtime-ui/modules/device-manager-ui` 物联告警编辑弹窗中“告警对象 / 触发与解除 / 通知配置”的控件尺寸、对齐和响应式表现。本次 M 级计划已由用户确认后实施。
- 当前入口事实：`views/device/alarm/index.vue` 使用 `components/DeviceAlarmEditorModal.vue`；产品/设备详情已使用 `PropertyRulesPanel`，不再将历史文档中的“三个入口共用此弹窗”视为当前调用事实。本次保留固定产品范围、只读范围等既有 props 契约。
- 交互方案：沿用本文已有三栏配置工作区档案。宽屏固定左右栏各 18.75rem，剩余宽度优先给中间表单；1200px 以下摘要下沉，720px 以下单栏全屏，编辑内容内部滚动，底部取消/保存保留在可视范围。
- 局部位置调整：将通知表单底部的“通知说明”移至中间编辑区“通知配置”标题旁，复用 `components/editor/DeviceAlarmNotificationHelp.vue`；规则行内编辑保留原位置。调整后 SFC 脚本/模板与 scoped LESS 编译通过，既有测试 141/141 通过；浏览器已确认标题同排、底部入口移除及说明浮层正常，检查草稿已取消。
- 实施：左侧标题突出、摘要最多两行；右侧改为紧凑分隔列表。对象选择按产品、设备、属性分行；触发方式、阈值和自动解除采用正常表单尺度，预览跟随设置；通知采用开关、通知类型、通知对象与解除通知的分行表单。
- 触发方式回显：`PropertyAlarmCondition.vue` 在正常表单呈现下复用 `DeviceAlarm.condition.label.*` 显示“大于”“小于”等名称，指定解除条件同样生效；下拉选项保留符号图标和说明，紧凑规则句与条件预览继续使用运算符。仅调整显示标签，不改变运算值与保存逻辑。SFC 脚本/模板编译、中英日10种操作名称与145项既有回归检查通过，`git diff --check` 通过；9200 实际页面已确认选择器显示“大于或等于”，预览继续显示 `≥`，检查草稿已取消。
- 文件职责：`components/editor/DeviceAlarmTargetForm.vue` 承载对象表单，`DeviceAlarmTriggerForm.vue` 承载触发/解除表单；原弹窗负责分区组合和实时摘要。新增文件归入同一个 `editor/` 职责目录，避免继续在既有选择、通知、卡片等组件旁平铺。
- 复用与兼容：`PropertyAlarmCondition.vue`、`PropertyAlarmRecovery.vue`、`DeviceAlarmNotificationConfig.vue` 的 `layout="form"` 仅由此弹窗启用；`values/ValueInput.vue`、`ValueSetInput.vue` 增加可选尺寸，默认仍为 small。保持原选择器、通知 hooks、模板状态、加载/空态、模型及事件契约；全部标签复用现有 i18n。
- 非目标：不修改运营端 `ui/`、后端接口、保存协议、自动解除语义、权限、菜单、路由或告警列表。
- 自动化验证：Node 22.18.0 下 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 141/141 通过，包含告警/条件往返、通知和工作区结构的既有测试；`git diff --check` 通过。`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（2m56s）；之后针对响应式边界的样式修正已通过最终 scoped LESS 编译和浏览器复核。构建保留既有资源路径、重复 locale key、CSS 注释、Rollup output/循环分块与 chunk 体积警告。运行时工作区未提供独立 lint 或 UI 样式检查脚本。
- 类型检查限制：`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 未通过，工作区存在 1837 条诊断，例如 `jetlinks-web-core/src/api/account/center.ts:65` 的 TS2347；本次修改组件及新增表单未出现诊断。未为本次布局适配修改其他类型错误。
- 浏览器验证：本机 `9200` 的新增、编辑和只读对象范围回显通过；验证上下限 10/20、跟随解除和指定解除表单、通知启停保留草稿、人员搜索浮层/已选回显、多通知类型与多人 `+1` 回显。1920×878、1000×800、390×844 三档视口完成目视复核；中屏摘要与主表单无重叠，窄屏三个区块等宽且无横向溢出，底部操作在视口内。所有检查草稿已取消，未保存测试规则，浏览器尺寸已恢复。
- 剩余范围：固定产品范围 props 由抽出的目标表单继续原样支持，但当前产品/设备详情已不使用此弹窗，未另造此场景的测试页面；未实测通知发送和后端保存，接口与保存逻辑本次未变。多通知通道在重新打开已有规则后正常加载，已完成多选回显验证。
- 作者 Review 门禁：PASS。遵循原表单模型和模块边界，未引入新公共模型、跨模块依赖、业务规则或无职责包装；默认紧凑呈现保留，新增的正常表单呈现显式启用。改动 Vue 文件均不超过 300 行。

## 通知对象已选人员名称回显修复

- 目标与 owning module：修复运行时设备详情、产品详情编辑设备告警时，已选通知对象不在人员首屏数据中便显示用户 ID 的问题；统一显示人员名称。
- 影响范围：仅 `runtime-ui/modules/device-manager-ui` 的设备详情、产品详情告警配置入口及告警工作区定向测试，复用告警主页面已有的“人员首屏 + 按已选 ID 查询 + 按 ID 合并”逻辑。
- 明确不做：不修改后端接口、通知配置结构、人员权限、分页交互、告警保存链路及页面样式，不修改运营端 `ui/`。
- 实施步骤：打开编辑器时提取已保存的 `userIds`，并行查询人员首屏和已选人员详情，合并后再传给通知对象选择框；滚动加载继续按 ID 去重合并。
- 验证结果：`node --test tests/alarmWorkspaceView.test.mjs` 4/4 通过，`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 在 Node 22.18.0 下构建通过（共转换 10297 个模块），`git diff --check` 通过。9200 运行页面实测确认：设备详情编辑告警时，原 UUID 标签已回显为人员名称，同时保留人员本身为数字的名称。

## 告警自动解除 V1

- 目标与 owning module：在 `modules/device-manager` 和 `runtime-ui/modules/device-manager-ui` 现有设备属性预处理告警中增加“自动解除告警”开关；开启后以告警匹配条件的严格反向条件执行解除。物联告警、产品详情和设备详情复用同一公共编辑弹窗与配置协议。
- 配置契约：关闭时继续保存已发布的 `simple` 结构；开启时保存为 `composite`，其中一个 `simple` 分支使用原 `number-range` 条件执行 `device-alarm` 及可选 `notify`，另一个 `simple` 分支反转 `not` 后执行 `device-alarm-relieve`。不额外持久化 `autoRelieve` 字段，编辑时由解除分支反推开关状态。
- 后端落点：在 `modules/device-manager/src/main/java/org/jetlinks/pro/device/message/preprocessor/` 增加 `DeviceMessageAlarmRelievePreprocessor`，注册到 `DeviceMessagePreprocessorConfiguration`，复用 `RelievedAlarmCommand` 和规则引擎已有解除、幂等、历史及事件能力。`DeviceAlarmPreprocessService` 同时兼容从 `composite` 解析通知配置。
- 前端落点：`views/device/alarm/components/DeviceAlarmEditorModal.vue` 在告警条件预览与通知配置之间增加开关和实时解除条件预览；`types.ts` 与 `utils.ts` 统一读写新旧配置。设备库本期不展示开关，但编辑、发布、安装和还原时保留已有 `composite` 解除分支。
- 明确不做：不新增数据库字段或 REST 接口，不修改规则引擎告警状态核心，不配置独立解除阈值、回差、延时解除或解除通知，不处理设备消息乱序，不修改运营端 `ui/modules/device-manager-ui` 边界。
- 兼容与风险：历史 `simple` 配置不迁移；解除和触发共用同一 `alarmConfigId` 及目标标识，无活动告警时由已有规则服务按无效解除处理。编辑端只接管历史 `simple` 和本功能生成的标准双分支 `composite`，其他复合预处理器不进入编辑链路，避免保存时丢失未知分支。V1 保持当前消息到达/处理顺序语义，乱序上报仍是剩余风险。
- 联调修复：真实设备恢复消息触发解除时，规则服务在写解除历史处因 `alarmTime` 为空发生拆箱异常。公共告警上下文与自动解除处理器统一沿用有效的设备消息时间，并以同一事件时间填充 `alarmTime` 与 `relieveTime`；规则服务继续据此拒绝早于当前告警的历史或乱序恢复消息。消息时间无效时保持为空，由规则服务按既有处理时间逻辑兜底。修复位于 `modules/jetlinks-components/things-component/src/main/java/org/jetlinks/pro/things/impl/preprocessor/internal/AbstractMessageAlarmPreprocessor.java` 与 `modules/device-manager/src/main/java/org/jetlinks/pro/device/message/preprocessor/DeviceMessageAlarmRelievePreprocessor.java`，未修改规则引擎核心。
- 验证结果：`iot-service` Reactor 编译 52/52 模块通过；后端 3 个定向测试类共 20 项通过，覆盖公共告警上下文的消息时间透传、无效时间回退、自动解除命令参数、原消息返回及错误向上游传播。公共告警命令方法使用 `Command<Mono<R>>` 强类型执行，不再依赖运行时 `Class.cast`。前端定向测试覆盖 `simple`/`composite` 回显、区间内外两类 matcher 严格互补、关闭后回归 `simple`、非标准 `composite` 不进入编辑链路，以及触发与解除分支共用告警名称/等级、设备库 `composite` 内两个告警处理器名称的递归本地化。Node 22 下 `device-manager-ui` 运行时模块构建通过，中英文 locale JSON 解析、构建产物中的开关与 `device-alarm-relieve` 配置检查及 `git diff --check` 通过。模块级 `vue-tsc` 仍被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断，本次未修改该文件。真实设备恢复消息的服务重载与再次上报验证仍待部署后复核。

## 设备告警站内信可选状态

- 目标与 owning module：在运行时前端 `runtime-ui/modules/device-manager-ui` 的物联告警、产品告警和设备告警共用通知选择中，消息模板的“设备告警” Provider 启用时允许选择站内信，不要求站内信配置模板；Provider 禁用时不可选。
- 影响范围：仅调整 `views/device/alarm/api.ts` 的通知通道映射及告警工作区定向测试；继续以 `/notify/channel/all` 返回的 `alarm-device` Provider 和通道状态为真值源。
- 明确不做：不修改运营端 `ui/`、后端接口、消息模板保存协议、告警保存协议、权限或其他通知通道规则。
- 实施：移除前端对 `inside-mail` 的额外排除，保留现有通道启用状态过滤；补充“无模板的启用站内信可选、禁用站内信不可选”回归测试。
- 风险与验证：重点确认站内信保持 `inside-mail` 的通道 ID/Provider ID，不会因缺少 `templateId` 被丢弃；执行告警工作区定向测试、模块构建和 `git diff --check`。
- 验证结果：Node 22.18.0 下 `node scripts/test-alarm-workspace.mjs` 19/19 通过，覆盖站内信不依赖模板且禁用通道仍会被过滤；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 构建通过，`git diff --check` 通过。构建仅保留现有的资源路径、CSS `//` 注释、Rollup output/循环分块和大 chunk 警告；未在登录态页面上实测消息模板启停后的下拉选项刷新。

## 新增/修改弹窗对齐视觉告警

- 目标与 owning module：将 `runtime-ui/modules/device-manager-ui` 的物联告警新增/修改弹窗改造成与视觉告警新增/修改弹窗一致的三栏配置工作区；物联告警主页面、产品详情和设备详情继续复用 `views/device/alarm/components/DeviceAlarmEditorModal.vue`。
- 任务级别：M。属于已有弹窗壳层和信息架构调整，方案已确认并完成页面、国际化和测试变更。
- 参考对象：`runtime-ui/modules/jetlinks-ai-ui/views/visual-alarm-preview/components/VisualAlarmRuleDialog.vue`。两者的共同任务都是围绕单条告警规则完成多组强校验配置；只借鉴大弹层、顶部标题说明、左侧基础配置与分区导航、中间编辑区、右侧摘要和底部操作栏，不复制视觉算法、摄像头、时间计划或通知业务实现。

### 交互方案档案

- `solutionName`：视觉告警式三栏配置工作区，对应“配置向导 / 能力开通页”的单页分区变体；配置项之间没有强制先后关系，因此使用分区导航，不增加步骤提交语义。
- `primaryFilterSurface`：无。
- `contentSurface`：左侧承载告警名称、告警等级和“告警对象 / 触发与解除 / 通知配置”导航；中间将互补的触发条件与自动解除放在同一配置面板。
- `detailCarrier`：右侧实时规则摘要，展示当前告警对象、属性、触发条件、解除条件和通知状态，不引入虚构统计数据。
- `editMode`：新增、编辑继续共用完整配置弹层；名称、等级与各分区直接编辑，不新增独立路由。
- `coreComponents`：继续复用 Ant Design Vue 表单控件、现有 `j-card-select`、`RegistryComponent`、`DeviceAlarmNotificationConfig` 和 `IotAlarmTargetSelect`；实施时核验当前工作区是否已有合适的固定底部操作组件，没有则沿用弹层 footer。
- `actionPlacement`：右下固定“取消 / 保存”，保持现有保存事件和校验入口。
- `densityTarget`：左栏紧凑；中栏每个分区只展示当前任务字段；右栏摘要不超过 8 项，长文本省略并提供完整提示。
- `sidebarMode`：仅为弹窗内部配置导航，不新增应用级侧栏；选中态使用完整描边或弱底，不使用单侧彩色线条。
- `confirmationMode`：按本计划确认后实施。
- `rejectedAlternatives`：不直接导入 `jetlinks-ai-ui` 私有组件；不抽取跨模块公共三栏弹窗并同步重构视觉告警；不保留 `720px` 单列长表单；不把无强顺序的配置拆成多步提交。
- `searchShellDecision`：不涉及搜索页壳；对象选择继续使用现有远程选择组件。

### 首屏结构

```text
┌ 标题：新增/编辑告警 · 一句配置说明                         [×] ┐
├──────────────┬────────────────────────┬──────────────────────┤
│ 基础配置      │ 当前配置面板            │ 规则摘要             │
│ 告警名称      │                        │ 告警对象             │
│ 告警等级      │                        │ 触发条件             │
│              │                        │ 解除条件             │
│ [告警对象]    │ 对象 / 触发与解除 /     │ 通知状态             │
│ [触发与解除]  │ 通知的当前编辑内容       │                      │
│ [通知配置]    │                        │                      │
├──────────────┴────────────────────────┴──────────────────────┤
│                                             [取消] [保存]     │
└──────────────────────────────────────────────────────────────┘
```

### 实施边界与步骤

1. 仅重构 `DeviceAlarmEditorModal.vue` 的弹层壳层、字段分区、当前分区状态和摘要展示，保留现有 `props`、`emits`、表单 model、校验和保存契约。
2. 保留 `RegistryComponent page-code="device/alarm" code="alarm-editor"`、产品/设备固定范围与只读逻辑、自动解除配置和通知配置；通知区是否可用继续服从现有注册扩展能力。
3. 在 `locales/lang/{zh,en}.json` 增加弹窗说明、三个配置分区、规则摘要及摘要字段文案，用户可见文本不在组件内硬编码。
4. 宽屏采用三栏；中等宽度降级为两栏并让摘要下沉；窄屏使用全屏单栏，保持字段和底部操作可滚动、可触达。
5. 扩充 `scripts/test-alarm-workspace.mjs` 对应结构测试，覆盖三栏壳层、分区导航、摘要、自动解除、通知扩展锚点及三个既有入口继续复用同一弹窗。

### 明确不做

- 不修改后端、REST 接口、配置 JSON 协议、数据库、权限、菜单和路由。
- 不修改运营端 `ui/`，不改视觉告警模块，不新增跨模块直接依赖。
- 不改变自动解除 V1 的 `simple` / `composite` 兼容逻辑，不增加独立解除阈值、回差或延时能力。
- 不顺带重构物联告警列表、记录卡、查询、处理和历史弹窗。

### 风险与验证

- 风险：同一弹窗在主页面、产品详情和设备详情三种上下文复用，必须验证固定产品范围、只读设备范围和普通可选范围；自定义大弹层还需验证遮罩关闭、焦点、滚动和窄屏操作区。
- 验证：运行 `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs`、中英文 locale JSON 解析、`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 和 `git diff --check`；补充大/中/小视口的新增与编辑交互检查。
- 已知限制：模块级 `vue-tsc` 可能继续被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断；若仍发生，只记录为既有阻塞并提供本次定向验证结果。

### 实现与验证结果

- `DeviceAlarmEditorModal.vue` 已改为最大 `100rem` 的三栏配置工作区：左侧保留名称、等级和“告警对象 / 触发与解除 / 通知配置”三个入口，中间将触发条件与自动解除合并编辑，右侧仍分别展示触发和解除摘要；取消、保存及关闭行为继续沿用原事件契约。
- 新增 `DeviceAlarmEditorModal.less` 承载弹层壳层、选中态与宽屏三栏 / 中屏两栏 / 窄屏全屏单栏响应式样式。标题区仅保留平台 `.ant-modal-title` 的统一分隔线，不再给 `.ant-modal-header` 叠加通栏边框；构建产物已核对 `.device-alarm-editor-modal-wrap .ant-modal-*` 后代选择器，避免 scoped LESS 将 Modal 样式错误压平到遮罩容器。
- 中英文资源保持 `DeviceAlarm.editor.*` key 对称，触发分区文案已表达触发与解除的合并关系；用户可见说明、导航、摘要与关闭状态均未在组件中硬编码。
- `node modules/device-manager-ui/scripts/test-alarm-workspace.mjs` 通过，共 13 项，新增覆盖三栏结构、三分区、触发与解除合并、通知扩展锚点、响应式断点和三个入口继续复用公共弹窗。
- Node `22.18.0` 下 `pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过；仅有既有资源路径、浏览器基线数据、Rollup output、CSS 注释和 chunk 体积警告。`git diff --check` 通过。
- `pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 仍被既有 `views/link/Certificate/type.d.ts:2:30` 的 TS1005 阻断，本次未修改该文件。当前无登录态浏览器环境，真实新增/编辑、三个入口及大中小视口的目视交互仍待部署后复核。
- 交付：实现提交 `498855d`；[前端 PR #340](https://github.com/jetlinks-v2/device-manager-ui/pull/340)，目标分支 `2.20`。

## 左栏前三排复用视觉告警样式（已完成，2026-09-23）

- 目标与 owning module：在 `runtime-ui/modules/device-manager-ui` 中让物联告警左侧标题、搜索框和“全部告警”前三排复用视觉告警的尺寸、间距与视觉规格，确保两个页面切换时这三排没有位置跳动；视觉告警同时移除入口右侧数量，关联计划记录在 `runtime-ui/modules/jetlinks-ai-ui/docs/plans/visual-alarm-preview.md`。
- 影响范围：仅调整 `views/device/alarm/index.vue` 的标题行结构、搜索框和“全部告警”入口局部样式、现有告警工作区定向测试和本文档；两个模块继续各自维护样式，不新增跨模块组件或依赖。
- 明确不做：不改规则列表卡片、规则/记录查询、搜索、筛选、默认范围、选中态语义、接口、权限、路由、文案或运营端 `ui/`。
- 实施步骤：1. 标题行复用视觉告警的 `2rem` 行高、标题/数量基线结构、`--fs-18`/`700` 标题和 `--fs-12` 数量规格；2. 搜索框复用相同的 `2rem` 高度，左栏三排继续统一采用 `--space-4` 间距；3. 为现有 `AlertOutlined` 增加同规格图标容器，并将按钮布局、标题、最小高度、内边距、列间距、边框、悬浮/焦点和选中态完整对齐；4. 保留 `showAllRecords()`、`aria-pressed` 和键盘操作；5. 扩充定向测试覆盖结构和关键尺寸。
- 实现结果：`index.vue` 为标题增加与视觉告警一致的内层基线容器，统一 `2rem` 标题/搜索行、`--space-4` 排间距和标题/数量字体规格；“全部告警”采用相同的两列结构、`3.5rem` 最小高度、`0.875rem` 内边距、1.5rem 主色图标、14px/600 标题以及一致的悬浮、焦点和选中反馈。查询、默认范围和 `showAllRecords()` 保持不变。
- 验证结果：`node scripts/test-alarm-workspace.mjs` 10/10、`pnpm exec vue-tsc --noEmit --pretty false`、`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 与模块 `git diff --check` 通过；模块独立类型检查仍被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断。构建仅保留既有资源路径、浏览器基线、Rollup 输出选项、CSS 注释及大 chunk 警告；`index.vue` 为 210 行。登录态下跨页面切换、不同数量宽度和浏览器缩放档位仍需目视确认。
- 交付：实现提交 `139abd8564713438ef81c9cd397ac292e4ea0014`；Pull Request：`https://github.com/jetlinks-v2/device-manager-ui/pull/311`。

## 处理记录详情告警名称补齐

- 目标：修复处理记录接口未返回 `alarmName` / `alarmConfigName` 时，详情中的告警名称统一显示 `—`。
- 影响范围与 owning module：仅运行时前端 `runtime-ui/modules/device-manager-ui` 的告警历史查询 hook、定向测试与本文档；不修改后端接口、数据表、页面结构或运营端 `ui/`。
- 明确不做：不按当前规则配置反查名称，不覆盖接口未来可能返回的行级快照名称，不改告警日志和处理记录的查询、分页、权限与展示字段。
- 实施：历史行缺少名称时，使用打开弹窗时已选告警记录的触发快照名称补齐；接口已有 `alarmConfigName` 或 `alarmName` 时保持原值。
- 风险与验证：依赖父告警记录携带快照名称；通过定向测试覆盖处理历史缺名回退、接口名称优先及已有异步隔离，并执行模块构建、类型检查与 `git diff --check`。
- 验证结果：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 与 `git diff --check` 通过。构建仅保留已有的依赖数据提示、资源路径、Rollup output、CSS 注释和 chunk 体积警告。本次未修改 Vue 文件，`useDeviceAlarmHistory.ts` 56 行；模块级 `vue-tsc` 仍被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断。运行时工作区没有 `check:ui-style` 命令，且未在登录环境复核真实处理记录；剩余风险是极早期异常告警记录本身也不携带名称时仍会显示 `—`。
- 交付：实现提交 `4b81414`；[PR #308](https://github.com/jetlinks-v2/device-manager-ui/pull/308)，目标分支 `2.12-uat-next`。

## 规则卡图标与操作展示统一

- 目标与范围：物联告警左侧规则卡统一使用视觉告警“全部告警”的 `AlertOutlined` 图标，并让右上角编辑/删除操作入口默认隐藏、悬停卡片时显示；仅调整 `views/device/alarm/components/DeviceAlarmRuleCard.vue` 的图标与局部样式，不改规则筛选、数量、选中态、接口或权限。
- 实施：移除规则卡原内联警灯 SVG 及渐变圆形底，复用现有 `AIcon`，尺寸、字号和主色与 `VisualAlarmCategorySidebar.vue` 的“全部告警”图标保持一致。操作入口通过卡片 `hover` 或 `focus-within` 显示，触屏设备保持可见，兼顾键盘与无悬停设备操作。
- 验证：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm --config.verify-deps-before-run=false build:modules device-manager-ui` 通过（仅有既有资源路径、CSS 注释、Rollup output.input 与 chunk 体积警告）；`git diff --check` 通过。修改后的 `DeviceAlarmRuleCard.vue` 共 136 行，未新增组件、业务逻辑或需要解释的复杂分支。
- 交付：实现提交 `55d7dc69f9a5fa1baa662b905b749fc4d2abc554`，Pull Request：`https://github.com/jetlinks-v2/device-manager-ui/pull/306`。

## 左侧“全部告警”入口

- 目标：在运行时物联告警规则侧栏的搜索框下方增加“全部告警”入口，从单条规则范围返回全部告警记录；默认范围呈选中态。
- 范围与落点：仅 `runtime-ui/modules/device-manager-ui/views/device/alarm/index.vue`、本模块中英文 locale 与定向测试。复用现有 `showAllRecords()` 和右侧记录查询；不修改 `ui/`、接口、权限或菜单。
- 方案：沿用规则筛选与记录处置工作台。左侧“标题 → 搜索 → 全部告警 → 规则卡”，右侧保持 `ConditionFilter` 和记录卡；入口仅切换规则范围，保留左右搜索。采用当前规则卡的完整描边、弱底选中反馈，不新增页面壳、统计区或编辑弹窗。
- 实施：`index.vue` 在搜索下方用可键盘操作的按钮和 `aria-pressed` 表示范围，点击复用 `showAllRecords()`；中英文文案位于 `locales/lang/{zh,en}.json`。记录范围测试按实际 `JProTable.request` 契约发起查询，覆盖默认、选规则、保留搜索返回全部及过期响应。
- 验证：`node scripts/test-alarm-workspace.mjs` 8/8 通过；`pnpm run build:modules device-manager-ui` 通过（已有资源路径、CSS 注释及 chunk 体积警告）；`git diff --check` 通过，`index.vue` 184 行。`pnpm exec vue-tsc --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json` 被既有 `views/link/Certificate/type.d.ts:2:30` TS1005 阻断；当前运行时工作区无 `check:ui-style` 命令。未在登录页面核验真实权限及数据，部署后需手动检查入口默认选中、选规则、返回全部及搜索保留。
- 交付：实现提交 `6a09587`；[PR #302](https://github.com/jetlinks-v2/device-manager-ui/pull/302)，目标分支 `2.12-uat-next`。

## 运营端编辑时新增按钮闪烁修复

- 目标与范围：仅调整 `ui/modules/device-manager-ui/views/device/alarm/index.vue` 的新增按钮状态绑定，编辑规则期间保持按钮外观稳定。
- 实施：移除新增按钮对公共 `busy` 的原生 `disabled` 绑定，保留 `creating` 加载状态；并发操作继续由 `hooks/useDeviceAlarmWorkspace.ts` 的 `create()` → `run()` 和 `if (busy.value) return` 拦截。保持页面布局、接口、权限及编辑流程不变。
- 验证：`pnpm check:ui-style -- --files modules/device-manager-ui/views/device/alarm/index.vue` 通过；模块内 `node scripts/test-alarm-workspace.mjs` 8 项通过；`ui/` 下 `pnpm run build:modules device-manager-ui` 通过。构建仍有资源路径、Rollup output.input、混合导入、CSS 注释及 chunk 体积警告。代码核对确认编辑不写入 `creating`，新增仍经过 `run()` 互斥；页面 180 行，未新增组件或抽象。
- 未验证：未运行独立 typecheck，模块无统一 lint 脚本；浏览器实际交互待验证，应检查编辑打开前后新增按钮外观稳定、编辑资源加载期间点击新增不会覆盖编辑表单、新增自身加载反馈正常。
- 交付：修复提交 `cd68dc4`；[PR #280](https://github.com/jetlinks-v2/device-manager-ui/pull/280)，合入 `2.12-uat-next`。PR 已按当前底部按钮布局更新，替代旧版标题行按钮方案。

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

## 告警设备下钻设备告警

- 目标与 owning module：在运行时前端 `runtime-ui/modules/device-manager-ui` 的物联告警记录卡中，让“告警设备”名称可点击下钻到该设备详情的设备告警页签。
- 影响范围：仅调整运行时告警记录卡、页面容器、记录类型、设备 ID 解析工具与定向测试；复用设备来源 ID，并兼容 `targetType=device` 时的 `targetId`、现有设备详情路由和 `tab=alarm` 契约。
- 明确不做：不修改 `ui/`，不新增路由、菜单、接口或权限，不修改整张记录卡的点击行为，不用设备名称反查 ID。
- 实施与风险：设备 ID 优先取 `sourceType=device` 的 `sourceId`，来源 ID 缺失时仅在 `targetType=device` 时回退到 `targetId`；来源与设备目标都无有效 ID 时保持普通文本，非设备目标不伪造跳转。
- 验证：定向测试覆盖来源 ID、设备目标 ID 回退、非设备目标降级和 `tab=alarm` 路由；执行运行时模块的定向测试、UI 样式门禁、Node 22 模块构建及 `git diff --check`。
- 验证结果：本次新增的设备 ID 解析与下钻路由测试通过；最新 `2.20` 定向套件共 19 项，18 项通过，1 项因基线 `mapNotifyChannel` 仍过滤 `inside-mail` 与新增断言不一致而失败，与本次 7 个变更文件无关。Node 22.18.0 下 `device-manager-ui` 模块构建和 `git diff --check` 通过；`runtime-ui` 未提供 `check:ui-style` 脚本。真实页面中告警设备已渲染为按钮，点击“官方协议”后进入 `#/resources/devices/list/Detail/2110610307903660032?tab=alarm`，并正确打开“设备告警”页签。构建仅有仓库已有的资源路径、Rollup output、CSS 注释和 chunk 体积警告。

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
