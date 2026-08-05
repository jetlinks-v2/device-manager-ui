import { defineAsyncComponent } from 'vue'
import { enumerationConfig } from './config'

const Enumeration = {
  name: 'enumeration',
  component: defineAsyncComponent(() => import('./Enumeration.vue'))
}

const EnumerationConfig = [
  {
    name: 'enumeration',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const EnumerationConfigProps = {
  ...enumerationConfig
}

export { Enumeration, EnumerationConfig,EnumerationConfigProps }