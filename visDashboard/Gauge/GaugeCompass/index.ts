import { defineAsyncComponent } from 'vue'
import { gaugeCompassConfig } from './config'

const GaugeCompass = {
  name: 'gaugeCompass',
  component: defineAsyncComponent(() => import('./GaugeCompass.vue'))
}

const GaugeCompassConfig = [
  {
    name: 'gaugeCompass',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const GaugeCompassConfigProps = {
  ...gaugeCompassConfig
}

export { GaugeCompass, GaugeCompassConfig, GaugeCompassConfigProps }
