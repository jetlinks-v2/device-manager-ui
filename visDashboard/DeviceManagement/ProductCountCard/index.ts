import { defineAsyncComponent } from 'vue'
import { productCountCardConfig } from './config'

const ProductCountCard = {
  name: 'productCountCard',
  component: defineAsyncComponent(() => import('./ProductCountCard.vue'))
}

const ProductCountCardConfig = [
  {
    name: 'productCountCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const ProductCountCardConfigProps = {
  ...productCountCardConfig
}

export { ProductCountCard, ProductCountCardConfig, ProductCountCardConfigProps }
