import dataCapabilityProviders from './dataCapabilities'
import { deviceMetricsSupported, deviceMetricsAggregate, deviceOverviewSummary } from './runtimeMetrics'
import { defineAsyncComponent } from 'vue'
import objectPresentations from './objectPresentations'
import { deviceAssetRelationBindings } from './assetRelationBindings'
import i18n from '@jetlinks-web-core/locales'
import type { DeviceDetailTabProvider } from './deviceDetailProvider'
import { queryNoPagingPost } from '@device-manager-ui/api/product'
import { queryNoPagingPost as queryInstanceNoPage, query } from '@device-manager-ui/api/instance'
import { usePluginPermissionContext } from '@device-manager-ui/hooks/usePermission'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useDeviceScope } from './deviceScope'
import { useSystemMonitorOverview } from './visDashboard/SystemMonitor/hooks/useSystemMonitorOverview'
import { getDeviceListSearchTerms } from './deviceListFilter'
import { queryDeviceSpaceAreaBindings_api } from './api/spaceArea'
import { queryDeviceBoundGroups_api, queryRuntimeDevices_api } from './api/deviceGroup'
import type { DataCapabilityProviderManifest } from '@jetlinks-web-core/data-capability'
import type { AgentCapabilityProviderResource } from '@jetlinks-web-core/layout/components/AiChat/routeCapabilityLoader'
import {
  IOT_DEVICE_ANALYSIS_EXTENSION_KEY,
  IOT_DEVICE_MENU_ANCHORS,
} from './agentCapabilities/deviceAnalysis/constants'
import { DEVICE_GUIDANCE_MENU_CODES } from './agentCapabilities/deviceGuidance/homeAgentProvider'
import { DEVICE_AGENT_MENU_CODES, DEVICE_AGENT_MENU_PATHS } from './agentCapabilities/deviceMenus'

type HomeAgentProviderLoader = () => Promise<unknown>

const toHomeAgentProviderKey = (path: string) => (
  path.replace('./views/', '').replace('/homeAgentProvider.ts', '')
)

const homeAgentProviderMenus: Record<string, { codes: readonly string[], paths: readonly string[] }> = {
  'device/Instance': { codes: DEVICE_AGENT_MENU_CODES.instance, paths: DEVICE_AGENT_MENU_PATHS.instance },
  'device/Product': { codes: DEVICE_AGENT_MENU_CODES.product, paths: DEVICE_AGENT_MENU_PATHS.product },
  'device/DashBoard': {
    codes: [...DEVICE_AGENT_MENU_CODES.dashboard, ...DEVICE_AGENT_MENU_CODES.instance],
    paths: [...DEVICE_AGENT_MENU_PATHS.dashboard, ...DEVICE_AGENT_MENU_PATHS.instance],
  },
  'device/Domain': {
    codes: [...DEVICE_AGENT_MENU_CODES.instance, ...DEVICE_AGENT_MENU_CODES.product],
    paths: [...DEVICE_AGENT_MENU_PATHS.instance, ...DEVICE_AGENT_MENU_PATHS.product],
  },
}

const homeAgentProviderModules = import.meta.glob('./views/**/homeAgentProvider.ts') as Record<string, HomeAgentProviderLoader>
const homeAgentProviders = Object.fromEntries(
  Object.entries(homeAgentProviderModules).map(([path, loader]) => {
    const key = toHomeAgentProviderKey(path)
    const { codes, paths } = homeAgentProviderMenus[key]
    return [key, {
      loader,
      activation: {
        version: 'general-agent-provider-activation/v1',
        scopes: [
          { kind: 'menuCode', values: [...codes] },
          { kind: 'routeName', values: [...codes] },
          { kind: 'path', values: [...paths] },
        ],
      },
    } satisfies AgentCapabilityProviderResource]
  })
)

