
export const tabs = {
  Metadata: defineAsyncComponent(() => import('../../components/Metadata/index.vue')),
  Device: defineAsyncComponent(() => import('./DeviceAccess/index.vue')),
  DataAnalysis: defineAsyncComponent(() => import('./DataAnalysis/index.vue')),
  MetadataMap: defineAsyncComponent(() => import('./MetadataMap')),
  AlarmRecord: defineAsyncComponent(() => import('./components/ProductAlarmRecordsTab.vue')),
  Firmware: defineAsyncComponent(() => import('../../Instance/Detail/Firmware/index.vue')),
  Invalid: defineAsyncComponent(() => import('./components/ProductInvalidDataTab.vue')),
  AlarmConfig: defineAsyncComponent(() => import('./components/ProductAlarmConfigTab.vue')),
  Dashboard: defineAsyncComponent(() => import('./Dashboard/index.vue')),
};
