import {request} from "@jetlinks-web/core";

export const save = (data: any) => request.post(`/data/messaging`, data);

export const update = (data: any) => request.patch(`/data/messaging`, data);

export const modify = (id: string, data: any) => request.put(`/data/messaging/${id}`, data);

export const query = (data: any) => request.post(`/data/messaging/detail/_query`, data);

export const queryDetailById = (id: any) => request.get(`/data/messaging/${id}`);

export const remove = (id: any) => request.remove(`/data/messaging/${id}`);
// 获取订阅类型
export const queryProviders = () => request.get(`/data/messaging/subscriber/providers`);
// 获取推送类型
export const queryWriterProviders = () => request.get(`/data/messaging/writer/providers`);

export const queryWriterConfigType = () => request.get(`/dictionary/http-write-type/items`);

