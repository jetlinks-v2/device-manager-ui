# iot-ui 用户可见中文国际化清理计划

## 目标与当前结论

对 `ui/modules/iot-ui/` 的源码和配置做完整中文扫描，将页面标题、字段名、按钮、提示、空态、校验、状态、菜单，以及 adapter/service 生成的展示文案统一接入模块现有国际化机制。

扫描基线（2026-07-21）：

- `locales/lang/zh.json` 与 `locales/lang/en.json` 各有 2262 个 key，key 集合一致。
- 排除 `dist/`、现有语言包和 Markdown 后，仍有 133 个源码或配置文件包含中文：100 个 TypeScript、30 个 Vue、2 个 JSON，以及 1 个模块元数据文件。
- 中文残留同时包含用户可见文案、mock/seed 页面数据、菜单 fallback、CSS `content`、注释、内部匹配条件和开发元数据，不能机械地全部替换。

## 影响范围与 owning module

Owning module 为 `ui/modules/iot-ui/`，计划涉及：

- `views/`、`components/`：模板、表格/表单配置、状态文案、提示及 CSS 生成内容。
- `hooks/`、`services/`、`api/`、`agentCapabilities/`、`modules/defaults/`：返回给页面的展示模型、用户可见错误，以及 mock/seed 中与业务实体数据分离的固定界面文案。
- `baseMenu.json`、`module.config.ts` 等模块配置中的用户可见名称。
- `locales/lang/zh.json`、`locales/lang/en.json`：同步补充中英文资源，保持 key 集合一致。

## 明确不做

- 不修改 `runtime-ui/` 或其他前端模块。
- 不改页面布局、交互流程、接口字段、路由参数、权限标识和业务判断语义。
- 不国际化注释、内部日志、正则/解析标记、协议常量、开发文档及 package 描述等非用户可见文本。
- 不直接修改或提交 `dist/` 构建产物；源码验证通过后由正式构建流程生成。
- 不覆盖当前工作区已有的未提交改动；重叠文件按现有内容增量修改。
- 不将设备模板名称、厂商型号、项目点位、知识库正文等 mock/seed 业务实体内容迁入前端语言包，避免筛选值、关联数据和持久化内容随语言切换变化。

## 实施步骤

1. 以中文字符扫描结果为入口，逐文件区分用户可见文本与技术文本，并按页面组件、展示模型、菜单/配置、mock/seed 数据四类建立清单。
2. Vue 组件使用现有 `useI18n()`；组件外的 hook、service、配置和展示数据工厂沿用 `@jetlinks-web-core/locales`。带变量文案改为命名占位符，不通过字符串拼接绕过语言包。
3. 为 `zh.json`、`en.json` 同步增加语义化 key，优先复用已有 key 和模块术语，避免重复维护同义文案。
4. 对依赖中文值做判断的代码单独审查：展示 label 与稳定业务 value 分离；不能安全改成稳定值的解析/兼容逻辑保留，并记录为非展示文本。
5. 复扫全部源文件，确保剩余中文均属于明确排除项；检查中英文 key 对齐、引用存在性和 JSON 有效性。
6. 执行模块类型检查/构建与关键页面中英文切换验证，并将验证结果回填到本文档。

## 风险与边界结论

- mock/seed 中同时存在两类内容：adapter/service 生成的状态、错误、操作提示属于 UI 文案；设备模板名称、厂商型号、项目点位、知识库正文等属于业务实体数据。已确认前者国际化，后者保留原始业务值。
- 个别逻辑通过中文 label、相对时间或摘要文本做 `includes`/正则判断，直接替换会改变行为；需要先改为稳定 value，或作为兼容解析保留原匹配。
- `baseMenu.json` 已包含 `i18nMessages`，其中 `name` 和 `accessSupport.text` 可能同时承担中文 fallback 与平台配置契约；将优先保留平台要求的 fallback，仅确保实际展示可随语言切换。
- `views/device/list/components/device-detail/IotDeviceDataTableTab.vue` 当前有用户未提交改动，实施时只做最小增量合并。

## 验证方式

- JSON 解析及 `zh.json`/`en.json` key 集合一致性检查。
- i18n key 引用存在性检查，以及中文残留复扫和逐项分类确认。
- `npx vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`（若工作区基线错误导致失败，则单独确认 `modules/iot-ui` 错误输出）。
- `pnpm --filter jetlinks-web-core build -- --module-name iot-ui`。
- 重点检查设备总览、设备列表/详情、设备分组、设备健康、设备告警、场景联动在中英文切换后的标题、表单、提示、状态与 mock/seed 内容。

## 实施结果

截至 2026-07-21：

- 已将设备详情概览、健康模板、待办处理、设备数据表、分组选择、场景编辑器等页面硬编码文案接入 `vue-i18n`。
- 已将设备状态、项目区域、设备库分类/场景/行业、Iot2 设备类型元数据改为延迟读取语言包，支持运行时切换语言。
- 已国际化 API/adapter/service 生成的用户可见错误、状态、Toast、模拟器链路与健康诊断说明。
- 已将三份重复设备库 seed 和两份重复设备 seed 收敛到模块级唯一事实源。
- 中文残留复扫后，非 seed/mock/defaults 范围剩余 159 个字符串，均已逐项归类为搜索别名、AI 能力关键词、兼容解析、稳定业务值、日志或注释，不直接作为固定界面文案渲染。
- `zh.json` 与 `en.json` 当前各 2714 个 key，集合一致；静态检查覆盖 2187 个 `$t`、`t`、`i18n.global.t` 引用，缺失 key 为 0。
- `git -C ui diff --check -- modules/iot-ui` 通过，构建产物未进入待提交变更。
- `npx vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 因工作区既有 700 余条 `jetlinks-web-core` 类型基线错误整体失败；过滤同一轮输出后，没有 `modules/iot-ui` 相关错误。
- `pnpm --filter jetlinks-web-core build -- --module-name iot-ui` 最终构建成功（7975 个模块，约 1 分钟）；仅有既有 CSS `//` 注释和大 chunk 警告。
- 根 `package.json`、`jetlinks-web-core/package.json` 和模块内未提供 lint 脚本，因此未执行独立 lint。当前环境未配置可直接进入关键页面的登录态，未执行浏览器中英文切换冒烟；语言包、静态引用、类型输出和生产构建已完成验证。
- 本次没有新增组件、页面壳层或交互流程；超过 300 行的已修改 Vue 文件均为既有大文件，本次只做局部文案替换，没有扩大其职责边界。用户在 `IotDeviceDataTableTab.vue` 中已有的 `j-ellipsis` 修改保持不变。
