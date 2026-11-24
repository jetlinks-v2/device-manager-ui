<template>
  <FullPage class="instance-device-access" :class="{ 'instance-device-access--config': innerTab === 'access', 'instance-device-access--parsing': innerTab === 'parsing' }"
    :fixed="innerTab !== 'parsing'" :margin="innerTab === 'parsing' ? '0' : undefined" :padding="0" flex>
    <DeviceDetailTabs
      :active-key="innerTab"
      @change="changeInnerTab"
      class="device-access-tabs"
      :destroy-inactive-tab-pane="destroyInactiveTabPane"
    >
      <a-tab-pane
        key="access"
        class="device-access-tab-pane device-access-tab-pane--access"
        :tab="$t('IotDeviceDetail.accessDetail.tab.config')"
      >
        <div class="tab-pane-inner tab-pane-inner--access">
          <IotDeviceAccessGuidePane
            :device="device"
            :product-template="productTemplate"
            @access-detail-change="accessDetail = $event"
            @config-saved="emit('configSaved', $event)"
          />
        </div>
      </a-tab-pane>

      <a-tab-pane
        v-if="traceEnabled"
        key="trace"
        class="device-access-tab-pane device-access-tab-pane--trace"
      >
        <template #tab>
          <span class="trace-tab-label">
            <span>{{ $t('IotDeviceDetail.accessDetail.tab.trace') }}</span>
          </span>
        </template>
        <div class="tab-pane-inner tab-pane-inner--trace">
          <IotDeviceTraceTab
            :device="device"
            :properties="properties"
            :commands="commands"
            hide-session
          />
        </div>
      </a-tab-pane>

      <a-tab-pane v-if="simulatorSupported" key="simulator" class="device-access-tab-pane" :tab="$t('InstanceDeviceAccess.codecDebug.title')">
        <div class="tab-pane-inner tab-pane-inner--simulator">
          <CodecSimulatorPanel v-if="innerTab === 'simulator'" :key="device.id" :device-id="device.id"
            :metadata="device.deviceThingModelMetadata" :product-metadata="device.productThingModelMetadata ?? device.thingModelMetadata" :transport="device.transport" />
        </div>
      </a-tab-pane>

      <a-tab-pane
        v-if="hasTransparentCodec"
        key="parsing"
        class="device-access-tab-pane device-access-tab-pane--parsing"
        :tab="$t('IotDeviceDetail.accessDetail.tab.parsing')"
      >
        <div class="tab-pane-inner tab-pane-inner--parsing">
          <IotDeviceParsingTab
            ref="parsingRef"
            :device="device"
            :product-id="device.productKey"
          />
        </div>
      </a-tab-pane>

      <a-tab-pane
        v-if="canShowChildren"
        key="children"
        class="device-access-tab-pane device-access-tab-pane--children"
        :tab="$t('IotDeviceDetail.accessDetail.tab.children')"
      >
        <div class="tab-pane-inner tab-pane-inner--children">
          <IotDeviceChildrenTab :device="device" />
        </div>
      </a-tab-pane>
    </DeviceDetailTabs>
  </FullPage>
</template>

<script lang="ts" setup>
import DeviceDetailTabs from '@device-manager-ui/views/device/components/DeviceDetailTabs.vue'
import type { PropType } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { DeviceTemplate } from '../../services/device-library/types'
import type { IotDevice, IotDeviceCommandDefinition } from '../../types'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import IotDeviceAccessGuidePane from './IotDeviceAccessGuidePane.vue'
import IotDeviceChildrenTab from './IotDeviceChildrenTab.vue'
import IotDeviceParsingTab from './IotDeviceParsingTab.vue'
import IotDeviceTraceTab from './IotDeviceTraceTab.vue'
import CodecSimulatorPanel from '../../../Instance/Detail/DeviceAccess/CodecSimulatorPanel.vue'
import { useDeviceSimulatorSupport } from './useDeviceSimulatorSupport'
import { useIotDeviceAccessSessions } from './useIotDeviceAccessSessions'

type DeviceAccessInnerTab = 'access' | 'trace' | 'parsing' | 'children' | 'simulator'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  productTemplate: { type: Object as PropType<DeviceTemplate | null>, default: null },
  properties: { type: Array as PropType<RealtimePropertyRow[]>, required: true },
  commands: { type: Array as PropType<IotDeviceCommandDefinition[]>, required: true },
  sessionEnabled: { type: Boolean, default: true },
  traceEnabled: { type: Boolean, default: true },
  showChildren: { type: Boolean, default: true },
  destroyInactiveTabPane: { type: Boolean, default: false },
  defaultTab: { type: String as PropType<DeviceAccessInnerTab>, default: undefined },
})

