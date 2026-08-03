import { IOT_DEVICE_ANALYSIS_EXTENSION_KEY } from './agentCapabilities/deviceAnalysis/constants'

export default {
  apis: {},
  components: {},
  generalAgentExtensions: {
    [IOT_DEVICE_ANALYSIS_EXTENSION_KEY]: () => import('./agentCapabilities/deviceAnalysis/generalAgentExtension'),
  },
}
