import { saveAiAgentHandoff } from '@jetlinks-web-core/layout/components/AiChat/agentHandoff'
import type { GeneralAgentContext } from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import type { IotDevice } from '@device-manager-ui/views/device/list/types'
import { normalizeText } from './deviceAnalysis.shared'
import { findDeviceAgentMenu } from '../deviceMenus'

const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'

/** Prepares one bounded continuation without navigating away from the general assistant. */
export const prepareDeviceDetailHandoff = (
  device: IotDevice,
  path: string,
  context: GeneralAgentContext,
) => {
  const prompt = normalizeText(context.latestUserMessage?.content).slice(0, 1000)
  const menu = findDeviceAgentMenu(context, 'instance')
  if (!prompt || !menu) return false
  return saveAiAgentHandoff({
    clientId: DEVICE_DETAIL_AGENT_CLIENT_ID,
    subjectType: 'device',
    subjectId: device.id,
    subjectName: device.name,
    prompt,
    context: { deviceId: device.id, deviceName: device.name },
    source: 'project-ai-search-hub',
    menuCode: menu.code,
    path,
  })
}
