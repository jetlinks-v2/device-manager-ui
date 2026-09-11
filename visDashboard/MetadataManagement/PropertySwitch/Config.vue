<template>
  <div class="card-container">    <div class="card-header">
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
        :options="functionOptions"
        placeholder="请选择功能"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onFunctionChange"
      />
    </config-item>

      <config-item
      label="参数"
      v-if="config.functionId"
    >
      <a-select
        v-model:value="config.paramId"
        :options="paramOptions"
        placeholder="请选择参数(Boolean)"
        optionFilterProp="label"
        style="width: 100%"
        popupClassName="is-dark"
        @change="onChange"
      />
    </config-item>
    
    </div>
    <a-divider />
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

    <config-item label="状态文字样式">
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
          :max="80"
          :precision="0"
          style="flex: 1"
          @change="onChange"
        />
      </div>
    </config-item>

    <config-item label="开启文案">
      <a-input
        v-model:value="config.trueLabel"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="关闭文案">
      <a-input
        v-model:value="config.falseLabel"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item label="开启颜色">
      <ColorPicker
        v-model:value="config.activeColor"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item label="关闭颜色">
      <ColorPicker
        v-model:value="config.inactiveColor"
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
import { propertySwitchConfig } from './config'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'propertySwitch'
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
    console.log('properties', properties)
    return properties.map((item: any) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
  } catch (e) {
    return []
  }
})

const functionOptions = computed(() => {
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

const paramOptions = computed(() => {
  const functionId = config.value.functionId
  if (!functionId) return []

  const currentFunction = functionOptions.value.find((item: any) => item.value === functionId)
  const inputs = currentFunction?.inputs || []
  return inputs.map((item: any) => {
    const type = String(item?.valueType?.type || '').toLowerCase()
    const isBoolean = type === 'boolean'
    return {
      ...item,
      label: item.name,
      value: item.id,
      disabled: !isBoolean
    }
  })
})

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

const onFunctionChange = () => {
  config.value.paramId = undefined
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
      ...propertySwitchConfig.componentProps.propertySwitch,
      ...(newVal || {})
    })
  },
  { deep: true, immediate: true }
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
}

.card-container-row {
  width: 100%;
  display: flex;
  align-items: center;
}
</style>
