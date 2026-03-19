import { request } from '@jetlinks-web/core'

// 工位列表（带 areaName）
export const queryWorkstation = (data?: Record<string, any>) =>
  request.post('/resource/workstation/detail/_query', data)

// 工位下拉
export const queryWorkstationNoPaging = (data?: Record<string, any>) =>
  request.post('/resource/workstation/detail/_query/no-paging', data)

// 工位详情（POST）
export const getWorkstationDetail = (id: string) =>
  request.post(`/resource/workstation/${id}/detail`)

// 工位配套设备列表（新接口：前端传条件，后端补占用状态）
export const queryWorkstationDevices = (workstationId: string, data?: Record<string, any>) => {
  const { terms: extraTerms, ...rest } = data || {}
  const terms: any[] = [
    {
      column: 'id',
      termType: 'resource-ws-bind',
      value: [{ column: 'workstationId', termType: 'eq', value: workstationId }]
    },
    ...(extraTerms || [])
  ]
  return request.post('/resource/workstation/devices/_query', { ...rest, terms })
}

// 查询某工位下未占用的设备（分页，用于申请占用下拉）
export const queryWorkstationFreeDevices = (
  workstationId: string,
  data?: Record<string, any>
) => {
  const { keyword, ...rest } = data || {}
  const terms: any[] = [
    {
      column: 'id',
      termType: 'resource-ws-bind',
      value: [{ column: 'workstationId', termType: 'eq', value: workstationId }]
    },
    {
      column: 'id',
      termType: 'resource-device-occupied',
      value: [],
      options: ['not']
    }
  ]
  if (keyword) {
    terms.push({ column: 'name', termType: 'like', value: keyword })
  }
  return request.post('/device-instance/detail/_query', { ...rest, terms })
}

// 设备 detail 分页查询（带 productName 等扩展字段）
export const queryDeviceDetail = (data?: Record<string, any>) =>
  request.post('/device-instance/detail/_query', data)

// 获取单台设备详情（含 metadata 物模型）
export const getDeviceDetail = (deviceId: string) =>
  request.get(`/device-instance/${deviceId}/detail`)

// 基础详情（GET，用于编辑回填，含 deviceIds）
export const getWorkstationBasic = (id: string) =>
  request.get(`/resource/workstation/${id}`)

// 绑定设备到工位
export const bindDevices = (workstationId: string, deviceIds: string[]) =>
  request.post(`/resource/workstation/${workstationId}/_bind`, deviceIds)

// 从工位解绑设备
export const unbindDevices = (workstationId: string, deviceIds: string[]) =>
  request.post(`/resource/workstation/${workstationId}/_unbind`, deviceIds)

export const saveWorkstation = (data: Record<string, any>) =>
  request.post('/resource/workstation', data)

export const updateWorkstation = (id: string, data: Record<string, any>) =>
  request.put(`/resource/workstation/${id}`, data)

export const deleteWorkstation = (id: string) =>
  request.remove(`/resource/workstation/${id}`)
