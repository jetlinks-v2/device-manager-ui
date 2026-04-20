import { defineAsyncComponent } from 'vue'
import { gauge2Config } from './config'

const Gauge2 = {
  name: 'gauge2',
  component: defineAsyncComponent(() => import('./Gauge2.vue'))
}

const Gauge2Config = [
  {
    name: 'gauge2',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const Gauge2ConfigProps = {
  ...gauge2Config
}

export { Gauge2, Gauge2Config, Gauge2ConfigProps }
