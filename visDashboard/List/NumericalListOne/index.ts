import { defineAsyncComponent } from 'vue'
import { numericalListOneConfig } from './config'

const NumericalListOne = {
  name: 'numericalListOne',
  component: defineAsyncComponent(() => import('./NumericalListOne.vue'))
}

const NumericalListOneConfig = [
  {
    name: 'numericalListOne',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const NumericalListOneConfigProps = {
  ...numericalListOneConfig
}

export { NumericalListOne, NumericalListOneConfig, NumericalListOneConfigProps }
