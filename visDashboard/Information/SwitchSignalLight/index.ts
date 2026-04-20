import { defineAsyncComponent } from 'vue'
import { switchSignalLightConfig } from './config'

const SwitchSignalLight = {
  name: 'switchSignalLight',
  component: defineAsyncComponent(() => import('./SwitchSignalLight.vue'))
}

const SwitchSignalLightConfig = [
  {
    name: 'switchSignalLight',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const SwitchSignalLightConfigProps = {
  ...switchSignalLightConfig
}

export { SwitchSignalLight, SwitchSignalLightConfig, SwitchSignalLightConfigProps }
