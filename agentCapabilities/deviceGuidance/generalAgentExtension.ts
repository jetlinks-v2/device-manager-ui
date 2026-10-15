import type { GeneralAgentExtension } from '@jetlinks-web-core/layout/components/AiChat/generalAgentExtensions'
import { DEVICE_GUIDANCE_PROVIDER_ID, deviceGuidanceHomeAgentProvider } from './homeAgentProvider'

export const deviceGuidanceGeneralAgentExtension: GeneralAgentExtension = {
  id: DEVICE_GUIDANCE_PROVIDER_ID,
  order: 20,
  provider: deviceGuidanceHomeAgentProvider,
}

export default deviceGuidanceGeneralAgentExtension
