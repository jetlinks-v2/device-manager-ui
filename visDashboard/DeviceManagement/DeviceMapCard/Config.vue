<template>
  <div class="card-container">
    <config-item :label="t('components.DeviceMap.configTitle')">
      <a-input
        v-model:value="config.topTitle"
        :maxlength="32"
        :placeholder="t('components.DeviceMap.titlePlaceholder')"
        @change="emitChange"
      />
    </config-item>

    <config-item :label="t('components.DeviceMap.autoRefresh')">
      <a-switch
        v-model:checked="config.isAutoRefresh"
        @change="emitChange"
      />
    </config-item>

    <config-item
      v-if="config.isAutoRefresh"
      :label="t('components.DeviceMap.refreshInterval')"
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
        <span>{{ t('components.DeviceMap.seconds') }}</span>
      </a-space>
    </config-item>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'
import { deviceMapCardConfig } from './config'
import type { DeviceMapConfig } from '../shared'

defineOptions({
  name: 'DeviceMapCardConfig'
})

const { ConfigItem, InputNumber } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { t } = useI18n()

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
  () =>
    (props.configData as { componentProps?: { deviceMapCard?: DeviceMapConfig } } | undefined)?.componentProps
      ?.deviceMapCard,
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