const { t: $t } = useI18n()
const emit = defineEmits<{ configSaved: [deviceId: string] }>()
const route = useRoute()
const accessDetail = ref<Record<string, any>>({})
const deviceId = computed(() => props.device.id || undefined)
const simulatorSupported = useDeviceSimulatorSupport(deviceId, computed(() => props.device.transport), computed(() => props.traceEnabled))
const isOnline = computed(() => props.device.status === 'online')
// 跨模块可关闭重复的子设备入口；默认值保持设备详情现有行为。
const canShowChildren = computed(() => props.showChildren && props.device.deviceTypeValue === 'gateway')
const hasTransparentCodec = computed(() =>
  Boolean(props.device.features?.some((item) => item?.id === 'transparentCodec')),
)
// 兼容旧版高级配置链接：高级配置内层页签现在落到设备接入内。
const legacyParsingRequested = computed(() =>
  (route.query.tab === 'access' || route.query.tab === 'advanced') && route.query.sub === 'parsing',
)
const legacyChildrenRequested = computed(() =>
  route.query.tab === 'children'
  || ((route.query.tab === 'access' || route.query.tab === 'advanced') && route.query.sub === 'children'),
)
// 跨模块嵌入时没有设备详情路由参数，由调用方显式指定首次展示的内层页签。
const accessConfigRequested = computed(() =>
  props.defaultTab === 'access'
  || (route.query.tab === 'access' && (route.query.sub === 'connection' || route.query.sub === 'access')),
)

function getDefaultInnerTab(): DeviceAccessInnerTab {
  if (accessConfigRequested.value) return 'access'
  if (route.query.sub === 'simulator' && simulatorSupported.value) return 'simulator'
  if (legacyChildrenRequested.value && canShowChildren.value) return 'children'
  if (legacyParsingRequested.value && hasTransparentCodec.value) return 'parsing'
  if (props.defaultTab === 'children' && canShowChildren.value) return 'children'
  if (props.defaultTab === 'parsing' && hasTransparentCodec.value) return 'parsing'
  if (props.defaultTab === 'trace' && props.traceEnabled) return 'trace'
  if (!props.traceEnabled) return 'access'
  return isOnline.value ? 'trace' : 'access'
}

const innerTab = ref<DeviceAccessInnerTab>(getDefaultInnerTab())
const parsingRef = ref<InstanceType<typeof IotDeviceParsingTab> | null>(null)
async function changeInnerTab(key: string | number) {
  if (innerTab.value === 'parsing' && !await parsingRef.value?.confirmLeave()) return
  innerTab.value = String(key) as DeviceAccessInnerTab
}
watch(simulatorSupported, supported => {
  if (supported && (route.query.sub === 'simulator' || props.defaultTab === 'simulator')) innerTab.value = 'simulator'
  else if (!supported && innerTab.value === 'simulator') innerTab.value = 'access'
})

const {
  loadSessions,
  clearSessions,
  stopSessionAutoRefresh,
} = useIotDeviceAccessSessions(deviceId, isOnline)

onMounted(() => {
  if (props.traceEnabled && isOnline.value && !accessConfigRequested.value && innerTab.value !== 'parsing' && innerTab.value !== 'children' && innerTab.value !== 'simulator') {
    innerTab.value = 'trace'
    if (props.sessionEnabled) void loadSessions()
  }
})

watch(
  () => props.device.id,
  (id, prev) => {
    if (!id || id === prev) return
    clearSessions()
    if (props.sessionEnabled && isOnline.value) {
      void loadSessions()
    }
  },
)

watch(
  () => props.device.status,
  (val, oldVal) => {
    if (val === oldVal) return
    if (val === 'online') {
      if (props.traceEnabled && !accessConfigRequested.value && innerTab.value !== 'parsing' && innerTab.value !== 'children' && innerTab.value !== 'simulator') {
        innerTab.value = 'trace'
      }
      if (props.sessionEnabled) void loadSessions()
    } else {
      clearSessions()
      stopSessionAutoRefresh()
    }
  },
)

watch(
  accessConfigRequested,
  (requested) => {
    if (requested) innerTab.value = 'access'
  },
  { immediate: true },
)

watch(
  legacyParsingRequested,
  (requested) => {
    if (requested && hasTransparentCodec.value) {
      innerTab.value = 'parsing'
    }
  },
  { immediate: true },
)

watch(
  legacyChildrenRequested,
  (requested) => {
    if (requested && canShowChildren.value) {
      innerTab.value = 'children'
    }
  },
  { immediate: true },
)

watch(hasTransparentCodec, (supported) => {
  if (!supported && innerTab.value === 'parsing') {
    innerTab.value = props.traceEnabled && isOnline.value ? 'trace' : 'access'
  }
})

watch(canShowChildren, (supported) => {
  if (supported && legacyChildrenRequested.value) {
    innerTab.value = 'children'
  } else if (!supported && innerTab.value === 'children') {
    innerTab.value = props.traceEnabled && isOnline.value ? 'trace' : 'access'
  }
})

watch(
  () => props.traceEnabled,
  (enabled) => {
    // 隐藏预载实例只需要接入配置摘要，不能挂载通信链路订阅后在切换时抢占可见实例。
    if (!enabled && innerTab.value === 'trace') {
      innerTab.value = 'access'
    }
  },
  { immediate: true },
)

watch(
  () => props.sessionEnabled,
  (enabled) => {
    if (enabled) return
    clearSessions()
    stopSessionAutoRefresh()
  },
  { immediate: true },
)

onUnmounted(() => {
  stopSessionAutoRefresh()
})
</script>

<style scoped src="./IotDeviceAccessDetailTab.css"></style>
