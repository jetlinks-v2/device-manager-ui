<template>
  <div class="card-container">
    <div class="card-header">
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
          v-model:value="config.propertyId"
          :options="typeOptions"
          placeholder="请选择属性"
          optionFilterProp="label"
          style="width: 100%"
          popupClassName="is-dark"
          @change="onTypeChange"
        />
      </config-item>
    </div>
    <a-divider />
    <config-item label="图标">
      <IconLibrary
        v-model:type="config.icon"
        @change="onChange"
      />
    </config-item>

    <config-item label="图标样式">
      <div class="card-container-row">
        <ColorPicker
          v-model:value="config.iconColor"
          :isInput="false"
          style="margin-right: 6px"
          theme="white"
          @change="onChange"
        />
        <a-input-number
          v-model:value="config.iconSize"
          :min="12"
          :max="120"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="标题样式">
      <div class="card-container-row">
        <ColorPicker
          v-model:value="config.titleColor"
          :isInput="false"
          style="margin-right: 6px"
          theme="white"
          @change="onChange"
        />
        <a-input-number
          v-model:value="config.titleFontSize"
          :min="12"
          :max="120"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="单位">
      <a-input
        v-model:value="config.unit"
        placeholder="例如 ℃"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="属性值样式">
      <div class="card-container-row">
        <ColorPicker
          v-model:value="config.valueColor"
          :isInput="false"
          style="margin-right: 6px"
          theme="white"
          @change="onChange"
        />
        <a-input-number
          v-model:value="config.valueFontSize"
          :min="12"
          :max="160"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="单位样式">
      <div class="card-container-row">
        <ColorPicker
          v-model:value="config.unitColor"
          :isInput="false"
          style="margin-right: 6px"
          theme="white"
          @change="onChange"
        />
        <a-input-number
          v-model:value="config.unitFontSize"
          :min="10"
          :max="120"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { cloneDeep, throttle } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import IconLibrary from '@jetlinks-web-core/components/IconLibrary/index.vue'
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryNoPagingPost } from '@device-manager-ui/api/instance'
import { individualCardConfig } from './config'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'individualCard'
  }
})

const emits = defineEmits(['change'])
const config = ref<any>({})
const productStore = useProductStore()
const instanceStore = useInstanceStore()

const route = useRoute()
const isProduct = computed(() => {
  return route.name === 'device/Product/Detail'
})
const deviceOptions = ref([])
const deviceOptionsMap = ref(new Map())

const emitChange = throttle(() => {
  emits('change', config.value, props.type)
}, 20)

const onChange = () => {
  emitChange()
}

const strToJson = (str: string) => {
  try {
    return JSON.parse(str || '{}').properties || []
  } catch (e) {
    return []
  }
}
const typeOptions = computed(() => {
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
    return properties.map((item) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
  } catch (e) {
    return []
  }
})
const onDeviceChange = (value: any, option: any) => {
  config.value.deviceName = option.label
  config.value.deviceId = value
  config.value.propertyId = ''
  config.value.propertyName = ''
  emitChange()
}

const onTypeChange = (value: any) => {
  config.value.propertyId = value
  config.value.propertyName = typeOptions.value.find((item) => item.value === value)?.label
  emitChange()
}

const getDeviceList = () => {
  if (!isProduct.value) return

  queryNoPagingPost({ terms: [{ column: 'productId', value: route.params.id, termType: 'eq' }] }).then((res) => {
    deviceOptions.value = res.result.map((item) => {
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
    config.value = cloneDeep({
      ...individualCardConfig.componentProps.individualCard,
      ...(newVal || {})
    })
  },
  { deep: true, immediate: true }
)

watch(
  () => config.value.propertyId,
  (val) => {
    if (!val) {
      config.value.propertyName = ''
    }
  }
)
</script>

<style lang="less" scoped>
.card-container {
  .card-header {
    gap: 12px;
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    border-radius: 12px;
    background: #f7f9fc;
  }
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
  :deep(.ant-divider-horizontal) {
    margin: 0;
    margin-bottom: 12px;
  }
  :deep(.config-form-item-content) {
    padding: 0;
  }
}

.card-container-row {
  width: 100%;
  display: flex;
  align-items: center;
}
</style>
