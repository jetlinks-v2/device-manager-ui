// 产品分类
import { request } from '@jetlinks-web/core'
import type { DataCapabilityRequest } from '@jetlinks-web-core/data-capability'
import type { CategoryItem } from '../views/device/Category/typings'

export interface ProductCategoryTreeStatistics {
  categories: Array<CategoryItem & { productCount?: number }>
  total: number
  unclassified: number
}
/**
 * 查询产品分类树形数据
 */

export const queryTree = (params?: Record<string, any>, config?: Record<string, unknown>, client: DataCapabilityRequest = request) =>
  config
    ? client.post<CategoryItem>('/device/category/_tree', params, config)
    : client.post<CategoryItem>('/device/category/_tree', params)

/** 查询当前用户可见产品的分类树及各分类范围数量。 */
export const queryTreeStatistics = (params?: Record<string, any>) =>
  request.post<ProductCategoryTreeStatistics>('/device/category/_tree/_statistics', params)

/**
 * 保存树形数据
 */
 export const saveTree = (data: any) => request.post('/device/category', data)


 /**
  * 根据Id修改
  */
 export const updateTree = (id:string,data: any,) => request.put(`/device/category/${id}`, data)

 /**
  * 根据Id删除数据
  */

 export const deleteTree = (id:string) => request.remove(`/device/category/${id}`)
