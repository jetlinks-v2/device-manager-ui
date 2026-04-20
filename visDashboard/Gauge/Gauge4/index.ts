import { defineAsyncComponent } from 'vue'
import { gauge4Config } from './config'

const Gauge4 = {
  name: 'gauge4',
  component: defineAsyncComponent(() => import('./Gauge4.vue'))
}

const Gauge4Config = [
  {
    name: 'gauge4',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const Gauge4ConfigProps = {
  ...gauge4Config
}

export { Gauge4, Gauge4Config, Gauge4ConfigProps }
