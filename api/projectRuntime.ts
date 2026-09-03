import { request } from '@jetlinks-web/core'

/**
 * 查询项目各服务当前的资源配额与用量。
 *
 * serviceIds 留空时由后端返回项目已开通服务的完整运行时信息，以便根据安装异常中的指标定位实际受限资源。
 */
export const queryProjectServiceRuntime_api = (projectId: string): Promise<unknown> =>
  request.get(
    `/console/project/${encodeURIComponent(projectId)}/service/runtime`,
    {},
    { projectContext: false, hiddenError: true },
  )
