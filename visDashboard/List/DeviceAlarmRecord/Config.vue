<template>
  <div class="config-container">
    <config-item :label="$t('DeviceAlarmRecord.Config.100032-0')">
      <a-radio-group
        v-model:value="config.tableSize"
        button-style="solid"
        size="small"
        @change="onChange"
        style="width: 100%; display: flex"
      >
        <a-radio-button
          value="large"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceAlarmRecord.Config.100032-1') }}
        </a-radio-button>
        <a-radio-button
          value="middle"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceAlarmRecord.Config.100032-2') }}
        </a-radio-button>
        <a-radio-button
          value="small"
          style="flex: 1; text-align: center"
        >
          {{ $t('DeviceAlarmRecord.Config.100032-3') }}
        </a-radio-button>
      </a-radio-group>
    </config-item>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep, throttle } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { ConfigItem } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'deviceAlarmRecord'
  }
})

const emits = defineEmits(['change'])
const config = ref<any>({})

const emitChange = throttle(() => {
  emits('change', config.value, props.type)
}, 20)

const onChange = () => {
  emitChange()
}

watch(
  () => props.configData?.componentProps?.[props.type],
  (newVal) => {
    if (newVal) {
      config.value = cloneDeep(newVal)
    }
  },
  { deep: true, immediate: true }
)
</script>

<style lang="less" scoped>
.config-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
}
</style>
