import { defineAsyncComponent } from 'vue'
import { gauge1Config } from './config'

const Gauge1 = {
  name: 'gauge1',
  component: defineAsyncComponent(() => import('./Gauge1.vue'))
}

const Gauge1Config = [
  {
    name: 'gauge1',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const Gauge1ConfigProps = {
  ...gauge1Config
}

export { Gauge1, Gauge1Config, Gauge1ConfigProps }
