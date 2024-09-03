import { post, get, remove, patch } from '@/utils/request'
import { BASE_API_PATH } from '@/utils/variable';

export const queryPage = (data: any) => post(`/plugin/driver/_query`, data)

export const uploadFile = `${BASE_API_PATH}/plugin/driver/upload`

export const add = (data: any) => post('/plugin/driver', data)

export const update = (data: any) => patch('/plugin/driver', data)

export const removeFn = (id: string) => remove(`/plugin/driver/${id}`)

export const detail = (id: string) => get(`/plugin/driver/${id}`)

/**
 * 获取插件支持的产品信息
 * 用于在产品选择接入方式后，选择产品类型。
 * 即将平台中当前产品与插件中指定的产品绑定，然后把插件的物模型保存到产品并且绑定产品ID映射关系
 * @param id
 */
export const getProductsById = (id: string) => get(`/plugin/driver/${id}/products`)

/**
 *
 * @param type product：产品;device：设备
 * @param pluginId 设备接入id
 * @param internalId 产品或者设备id
 * @param externalId  映射id
 */
export const savePluginData = (type: string, pluginId: string, internalId: string, externalId: string ) => patch(`/plugin/mapping/${type}/${pluginId}/${internalId}`, externalId, { headers: {'Content-Type': "text/plain"}})

export const getPluginData = (type: string, pluginId: string, internalId: string ) => get(`/plugin/mapping/${type}/${pluginId}/${internalId}`)

export const getPublic = (id: string, path: string) => get(`/plugin/driver/${id}/${path}`)

export const getTypes = () => get(`/dictionary/internal-plugin-type/items`)

export const vailIdFn = (id: string ) => get(`/plugin/driver/id/_validate`, { id })

export const getProductByPluginId = (id: string) => get(`/plugin/driver/${id}/products`)