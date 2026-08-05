<template>
  <div style="margin-left: 20px">
    <component
      :is="_component"
      :activeComponent="_configData"
      @change="onChange"
      :isEdit="false"
    />
  </div>
</template>
<script lang="ts" setup>
import { cloneDeep } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

const { ResourceBasicComponentsInstance } = moduleRegistry.getResource('visualization-resources', 'events')
const _component = ResourceBasicComponentsInstance['AMapConfig'][0]?.component

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  }
})
const emits = defineEmits(['change'])


const _configData = ref()
const onChange = (val) => {
  emits('change', cloneDeep(val), 'amap')
}

watch(
  () => props.configData?.componentProps?.amap,
  (newVal) => {
    if (newVal) {
      _configData.value = cloneDeep(props.configData)
    }
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

  .card-container-row {
    display: flex;
  }
}
</style>
