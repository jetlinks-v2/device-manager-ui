import type { IotDevice } from '../types'
import { createDeviceDetailAccessService } from './deviceDetailAccess.service'
import { createDeviceDetailAlarmService } from './deviceDetailAlarm.service'
import { createDeviceDetailDiagnosticsService } from './deviceDetailDiagnostics.service'
import { createDeviceDetailLogService } from './deviceDetailLog.service'
import { createDeviceDetailMetricsService } from './deviceDetailMetrics.service'
import { createDeviceDetailPropertyService } from './deviceDetailProperty.service'
import { createDeviceDetailTraceService } from './deviceDetailTrace.service'

/** Composes subject-bound read-only capabilities after the detail permission check succeeds. */
export const createDeviceDetailAgentService = (device: IotDevice) => {
  const diagnostics = createDeviceDetailDiagnosticsService(device)
  const access = createDeviceDetailAccessService(device)
  const alarm = createDeviceDetailAlarmService(device)
  const logs = createDeviceDetailLogService(device)
  const metrics = createDeviceDetailMetricsService(device)
  const properties = createDeviceDetailPropertyService(device)
  const trace = createDeviceDetailTraceService(device.id)

  return {
    ...diagnostics,
    ...access,
    ...alarm,
    ...logs,
    ...metrics,
    ...properties,
    traceCapture: trace.capture,
    dispose: trace.dispose,
  }
}
