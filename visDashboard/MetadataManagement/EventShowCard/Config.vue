<template>
  <div class="card-container">
    <config-item
      v-if="isProduct"
      label="设备"
    >
      <a-select
        v-model:value="config.targetId"
        :options="deviceOptions"
        :placeholder="$t('Running.index.376017-1')"
        optionFilterProp="label"
        style="width: 100%"
        @change="onDeviceChange"
      />
    </config-item>

    <config-item label="事件">
      <a-select
        v-model:value="config.value"
        :options="eventOptions"
        optionFilterProp="label"
        placeholder="请选择事件"
        popupClassName="is-dark"
        style="width: 100%"
        :disabled="isProduct && !config.targetId"
        @change="emitChange"
      />
    </config-item>

    <config-item label="自动刷新">
      <a-switch
        v-model:checked="config.isAutoRefresh"
        @change="emitChange"
      />
    </config-item>

    <config-item
      v-if="config.isAutoRefresh"
      label="刷新间隔"
    >
      <a-space>
        <InputNumber
          v-model:value="config.interval"
          :max="999999"
          :min="1"
          :valueOnClear="1"
          style="width: 100%"
          @change="emitChange"
        />
        <span>秒</span>
      </a-space>
    </config-item>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryNoPagingPost } from '@device-manager-ui/api/instance'
import { eventShowCardConfig } from './config'
import type { PropType } from 'vue'
import type { DashboardEventMetadata, EventShowCardConfig } from '../../DeviceManagement/shared'

defineOptions({
  name: 'EventShowCardConfig'
})

const { ConfigItem, InputNumber } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  }
})
const emit = defineEmits<{
  (e: 'change', value: any, key: string): void
}>()

const route = useRoute()
const productStore = useProductStore()
const instanceStore = useInstanceStore()

type DeviceOption = {
  value: string
  label: string
  metadata: string
}

const config = ref<EventShowCardConfig>(cloneDeep(eventShowCardConfig.componentProps.eventShowCard))
const deviceOptions = ref<DeviceOption[]>([])
const deviceOptionsMap = ref(new Map<string, DeviceOption>())

const isProduct = computed(() => route.name === 'device/Product/Detail')

const parseEvents = (metadata: string | undefined): DashboardEventMetadata[] => {
  try {
    return JSON.parse(metadata || '{}').events || []
  } catch (error) {
    return []
  }
}

const mergeEvents = (baseEvents: DashboardEventMetadata[], targetEvents: DashboardEventMetadata[]) => {
  const eventMap = new Map<string, DashboardEventMetadata>()

  baseEvents.forEach((item) => {
    eventMap.set(item.id, item)
  })

  targetEvents.forEach((item) => {
    eventMap.set(item.id, item)
  })

  return Array.from(eventMap.values())
}

const eventOptions = computed(() => {
  try {
    const baseEvents = parseEvents(isProduct.value ? productStore.detail.metadata : instanceStore.current.metadata)

    if (!isProduct.value) {
      return baseEvents.map((item) => ({
        ...item,
        label: item.name,
        value: item.id
      }))
    }

    if (!config.value.targetId) {
      return []
    }

    const targetMetadata =
      deviceOptionsMap.value.get(config.value.targetId)?.metadata || config.value.targetMetadata
    const events = mergeEvents(baseEvents, parseEvents(targetMetadata))

    return events.map((item) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
  } catch (error) {
    return []
  }
})

const emitChange = () => {
  emit('change', cloneDeep(config.value), 'eventShowCard')
}

const onDeviceChange = (value: string, option: DeviceOption) => {
  config.value.targetId = value
  config.value.targetMetadata = option?.metadata || ''
  config.value.value = ''
  emitChange()
}

const getDeviceList = async () => {
  if (!isProduct.value) {
    return
  }

  const response = await queryNoPagingPost({
    terms: [
      {
        column: 'productId',
        value: route.params.id
      }
    ]
  })

  const nextMap = new Map<string, DeviceOption>()
  const nextOptions = (response?.result || []).map((item: Record<string, unknown>) => {
    const option = {
      value: String(item.id || ''),
      label: String(item.name || ''),
      metadata: String(item.deriveMetadata || '')
    }

    nextMap.set(option.value, option)
    return option
  })

  deviceOptionsMap.value = nextMap
  deviceOptions.value = nextOptions
}

onMounted(() => {
  void getDeviceList()
})

watch(
  () => (props.configData as { componentProps?: any } | undefined)?.componentProps?.eventShowCard,
  (value) => {
    config.value = cloneDeep({
      ...eventShowCardConfig.componentProps.eventShowCard,
      ...(value || {})
    })
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
  margin-left: 20px;
}
</style>
