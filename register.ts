import { defineAsyncComponent } from 'vue'
import { queryNoPagingPost } from '@device-manager-ui/api/product'
import { queryNoPagingPost as queryInstanceNoPage, query } from '@device-manager-ui/api/instance'
import { usePluginPermissionContext } from '@device-manager-ui/hooks/usePermission'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import type { DataCapabilityProviderManifest } from '@jetlinks-web-core/data-capability'
import { IOT_DEVICE_ANALYSIS_EXTENSION_KEY } from './agentCapabilities/deviceAnalysis/constants'

type HomeAgentProviderLoader = () => Promise<unknown>

const toHomeAgentProviderKey = (path: string) => (
  path.replace('./views/', '').replace('/homeAgentProvider.ts', '')
)

const homeAgentProviderModules = import.meta.glob('./views/**/homeAgentProvider.ts') as Record<string, HomeAgentProviderLoader>
const homeAgentProviders = Object.fromEntries(
  Object.entries(homeAgentProviderModules).map(([path, loader]) => [
    toHomeAgentProviderKey(path),
    loader
  ])
)

export default {
  moduleId: 'device-manager-ui',
  apis: {
    productNoPage: queryNoPagingPost,
    instanceNoPage: queryInstanceNoPage,
    instancePage: query,
  },
  components: {
    AccessCard: defineAsyncComponent(() => import('./views/link/AccessConfig/components/AccessCard/index.vue')),
    // 跨模块对象详情复用同一设备接入实现，统一通过注册表公开，避免业务模块深层引用私有目录。
    IotDeviceAccessDetailTab: defineAsyncComponent(() => import('./views/device/list/components/device-detail/IotDeviceAccessDetailTab.vue')),
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
  homeAgentProviders,
  generalAgentExtensions: {
    [IOT_DEVICE_ANALYSIS_EXTENSION_KEY]: () => import('./agentCapabilities/deviceAnalysis/generalAgentExtension'),
  },
  dataCapabilityProviders: {
    deviceMonitoring: {
      capabilityIds: [
        'device.summary',
        'device.location.list',
        'device.runtime.trend',
        'device.category.distribution',
      ],
      loader: () => import('./dataCapabilities/deviceMonitoringProvider'),
    },
    deviceInstanceMonitoring: {
      capabilityIds: [
        'device.state.batch',
        'device.detail',
        'device.detail.page',
      ],
      loader: () => import('./dataCapabilities/deviceInstanceMonitoringProvider'),
    },
    deviceGroupMonitoring: {
      capabilityIds: [
        'device.group.list',
        'device.group.summary.batch',
        'device.group.devices.page',
        'device.group.options',
      ],
      loader: () => import('./dataCapabilities/deviceGroupMonitoringProvider'),
    },
  } satisfies DataCapabilityProviderManifest,
}
