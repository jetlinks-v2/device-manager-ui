<template>
  <div class="card-container">
    <config-item v-if="isProduct" :label="$t('Running.index.376017-1')" style="margin-bottom: 12px;">
      <a-select
          v-model:value="deviceId"
          :options="deviceOptions"
          :placeholder="$t('Running.index.376017-1')"
          optionFilterProp="label"
          style="width: 100%"
          popupClassName="is-dark"
          @change="onDeviceChange"
      />
    </config-item>
    <config-item :label="$t('Running.index.376017-1')">
      <a-select
          v-model:value="config"
          :options="typeOptions"
          :placeholder="$t('Running.index.376017-1')"
          mode="multiple"
          optionFilterProp="label"
          style="width: 100%"
          popupClassName="is-dark"
          @change="onTypeChange"
      />
    </config-item>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import {useI18n} from "vue-i18n";
import {moduleRegistry} from "@jetlinks-web-core/utils/module-registry";
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryNoPagingPost } from '@device-manager-ui/api/instance'

const { t: $t } = useI18n()

const { ConfigItem } = moduleRegistry.getResource('visualization-designer-ui', 'components')

defineOptions({
  name: 'ProductCountCardConfig'
})

const props = defineProps({
  configData: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  }
})

const route = useRoute()
const productStore = useProductStore()
const instanceStore = useInstanceStore()

const config = ref([])
const deviceOptions = ref([])
const deviceId = ref()
const deviceOptionsMap = ref(new Map())

const isProduct = computed(() => {
  return route.name === 'device/Product/Detail'
})

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
      const hasTarget = deviceId.value && deviceOptionsMap.value.size > 0
      properties = strToJson(productStore.detail.metadata)
      if (hasTarget) {
        properties.push(...strToJson(deviceOptionsMap.value.get(deviceId.value).deriveMetadata))
      }
    } else {
      properties = strToJson(instanceStore.detail.metadata)
    }
    return properties.map(item => ({
      ...item,
      label: item.name,
      value: item.id
    }))

  } catch (e) {
    return []
  }

})

const onDeviceChange = (v: string, option) => {
  props.configData.componentProps.propertyShowCard.targetId = v
  props.configData.componentProps.propertyShowCard.targetMetadata = option.metadata
  props.configData.componentProps.propertyShowCard.value = []
  config.value = []
}

const onTypeChange = (v: string[]) => {
  props.configData.componentProps.propertyShowCard.value = v
}

const getDeviceList = () => {
  if (!isProduct.value) return

  queryNoPagingPost({terms:[{ column: 'productId', value: route.params.id }]}).then((res) => {
    deviceOptions.value = res.result.map(item => {
      deviceOptionsMap.value.set(item.id, item)
      return {
        value: item.id,
        label: item.name,
        metadata: item.deriveMetadata,
      }
    })
  })
}

onMounted(() => {
  getDeviceList()
})

watch(() => props.configData, () => {
  config.value = props.configData.componentProps.propertyShowCard.value || []
  deviceId.value = props.configData.componentProps.propertyShowCard.targetId
}, { immediate: true })

</script>
