
import { queryNoPagingPost } from '@device-manager-ui/api/product'
import * as deviceHooks from '@device-manager-ui/hooks'

export default {
  apis: {
    productNoPage: queryNoPagingPost,
  },
  hooks: {
      ...deviceHooks
  },
  components: {
    Device: defineAsyncComponent(() => import('./components/Device/index.vue')),
    Product: defineAsyncComponent(() => import('./components/Product/index.vue'))
  },
}
