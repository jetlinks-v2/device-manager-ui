
import { queryNoPagingPost } from '@device-manager-ui/api/product'
export default {
  apis: {
    productNoPage: queryNoPagingPost,
  },
  components: {
    AccessCard: defineAsyncComponent(() => import('./views/link/AccessConfig/components/AccessCard/index.vue')),
  }
}
