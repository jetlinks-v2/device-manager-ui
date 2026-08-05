import { request } from '@jetlinks-web/core'

/**
 * 当前环境支持的协议注册方式（jar / local / marketplace 等），用于前端过滤类型选项。
 * 返回结构：result 为字符串数组，如 ["jar","local","marketplace"]
 */
export const getProtocolProviders = () => request.get(`/protocol/providers`);

export const save = (data: Object) => request.post(`/protocol`, data);

/** 更新协议：PUT /protocol/{id}，请求体需包含 id 及待更新字段 */
export const update = (id: string, data: Object) =>
    request.put(`/protocol/${encodeURIComponent(id)}`, data);

export const list = (data: Object) => request.post(`/protocol/_query`, data);

export const remove = (id: string) => request.remove(`/protocol/${id}`);

export const querySystemApi = (data: Object) =>
    request.post(`/system/config/scopes`, data);

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
    );
