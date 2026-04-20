import { defineAsyncComponent } from 'vue'
import { gauge3Config } from './config'

const Gauge3 = {
  name: 'gauge3',
  component: defineAsyncComponent(() => import('./Gauge3.vue'))
}

const Gauge3Config = [
  {
    name: 'gauge3',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const Gauge3ConfigProps = {
  ...gauge3Config
}

export { Gauge3, Gauge3Config, Gauge3ConfigProps }
