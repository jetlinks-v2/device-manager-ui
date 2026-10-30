import type { IotDevice } from '../types'
import { createDeviceMetadataResolver } from '../../../../agentCapabilities/deviceAnalysis/deviceAnalysis.shared'
import { createDeviceDetailAccessService } from './deviceDetailAccess.service'
import { createDeviceDetailAlarmService } from './deviceDetailAlarm.service'
import { createDeviceDetailCommandService } from './deviceDetailCommand.service'
import { createDeviceDetailDiagnosticsService, type DeviceDetailAgentTabSurfaceOptions } from './deviceDetailDiagnostics.service'
import { createDeviceDetailEdgeService } from './deviceDetailEdge.service'
import { createDeviceDetailLogService } from './deviceDetailLog.service'
import { createDeviceDetailMetricsService } from './deviceDetailMetrics.service'
import { createDeviceDetailPropertyService } from './deviceDetailProperty.service'
import { createDeviceDetailTraceService } from './deviceDetailTrace.service'
import { queryDevicePropertyRules } from '../../../../agentCapabilities/deviceAnalysis/propertyRules/service'
import { runDetailTool } from './deviceDetailAgent.shared'
import type { PropertyRuleExplanation } from '../../../../agentCapabilities/deviceAnalysis/propertyRules/explain'
import { queryDeviceConnectionSessions } from '../../../../agentCapabilities/deviceAnalysis/deviceConnection.service'

export type DeviceDetailAgentServiceOptions = {
  tabSurface?: DeviceDetailAgentTabSurfaceOptions
  getDevice?: () => IotDevice
}

/** Composes subject-bound query and confirmed action capabilities after the detail permission check succeeds. */
export const createDeviceDetailAgentService = (
  device: IotDevice,
  options?: DeviceDetailAgentServiceOptions,
) => {
  // A replacement page object can refresh facts, but cannot switch this service's authorized subject.
  const getCurrentDevice = () => {
    const latest = options?.getDevice?.()
    return latest?.id === device.id ? latest : device
  }
  const resolveMetadata = createDeviceMetadataResolver(getCurrentDevice)
  const diagnostics = createDeviceDetailDiagnosticsService(device, options?.tabSurface, resolveMetadata, getCurrentDevice)
  const access = createDeviceDetailAccessService(device)
  const alarm = createDeviceDetailAlarmService(device)
  const commands = createDeviceDetailCommandService(device)
  const logs = createDeviceDetailLogService(device)
  const metrics = createDeviceDetailMetricsService(device)
  const properties = createDeviceDetailPropertyService(device, resolveMetadata)
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
    connectionSessions: () => queryDeviceConnectionSessions(device.id),
    // The verified host owns identity and metadata; tool arguments cannot switch to another device.
    propertyRules: (args: Record<string, unknown>) => runDetailTool<PropertyRuleExplanation[]>([], async () => {
      const current = getCurrentDevice()
      const { metadata } = await resolveMetadata(device.id)
      return queryDevicePropertyRules({ id: device.id, productId: current.productId ?? current.productKey ?? '',
        properties: metadata.properties }, args)
    }),
    traceCapture: trace.capture,
    dispose: trace.dispose,
  }
}
