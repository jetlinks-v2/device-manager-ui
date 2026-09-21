# 关系配置列表工具栏布局

状态：已实施并验证。

## 目标与范围

将“系统设置 > 平台管理 > 关系配置”改为与“运维中心 > 接入组件 > 网络组件”一致的列表表头：左侧为“关系配置”标题，右侧为现有条件搜索与新增操作。

Owning module 为 `runtime-ui/modules/device-manager-ui`；页面入口为 `views/system/Relationship/index.vue`。不修改关系配置接口、筛选字段、权限、编辑弹窗、删除操作、路由、共享表格或搜索组件，也不改动 `ui/`。

## 实施与验证

1. 使用 `headerLeftRender` 放置现有 i18n 标题，使用 `headerRightRender` 放置既有 `ConditionFilter` 和新增权限按钮。
2. 保持筛选条件回传、弹窗刷新和删除确认逻辑不变；局部样式仅用于复用网络组件的标题层级、工具栏间距和窄屏换行。
3. 已检查搜索、新增、编辑、删除和表格刷新仍复用原有逻辑；`pnpm -F jetlinks-web-core build -- --module-name device-manager-ui` 和目标文件 `git diff --check` 均通过。构建保留既有资源路径、Rollup `input` 配置、CSS `//` 注释及大包提示。
