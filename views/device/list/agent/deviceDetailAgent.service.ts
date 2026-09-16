import type { IotDevice } from '../types'
import { createDeviceDetailAccessService } from './deviceDetailAccess.service'
import { createDeviceDetailAlarmService } from './deviceDetailAlarm.service'
import { createDeviceDetailCommandService } from './deviceDetailCommand.service'
import { createDeviceDetailDiagnosticsService, type DeviceDetailAgentTabSurfaceOptions } from './deviceDetailDiagnostics.service'
import { createDeviceDetailEdgeService } from './deviceDetailEdge.service'
import { createDeviceDetailLogService } from './deviceDetailLog.service'
import { createDeviceDetailMetricsService } from './deviceDetailMetrics.service'
import { createDeviceDetailPropertyService } from './deviceDetailProperty.service'
import { createDeviceDetailTraceService } from './deviceDetailTrace.service'

export type DeviceDetailAgentServiceOptions = {
  tabSurface?: DeviceDetailAgentTabSurfaceOptions
}

/** Composes subject-bound query and confirmed action capabilities after the detail permission check succeeds. */
export const createDeviceDetailAgentService = (
  device: IotDevice,
  options?: DeviceDetailAgentServiceOptions,
) => {
  const diagnostics = createDeviceDetailDiagnosticsService(device, options?.tabSurface)
  const access = createDeviceDetailAccessService(device)
  const alarm = createDeviceDetailAlarmService(device)
  const commands = createDeviceDetailCommandService(device)
  const logs = createDeviceDetailLogService(device)
  const metrics = createDeviceDetailMetricsService(device)
  const properties = createDeviceDetailPropertyService(device)
  const trace = createDeviceDetailTraceService(device.id)
  const edge = createDeviceDetailEdgeService(() => device)

  return {
    ...diagnostics,
    ...access,
    ...alarm,
    ...logs,
    ...metrics,
    ...properties,
    ...commands,
    ...edge,
    traceCapture: trace.capture,
    dispose: trace.dispose,
  }
}
