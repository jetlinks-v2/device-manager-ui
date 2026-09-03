<template>
  <div class="card-container">
    <config-item label="标题">
      <a-input
        v-model:value="config.topTitle"
        :maxlength="32"
        placeholder="请输入标题"
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
import type { PropType } from 'vue'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'
import { deviceMapCardConfig } from './config'
import type { DeviceMapConfig } from '../shared'

defineOptions({
  name: 'DeviceMapCardConfig'
})

const { ConfigItem, InputNumber } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  }
})

const emit = defineEmits<{
  (e: 'change', value: DeviceMapConfig, key: string): void
}>()

const config = ref<DeviceMapConfig>(cloneDeep(deviceMapCardConfig.componentProps.deviceMapCard))

const emitChange = () => {
  emit('change', cloneDeep(config.value), 'deviceMapCard')
}

watch(
  () => (props.configData as { componentProps?: { deviceMapCard?: DeviceMapConfig } } | undefined)?.componentProps?.deviceMapCard,
  (value) => {
    config.value = cloneDeep((value as DeviceMapConfig) || deviceMapCardConfig.componentProps.deviceMapCard)
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
