import type { DataCapabilityProviderManifest } from '@jetlinks-web-core/data-capability'

/** 公开数据能力清单，供平台注册及其他消费端共用；Provider 实现按需加载。 */
export default {
  deviceMonitoring: {
    capabilityIds: [
      'device.summary',
      'device.location.list',
      'device.runtime.trend',
      'device.category.distribution',
    ],
    loader: () => import('./deviceMonitoringProvider'),
  },
  deviceInstanceMonitoring: {
    capabilityIds: [
      'device.state.batch',
      'device.detail',
      'device.detail.page',
    ],
    loader: () => import('./deviceInstanceMonitoringProvider'),
  },
  deviceGroupMonitoring: {
    capabilityIds: [
      'device.group.list',
      'device.group.summary.batch',
      'device.group.devices.page',
      'device.group.options',
    ],
    loader: () => import('./deviceGroupMonitoringProvider'),
  },
} satisfies DataCapabilityProviderManifest
