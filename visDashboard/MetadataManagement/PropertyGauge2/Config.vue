<template>
  <div class="card-container">
    <config-item
      v-if="isProduct"
      label="设备"
    >
      <a-select
        v-model:value="config.deviceId"
        :options="deviceOptions"
        placeholder="请选择设备"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onDeviceChange"
      />
    </config-item>

    <config-item label="属性">
      <a-select
        v-model:value="config.propertyIds"
        mode="multiple"
        :maxTagCount="2"
        :options="propertyOptions"
        placeholder="请选择属性，最多5个"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onPropertiesChange"
      />
    </config-item>

    <config-item label="最小值">
      <a-input-number
        v-model:value="config.minValue"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="最大值">
      <a-input-number
        v-model:value="config.maxValue"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="环宽">
      <a-input-number
        v-model:value="config.ringWidth"
        :min="14"
        :max="48"
        :precision="0"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="标题字号">
      <a-input-number
        v-model:value="config.titleFontSize"
        :min="12"
        :max="48"
        :precision="0"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="数值字号">
      <a-input-number
        v-model:value="config.valueFontSize"
        :min="12"
        :max="48"
        :precision="0"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { cloneDeep, throttle } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { onlyMessage } from '@jetlinks-web/utils'
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryNoPagingPost } from '@device-manager-ui/api/instance'
import { propertyGauge2Config } from './config'

const { ConfigItem } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'propertyGauge2'
  }
})

const emits = defineEmits(['change'])
const config = ref<any>({})
const productStore = useProductStore()
const instanceStore = useInstanceStore()
const route = useRoute()
const deviceOptions = ref<any[]>([])
const deviceOptionsMap = ref(new Map())

const isProduct = computed(() => route.name === 'device/Product/Detail')
const numericTypes = new Set(['int', 'long', 'float', 'double', 'short', 'byte', 'decimal', 'number'])

const emitChange = throttle(() => {
  emits('change', config.value, props.type)
}, 20)

const onChange = () => {
  emitChange()
}

const strToJson = (str: string, key: string = 'properties') => {
  try {
    return JSON.parse(str || '{}')[key] || []
  } catch (e) {
    return []
  }
}

const propertyOptions = computed(() => {
  try {
    let properties = []
    if (isProduct.value) {
      const hasTarget = config.value.deviceId && deviceOptionsMap.value.size > 0
      properties = strToJson(productStore.detail.metadata)
      if (hasTarget) {
        properties.push(...strToJson(deviceOptionsMap.value.get(config.value.deviceId)?.deriveMetadata))
      }
    } else {
      properties = strToJson(instanceStore.current.metadata || instanceStore.detail.metadata)
    }

    return properties
      .filter((item: any) => numericTypes.has(String(item?.valueType?.type || '').toLowerCase()))
      .map((item: any) => ({
        ...item,
        label: item.name,
        value: item.id
      }))
  } catch (e) {
    return []
  }
})

const onDeviceChange = (value: string, option: any) => {
  config.value.deviceId = value
  config.value.deviceName = option?.label || ''
  config.value.propertyIds = []
  config.value.propertyNames = []
  emitChange()
}

const onPropertiesChange = (values: string[]) => {
  const nextValues = (values || []).slice(0, 5)

  if ((values || []).length > 5) {
    onlyMessage('最多选择5个属性', 'warning')
  }

  const optionsMap = new Map(propertyOptions.value.map((item: any) => [item.value, item.label]))
  config.value.propertyIds = nextValues
  config.value.propertyNames = nextValues.map((id) => optionsMap.get(id) || id)
  emitChange()
}

const getDeviceList = () => {
  if (!isProduct.value) return

  queryNoPagingPost({ terms: [{ column: 'productId', value: route.params.id, termType: 'eq' }] }).then((res) => {
    deviceOptions.value = (res.result || []).map((item: any) => {
      deviceOptionsMap.value.set(item.id, item)
      return {
        value: item.id,
        label: item.name,
        productId: item.productId,
        metadata: item.deriveMetadata
      }
    })
  })
}

onMounted(() => {
  getDeviceList()
})

watch(
  () => props.configData?.componentProps?.[props.type],
  (newVal) => {
    const merged = cloneDeep({
      ...propertyGauge2Config.componentProps.propertyGauge2,
      ...(newVal || {})
    })

    merged.propertyIds = Array.isArray(merged.propertyIds) ? merged.propertyIds.slice(0, 5) : []
    merged.propertyNames = Array.isArray(merged.propertyNames) ? merged.propertyNames.slice(0, 5) : []
    config.value = merged
  },
  { deep: true, immediate: true }
)
</script>

<style lang="less" scoped>
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;

  :deep(.config-form-item-content) {
    padding: 0;
  }
}
</style>
