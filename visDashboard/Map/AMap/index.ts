import { defineAsyncComponent } from 'vue'
import { amapConfig } from './config'

const AMap = {
  name: 'amap',
  component: defineAsyncComponent(() => import('./AMap.vue'))
}

const AMapConfig = [
  {
    name: 'amap',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const AMapConfigProps = {
  ...amapConfig
}

export { AMap, AMapConfigProps, AMapConfig }
