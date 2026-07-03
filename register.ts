import { queryNoPagingPost } from '@device-manager-ui/api/product'
import { queryNoPagingPost as queryInstanceNoPage, query } from '@device-manager-ui/api/instance'
import { usePluginPermissionContext } from '@device-manager-ui/hooks/usePermission'
import { useInstanceStore } from '@device-manager-ui/store/instance'

const homeAgentProviderModules = import.meta.glob('./views/**/homeAgentProvider.ts')
const homeAgentProviders = Object.fromEntries(
  Object.entries(homeAgentProviderModules).map(([path, loader]) => [
    path.replace('./views/', '').replace('/homeAgentProvider.ts', ''),
    loader
  ])
)

export default {
  apis: {
    productNoPage: queryNoPagingPost,
    instanceNoPage: queryInstanceNoPage,
    instancePage: query,
  },
  components: {
    AccessCard: defineAsyncComponent(() => import('./views/link/AccessConfig/components/AccessCard/index.vue')),
    pluginPage: defineAsyncComponent(() => import('./views/link/plugin/Content.vue')),
    ProductPage: defineAsyncComponent(() => import('./views/device/Product/index.vue')),
    InstancePage: defineAsyncComponent(() => import('./views/device/Instance/index.vue')),
    InstanceDetailPage: defineAsyncComponent(() => import('./views/device/Instance/Detail/index.vue')),
  },
  hooks: {
    usePluginPermissionContext
  },
  stores: {
    useInstanceStore
  },
  homeAgentProviders
}
