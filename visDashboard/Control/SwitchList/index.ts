import { defineAsyncComponent } from 'vue'
import { switchListConfig } from './config'

const SwitchList = {
  name: 'switchList',
  component: defineAsyncComponent(() => import('./SwitchList.vue'))
}

const SwitchListConfig = [
  {
    name: 'switchList',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const SwitchListConfigProps = {
  ...switchListConfig
}

export { SwitchList, SwitchListConfig, SwitchListConfigProps }