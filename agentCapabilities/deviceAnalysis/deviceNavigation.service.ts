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

const resolveDeviceDetailTarget = async (args: Record<string, unknown>) => {
  const deviceId = normalizeText(args.deviceId)
  if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
  const tab = resolveDomainAgentEnum(args.tab, IOT_DEVICE_OPEN_DETAIL_TABS, { name: 'tab', defaultValue: 'overview' })
  const device = await getDeviceDetail_api(deviceId)
  if (!device) throw inputError('DEVICE_NOT_FOUND', 'deviceNotFound', { deviceId })
  const handoff = isDeviceDetailHandoffRequested(args.handoff)
  const projectId = getProjectIdFromLocation()
  const path = buildIotDeviceDetailPath(projectId, device.id, tab === 'overview' ? undefined : { tab })
  return { device, deviceId: device.id, handoff, path, tab }
}

export const deviceNavigationService = {
  prepareOpenDetail: async (args: Record<string, unknown>) => {
    const target = await resolveDeviceDetailTarget(args)
    const targetLabel = target.device.name
      ? `${target.device.name} (${target.device.id})`
      : target.device.id
    const confirmationType = target.handoff ? 'confirmHandoff' : 'confirm'
    return {
      arguments: {
        ...args,
        deviceId: target.deviceId,
        tab: target.tab,
        handoff: target.handoff,
      },
      confirmation: {
        title: resolveDomainAgentMessage(`IotGeneralAgent.tools.device_open_detail.${confirmationType}Title`),
        content: resolveDomainAgentMessage(
          `IotGeneralAgent.tools.device_open_detail.${confirmationType}Content`,
          [targetLabel],
        ),
      },
    }
  },

  openDetail: (args: Record<string, unknown>, context: GeneralAgentContext) => runDeviceTool<Record<string, unknown>>({}, async () => {
    // Device state and permission may change while confirmation is open, so the target is resolved again before dispatch.
    const target = await resolveDeviceDetailTarget(args)
    const handoffPrepared = target.handoff && prepareDeviceDetailHandoff(target.device, target.path, context)
    await router.push(target.path)
    return createDomainAgentToolResult({
      domain: 'device',
      status: target.handoff && !handoffPrepared ? 'partial' : undefined,
      summary: {
        opened: true,
        deviceId: target.deviceId,
        deviceName: target.device.name,
        tab: target.tab,
        handoffPrepared,
      },
      data: {
        opened: true,
        path: target.path,
        device: mapDevice(target.device),
        handoffPrepared,
      },
      warnings: target.handoff && !handoffPrepared
        ? [resolveDomainAgentMessage('IotGeneralAgent.warnings.handoffUnavailable')]
        : undefined,
      navigation: [{
        kind: handoffPrepared ? 'handoff' : 'detail',
        label: target.device.name,
        path: target.path,
        menuCode: 'iot-user/device/list',
        subject: { type: 'device', id: target.device.id, name: target.device.name },
        requiresConfirmation: true,
      }],
    })
  }),
}
