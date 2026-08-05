// 仪表盘数据
import { request } from '@jetlinks-web/core'
/**
 * 项目数量
 */
export const productCount = (data?:any) => request.post(`/device-product/_count`,data);
/**
 * 设备数量
 */
export const deviceCount = (data?: any, config?: Record<string, unknown>) =>
  config
    ? request.get('/device/instance/_count', data, config)
    : request.get('/device/instance/_count', data);
/**
 * 当前在线
 */
export const dashboard = (data?: any, config?: Record<string, unknown>) =>
  config
    ? request.post('/dashboard/_multi', data, config)
    : request.post('/dashboard/_multi', data);
/**
 * 地图数据
 */
export const getGo = (data?:any) => request.post('/geo/object/device/_search/geo.json',data)

export const getDeviceGeoJson = (data?: any, config?: Record<string, unknown>) =>
  config
    ? request.post('/geo/object/device/_search/_page', data, config)
    : request.post('/geo/object/device/_search/_page', data)