export default {
  assetRelationBindings: deviceAssetRelationBindings,
  moduleId: 'device-manager-ui',
  objectPresentations,
  dataCapabilityProviders,
  // 复用设备级映射页面，显示条件与 2.12 详情及产品的协议能力判断保持一致。
  deviceDetailTabs: {
    MetadataMap: {
      key: 'MetadataMap',
      label: () => i18n.global.t('Detail.index.957187-25'),
      icon: 'SwapOutlined',
      order: 20,
      matches: device => Boolean(device.features?.some(feature => feature.id === 'diffMetadataSameProduct')),
      component: defineAsyncComponent(() => import('./views/device/Instance/Detail/MetadataMap/index.vue')),
    } satisfies DeviceDetailTabProvider,
    GateWay: {
      key: 'GateWay',
      label: () => i18n.global.t('Detail.index.957187-22'),
      icon: 'DeploymentUnitOutlined',
      order: 30,
      matches: device => device.protocol === 'collector-gateway',
      component: defineAsyncComponent(() => import('./views/device/Instance/Detail/GateWay/index.vue')),
    } satisfies DeviceDetailTabProvider,
  },
  apis: {
    deviceMetricsSupported,
    deviceMetricsAggregate,
    deviceOverviewSummary,
    deviceListSearchTerms: getDeviceListSearchTerms,
    deviceSpaceAreaBindings: queryDeviceSpaceAreaBindings_api,
    deviceBoundGroups: queryDeviceBoundGroups_api,
    deviceRuntimePage: queryRuntimeDevices_api,
    productNoPage: queryNoPagingPost,
    instanceNoPage: queryInstanceNoPage,
    instancePage: query
  },
  components: {
    DeviceDetailActions: defineAsyncComponent(() => import('./views/device/list/components/device-detail/DeviceDetailActions.vue')),
    IotDeviceDetailView: defineAsyncComponent(() => import('./views/device/list/components/IotDeviceDetailView.vue')),
    IotCardDetail: defineAsyncComponent(() => import('./views/device/Instance/components/IotCard/index.vue')),
    DeviceDetailAgentHost: defineAsyncComponent(() => import('./views/device/list/agent/DeviceDetailAgentHost.vue')),
    IotAddDeviceDrawer: defineAsyncComponent(() => import('./views/device/list/components/IotAddDeviceDrawer.vue')),
    UnifiedDeviceList: defineAsyncComponent(() => import('./views/device/list/unified/index.vue')),
    IotDeviceScopeSidebar: defineAsyncComponent(() => import('./views/device/list/components/IotDeviceScopeSidebar.vue')),
    IotDeviceAssetSearchBar: defineAsyncComponent(() => import('./views/device/list/components/IotDeviceAssetSearchBar.vue')),
    // 网关详情复用 2.12 云边子设备映射，设备身份由宿主显式传入。
    DeviceChildMapping: defineAsyncComponent(() => import('./views/device/Instance/Detail/Child/DeviceChildMapping.vue')),
    AccessCard: defineAsyncComponent(() => import('./views/link/AccessConfig/components/AccessCard/index.vue')),
    // 跨模块对象详情复用同一设备接入实现，统一通过注册表公开，避免业务模块深层引用私有目录。
    IotDeviceAccessDetailTab: defineAsyncComponent(() => import('./views/device/list/components/device-detail/IotDeviceAccessDetailTab.vue')),
    pluginPage: defineAsyncComponent(() => import('./views/link/plugin/Content.vue')),
    ProductPage: defineAsyncComponent(() => import('./views/device/Product/index.vue')),
    InstancePage: defineAsyncComponent(() => import('./views/device/Instance/index.vue')),
    InstanceDetailPage: defineAsyncComponent(() => import('./views/device/Instance/Detail/index.vue')),
  },
  hooks: {
    useSystemMonitorOverview,
    useDeviceScope,
    usePluginPermissionContext
  },
  stores: {
    useInstanceStore
  },
  homeAgentProviders: {
    ...homeAgentProviders,
    'device/function-guidance': {
      loader: () => import('./agentCapabilities/deviceGuidance/homeAgentProvider'),
      activation: {
        version: 'general-agent-provider-activation/v1',
        scopes: [
          { kind: 'menuCode', values: Object.values(DEVICE_GUIDANCE_MENU_CODES).flat() },
          { kind: 'routeName', values: Object.values(DEVICE_GUIDANCE_MENU_CODES).flat() },
        ],
      },
    } satisfies AgentCapabilityProviderResource,
  },
  generalAgentExtensions: {
    'device/function-guidance': {
      loader: () => import('./agentCapabilities/deviceGuidance/generalAgentExtension'),
      activation: {
        version: 'general-agent-provider-activation/v1',
        scopes: [
          { kind: 'menuCode', values: Object.values(DEVICE_GUIDANCE_MENU_CODES).flat() },
          { kind: 'routeName', values: Object.values(DEVICE_GUIDANCE_MENU_CODES).flat() },
        ],
      },
    } satisfies AgentCapabilityProviderResource,
    [IOT_DEVICE_ANALYSIS_EXTENSION_KEY]: {
      loader: () => import('./agentCapabilities/deviceAnalysis/generalAgentExtension'),
      activation: {
        version: 'general-agent-provider-activation/v1',
        scopes: [
          { kind: 'path', values: Object.values(IOT_DEVICE_MENU_ANCHORS).flatMap(values => values) },
          { kind: 'menuCode', values: Object.values(IOT_DEVICE_MENU_ANCHORS).flatMap(values => values) },
        ],
      },
    } satisfies AgentCapabilityProviderResource,
  },
}
