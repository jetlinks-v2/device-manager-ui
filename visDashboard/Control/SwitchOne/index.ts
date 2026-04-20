import { defineAsyncComponent } from 'vue'
import { switchOneConfig } from './config'

const SwitchOne = {
  name: 'switchOne',
  component: defineAsyncComponent(() => import('./SwitchOne.vue'))
}

const SwitchOneConfig = [
  {
    name: 'switchOne',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const SwitchOneConfigProps = {
  ...switchOneConfig
}

export { SwitchOne, SwitchOneConfig,SwitchOneConfigProps }