import { defineAsyncComponent } from 'vue'
import { numericalInfoOneConfig } from './config'

const NumericalInfoOne = {
  name: 'numericalInfoOne',
  component: defineAsyncComponent(() => import('./NumericalInfoOne.vue'))
}

const NumericalInfoOneConfig = [
  {
    name: 'numericalInfoOne',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const NumericalInfoOneConfigProps = {
  ...numericalInfoOneConfig
}

export { NumericalInfoOne, NumericalInfoOneConfig, NumericalInfoOneConfigProps }
