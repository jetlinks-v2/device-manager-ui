import { request } from '@jetlinks-web/core'

// 标签分类(不分页)
export const queryTagCategoryNoPaging = (data: any) => request.post(`/tag/category/_query/no-paging`, data)

// 标签树
export const queryTagTree = (data: any) =>
  request.post(`/tag/_query/tree`, {
    paging: false,
    sorts: [{ name: 'sortIndex', order: 'asc' }],
    ...data,
  })

// 目标对象已绑定标签(用于回显)
export const getTagsByTarget = (targetType: string, targetId: string) =>
  request.get(`/tag/by-target/${targetType}/${targetId}/tags`)

// 保存绑定(覆盖)
export const bindTagsByTarget = (targetType: string, targetId: string, tagIds: string[]) =>
  request.put(`/tag/by-target/${targetType}/${targetId}`, tagIds)
