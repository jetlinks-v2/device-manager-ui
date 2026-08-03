import router from '@jetlinks-web-core/router'
import {
  createDomainAgentToolResult,
  resolveDomainAgentEnum,
  resolveDomainAgentMessage,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { GeneralAgentContext } from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getDeviceDetail_api } from '@device-manager-ui/api/device'
import { buildIotDeviceDetailPath } from '@device-manager-ui/views/device/list/hooks/useIotDeviceRouting'
import { IOT_DEVICE_OPEN_DETAIL_TABS } from './constants'
import {
  inputError,
  isDeviceDetailHandoffRequested,
  mapDevice,
  normalizeText,
  runDeviceTool,
} from './deviceAnalysis.shared'
import { prepareDeviceDetailHandoff } from './deviceHandoff.service'

export const deviceNavigationService = {
  openDetail: (args: Record<string, unknown>, context: GeneralAgentContext) => runDeviceTool<Record<string, unknown>>({}, async () => {
    const deviceId = normalizeText(args.deviceId)
    if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
    const tab = resolveDomainAgentEnum(args.tab, IOT_DEVICE_OPEN_DETAIL_TABS, { name: 'tab', defaultValue: 'overview' })
    const device = await getDeviceDetail_api(deviceId)
    if (!device) throw inputError('DEVICE_NOT_FOUND', 'deviceNotFound', { deviceId })
    const projectId = getProjectIdFromLocation()
    const path = buildIotDeviceDetailPath(projectId, deviceId, tab === 'overview' ? undefined : { tab })
    const handoffRequested = isDeviceDetailHandoffRequested(args.handoff)
    const handoffPrepared = handoffRequested && prepareDeviceDetailHandoff(device, path, context)
    await router.push(path)
    return createDomainAgentToolResult({
      domain: 'device',
      status: handoffRequested && !handoffPrepared ? 'partial' : undefined,
      summary: { opened: true, deviceId, deviceName: device.name, tab, handoffPrepared },
      data: { opened: true, path, device: mapDevice(device), handoffPrepared },
      warnings: handoffRequested && !handoffPrepared
        ? [resolveDomainAgentMessage('IotGeneralAgent.warnings.handoffUnavailable')]
        : undefined,
      navigation: [{
        kind: handoffPrepared ? 'handoff' : 'detail',
        label: device.name,
        path,
        menuCode: 'iot-user/device/list',
        subject: { type: 'device', id: device.id, name: device.name },
        requiresConfirmation: true,
      }],
    })
  }),
}
