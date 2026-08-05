import { defineAsyncComponent } from 'vue'
import { switchTwoConfig } from './config'

const SwitchTwo = {
  name: 'switchTwo',
  component: defineAsyncComponent(() => import('./SwitchTwo.vue'))
}

const SwitchTwoConfig = [
  {
    name: 'switchTwo',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const SwitchTwoConfigProps = {
  ...switchTwoConfig
}

export { SwitchTwo, SwitchTwoConfig,SwitchTwoConfigProps }