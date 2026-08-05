import { defineAsyncComponent } from 'vue'
import { switchStatusOneConfig } from './config'

const SwitchStatusOne = {
  name: 'switchStatusOne',
  component: defineAsyncComponent(() => import('./SwitchStatusOne.vue'))
}

const SwitchStatusOneConfig = [
  {
    name: 'switchStatusOne',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const SwitchStatusOneConfigProps = {
  ...switchStatusOneConfig
}

export { SwitchStatusOne, SwitchStatusOneConfig, SwitchStatusOneConfigProps }
