# Device Manager UI

设备管理前端模块，提供设备、产品与物联告警等页面。菜单定义由 `baseMenu.ts` 加载 `baseMenu.json`。

物联告警菜单的数据权限由 `baseMenu.json` 声明，`iot` 和 `app` 两个入口的 `assetTypes` 均需包含 `user`，以支持通知对象的用户资产授权。更新定义后需同步已保存的菜单，并在角色或应用授权中配置用户资产范围；设备的“自己创建的”权限不会自动限制用户列表。验收时使用受限账号核对 `/user/detail/_query` 返回的通知对象范围，JSON 配置检查不能替代部署后的权限验证。
