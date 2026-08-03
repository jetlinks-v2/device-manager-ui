import { saveAiAgentHandoff } from '@jetlinks-web-core/layout/components/AiChat/agentHandoff'
import type { GeneralAgentContext } from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import type { IotDevice } from '@device-manager-ui/views/device/list/types'
import { normalizeText } from './deviceAnalysis.shared'

const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'
const DEVICE_DETAIL_MENU_CODE = 'iot-user/device/list'

/** Prepares one bounded continuation without navigating away from the general assistant. */
export const prepareDeviceDetailHandoff = (
  device: IotDevice,
  path: string,
  context: GeneralAgentContext,
) => {
  const prompt = normalizeText(context.latestUserMessage?.content).slice(0, 1000)
  if (!prompt) return false
  return saveAiAgentHandoff({
    clientId: DEVICE_DETAIL_AGENT_CLIENT_ID,
    subjectType: 'device',
    subjectId: device.id,
    subjectName: device.name,
    prompt,
    context: { deviceId: device.id, deviceName: device.name },
    source: 'project-ai-search-hub',
    menuCode: DEVICE_DETAIL_MENU_CODE,
    path,
  })
}
