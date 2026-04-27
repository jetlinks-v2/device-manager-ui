import { defineAsyncComponent } from 'vue'
import { propertySliderConfig } from './config'

const PropertySlider = {
  name: 'propertySlider',
  component: defineAsyncComponent(() => import('./PropertySlider.vue'))
}

const PropertySliderConfig = [
  {
    name: 'propertySlider',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertySliderConfigProps = {
  ...propertySliderConfig
}

export { PropertySlider, PropertySliderConfig, PropertySliderConfigProps }
