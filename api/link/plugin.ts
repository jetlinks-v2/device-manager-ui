import { request } from '@jetlinks-web/core'
import {getBaseApi} from "@jetlinks-web-core/utils";
import { createPluginDriverUpload } from './pluginInstall';
import { postRuntimeNdJson } from '@jetlinks-web-core/utils/ndjson-precision'
import type { PluginDriverRecord } from './pluginRuntime'
import { pluginListRequest, type PluginListQuery, type PluginListCursor } from './pluginListQuery'

const pluginUploadPath = '/plugin/driver/upload';

export const queryPage = (data: any) => request.post(`/plugin/driver/_query`, data)

export const streamPlugins = (query: PluginListQuery, cursor?: PluginListCursor) =>
  postRuntimeNdJson<PluginDriverRecord>('/plugin/driver/_query/no-paging', pluginListRequest(query, cursor))

export const uploadFile = () => `${getBaseApi()}${pluginUploadPath}`

// 文件传输与节点检查分阶段进行，保持统一请求上下文和最终解析结果。
export const uploadPluginFile = createPluginDriverUpload();

// 原生检查和应用由服务端按有效进度判定停滞，避免全局短超时误报保存失败。
export const add = (data: any) => request.post('/plugin/driver', data, { timeout: 0 })

export const update = (data: any) => request.patch('/plugin/driver', data, { timeout: 0 })

export const removeFn = (id: string) => request.remove(`/plugin/driver/${id}`)

export const detail = (id: string) => request.get(`/plugin/driver/${id}`)

/**
 * 获取插件支持的产品信息
 * 用于在产品选择接入方式后，选择产品类型。
 * 即将平台中当前产品与插件中指定的产品绑定，然后把插件的物模型保存到产品并且绑定产品ID映射关系
 * @param id
 */
export const getProductsById = (id: string) => request.get(`/plugin/driver/${id}/products`)

/**
 *
 * @param type product：产品;device：设备
 * @param pluginId 设备接入id
 * @param internalId 产品或者设备id
 * @param externalId  映射id
 */
export const savePluginData = (type: string, pluginId: string, internalId: string, externalId: string ) => request.patch(`/plugin/mapping/${type}/${pluginId}/${internalId}`, externalId, { headers: {'Content-Type': "text/plain"}})

export const getPluginData = (type: string, pluginId: string, internalId: string ) => request.get(`/plugin/mapping/${type}/${pluginId}/${internalId}`)

export const getPublic = (id: string, path: string) => request.get(`/plugin/driver/${id}/${path}`)

// export const getTypes = () => request.get(`/dictionary/internal-plugin-type/items`)
export const getTypes = () => request.get(`/plugin/driver/types`)

/**
 * 当前环境支持的插件安装方式（jar / marketplace 等），用于前端过滤来源选项。
 * 返回结构：result 为字符串数组，如 ["jar","marketplace"]
 */
export const getProviders = () => request.get(`/plugin/driver/providers`)

export const vailIdFn = (id: string ) => request.get(`/plugin/driver/id/_validate`, { id })

export const getProductByPluginId = (id: string) => request.get(`/plugin/driver/${id}/products`)

/**
 * POST /marketplace/capabilities/{type}/{capId}/installed
 * body: 资源 id 列表（可为空数组）
 */
export const listInstalledMarketplaceResources = (
    type: string,
    capId: string,
    resourceIds: string[],
) =>
    request.post(
        `/marketplace/capabilities/${encodeURIComponent(type)}/${encodeURIComponent(capId)}/installed`,
        resourceIds,
    )
