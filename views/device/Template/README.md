# 产品模板模块

## 概述

产品模板模块用于管理设备产品模板，提供模板的创建、编辑、查看、删除、启用/禁用等功能。

## 功能特性

- ✅ 模板列表展示（支持搜索、筛选、分页）
- ✅ 创建新模板
- ✅ 编辑模板
- ✅ 查看模板详情
- ✅ 删除模板
- ✅ 启用/禁用模板
- ✅ 权限控制
- ✅ 国际化支持（中英文）

## 目录结构

```
Template/
├── index.vue              # 列表页面
├── typings.d.ts          # 类型定义
├── Detail/               # 详情页面
│   ├── index.vue         # 详情主页面
│   └── BasicInfo/        # 基本信息组件
│       └── index.vue
├── Save/                 # 新增/编辑页面
│   └── index.vue
└── README.md            # 说明文档
```

## API接口

所有API接口定义在 `api/template.ts` 文件中：

- `queryTemplateList(data)` - 查询模板列表（分页）
- `queryNoPaging(data)` - 查询模板列表（不分页）
- `getTemplateDetail(id)` - 获取模板详情
- `createTemplate(data)` - 创建模板
- `updateTemplate(data)` - 更新模板
- `deleteTemplate(id)` - 删除模板
- `deployTemplate(id)` - 启用模板
- `undeployTemplate(id)` - 禁用模板

## 权限配置

模块使用以下权限标识：

- `device-template:query` - 查询权限
- `device-template:save` - 新增/编辑权限
- `device-template:delete` - 删除权限

## 路由配置

需要在路由配置中添加以下路由：

```typescript
{
  path: '/iot/device/Template',
  name: 'DeviceTemplate',
  component: () => import('./views/device/Template/index.vue'),
  meta: {
    title: '产品模板',
    permission: 'device-template:query'
  }
},
{
  path: '/iot/device/Template/Detail/:id',
  name: 'DeviceTemplateDetail',
  component: () => import('./views/device/Template/Detail/index.vue'),
  meta: {
    title: '模板详情',
    permission: 'device-template:query'
  }
},
{
  path: '/iot/device/Template/Save',
  name: 'DeviceTemplateSave',
  component: () => import('./views/device/Template/Save/index.vue'),
  meta: {
    title: '新增/编辑模板',
    permission: 'device-template:save'
  }
}
```

## 使用说明

### 1. 查看模板列表

访问 `/iot/device/Template` 路径即可查看所有产品模板列表。

### 2. 创建模板

1. 点击列表页面的"新增"按钮
2. 填写模板名称（必填）
3. 选择所属分类（可选）
4. 填写说明（可选）
5. 点击"提交"按钮

### 3. 编辑模板

1. 在列表页面点击某个模板的"编辑"按钮
2. 修改模板信息
3. 点击"提交"按钮

### 4. 查看详情

在列表页面点击某个模板的"查看"按钮，即可查看模板的详细信息。

### 5. 删除模板

1. 确保模板状态为"禁用"
2. 点击列表页面的"删除"按钮
3. 在确认对话框中点击"确定"

### 6. 启用/禁用模板

点击列表页面或详情页面的"启用"/"禁用"按钮即可切换模板状态。

## 注意事项

1. 只有状态为"禁用"的模板才能被删除
2. 模板名称最长64个字符
3. 模板说明最长200个字符
4. 所有操作都需要相应的权限

## 开发说明

### 状态管理

模块使用Pinia进行状态管理，store定义在 `store/template.ts` 文件中。

### 国际化

国际化文件位于：
- 中文：`locales/lang/zh_CN/template.ts`
- 英文：`locales/lang/en_US/template.ts`

### 类型定义

所有TypeScript类型定义在 `typings.d.ts` 文件中。

## 后续扩展

可以根据需要扩展以下功能：

- [ ] 物模型配置展示
- [ ] 设备接入信息展示
- [ ] 基于模板创建产品
- [ ] 模板导入/导出
- [ ] 模板复制功能
