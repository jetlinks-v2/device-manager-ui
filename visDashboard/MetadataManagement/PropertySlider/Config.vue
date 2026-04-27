<template>
  <div class="card-container">
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
          :max="60"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
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
        placeholder="为空时使用物模型单位"
        style="width: 100%"
        @change="onChange"
      />
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
          :max="80"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="滑块颜色">
      <ColorPicker
        v-model:value="config.activeColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item label="轨道颜色">
      <ColorPicker
        v-model:value="config.trailColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item label="手柄颜色">
      <ColorPicker
        v-model:value="config.thumbColor"
        :isInput="false"
        theme="white"
        @change="onChange"
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
    <config-item label="功能">
      <a-select
        v-model:value="config.functionId"
        :options="_functionOptions"
        placeholder="请选择功能"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onFunctionChange"
      />
    </config-item>
    <config-item label="参数" v-if="config.functionId">
      <a-select
        v-model:value="config.paramId"
        :options="_paramsOptions"
        placeholder="请选择参数(数值类型)"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
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
import { propertySliderConfig } from './config'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'propertySlider'
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

const strToJson = (str: string, key: string = 'properties') => {
  try {
    return JSON.parse(str || '{}')[key] || []
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

const _functionOptions = computed(() => {
  try {
    let functions = []
    if (isProduct.value) {
      const hasTarget = config.value.deviceId && deviceOptionsMap.value.size > 0
      functions = strToJson(productStore.detail.metadata, 'functions')
      if (hasTarget) {
        functions.push(...strToJson(deviceOptionsMap.value.get(config.value.deviceId)?.deriveMetadata, 'functions'))
      }
    } else {
      functions = strToJson(instanceStore.current.metadata || instanceStore.detail.metadata, 'functions')
    }
    return functions.map((item: any) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
  } catch (e) {
    return []
  }
})

const numericInputTypes = new Set(['int', 'long', 'double', 'float'])

const _paramsOptions = computed(() => {
  const functionId = config.value.functionId
  if (!functionId) return []

  const currentFunction = _functionOptions.value.find((item: any) => item.value === functionId)
  const inputs = currentFunction?.inputs || []
  return inputs
    .filter((item: any) => numericInputTypes.has(String(item?.valueType?.type || '').toLowerCase()))
    .map((item: any) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
})

const onFunctionChange = () => {
  config.value.paramId = undefined
  emitChange()
}

const onDeviceChange = (value: string, option: any) => {
  config.value.deviceId = value
  config.value.deviceName = option?.label || ''
  config.value.propertyId = ''
  config.value.propertyName = ''
  config.value.functionId = undefined
  config.value.paramId = undefined
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
      ...propertySliderConfig.componentProps.propertySlider,
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
}

.card-container-row {
  width: 100%;
  display: flex;
  align-items: center;
}
</style>
