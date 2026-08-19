import { request } from '@jetlinks-web/core'

/**
 * 查询可用于创建产品的设备模板。
 *
 * 模板查询与详情都使用设备模板资源接口，避免页面依赖不存在的本地 API 模块。
 */
export const queryTemplateList = (data: Record<string, unknown>) =>
  request.post('/device/template/_query', data)

export const getTemplateDetail = (id: string) =>
  request.get(`/device/template/${encodeURIComponent(id)}`)
