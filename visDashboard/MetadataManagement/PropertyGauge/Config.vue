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
        v-model:value="config.propertyId"
        :options="typeOptions"
        placeholder="请选择属性"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onTypeChange"
      />
    </config-item>
    <config-item label="标题">
      <a-input
        v-model:value="config.title"
        placeholder="请输入标题"
        style="width: 100%"
        @change="onChange"
      />
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
          :max="48"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="数值样式">
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
          :min="20"
          :max="72"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="单位">
      <a-input
        v-model:value="config.unit"
        placeholder="请输入单位"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>
    <config-item label="单位字体">
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
          :max="40"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
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

    <config-item label="刻度分段">
      <a-input-number
        v-model:value="config.splitNumber"
        :min="5"
        :max="20"
        :precision="0"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="指针颜色">
      <ColorPicker
        v-model:value="config.pointerColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item label="起始色">
      <ColorPicker
        v-model:value="config.progressStartColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item label="结束色">
      <ColorPicker
        v-model:value="config.progressEndColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>

    
  </div>
</template>

<script lang="ts" setup>
import { cloneDeep, throttle } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryNoPagingPost } from '@device-manager-ui/api/instance'
import { propertyGaugeConfig } from './config'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'propertyGauge'
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

    return properties.map((item: any) => ({
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
  config.value.propertyId = ''
  config.value.propertyName = ''
  emitChange()
}

const onTypeChange = (value: string) => {
  const option = typeOptions.value.find((item: any) => item.value === value)
  config.value.propertyId = value
  config.value.propertyName = option?.label || ''
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
    config.value = cloneDeep({
      ...propertyGaugeConfig.componentProps.propertyGauge,
      ...(newVal || {})
    })
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

.card-container-row {
  width: 100%;
  display: flex;
  align-items: center;
}
</style>
