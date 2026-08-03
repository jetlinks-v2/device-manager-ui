import type { GeneralAgentExtension } from '@jetlinks-web-core/layout/components/AiChat/generalAgentExtensions'
import { IOT_DEVICE_ANALYSIS_PROVIDER_ID } from './constants'
import { iotDeviceAnalysisGeneralAgentProvider } from './generalAgentProvider'

export const iotDeviceAnalysisGeneralAgentExtension: GeneralAgentExtension = {
  id: IOT_DEVICE_ANALYSIS_PROVIDER_ID,
  order: 10,
  provider: iotDeviceAnalysisGeneralAgentProvider,
}

export default iotDeviceAnalysisGeneralAgentExtension
