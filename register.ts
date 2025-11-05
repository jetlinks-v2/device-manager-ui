import { queryNoPagingPost } from '@device-manager-ui/api/product'
import { usePluginPermissionContext } from '@device-manager-ui/hooks/usePermission'

export default {
  apis: {
    productNoPage: queryNoPagingPost,
  },
  components: {
    AccessCard: defineAsyncComponent(() => import('./views/link/AccessConfig/components/AccessCard/index.vue')),
    pluginPage: defineAsyncComponent(() => import('./views/link/plugin/index.vue')),

  },
  hooks: {
    usePluginPermissionContext
  }
}
