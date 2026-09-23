import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

/**
 * 执行命令
 * @param serviceId 服务id
 * @param commandId 命令id
 * @param projectId 项目id
 * @param data 命令参数
 * @returns
 */
export const executeCommand = (serviceId: string, commandId: string, projectId: string, data: any = {}) => {
  const { request } = moduleRegistry.getResource('visualization-manager-ui', 'utils')
  return request.post(`/visualization/command-supports/${serviceId}/${commandId}/${projectId}/execute `, data)
}
