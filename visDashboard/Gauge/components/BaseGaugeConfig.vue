<template>
  <div class="card-container">
    <config-item
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
      labelWidth="90"
    >
      <a-slider
        v-if="field.kind === 'slider'"
        v-model:value="config[field.key]"
        :min="field.min"
        :max="field.max"
        :step="field.step || 1"
        @change="onChange"
      />

      <a-input-number
        v-else-if="field.kind === 'number'"
        v-model:value="config[field.key]"
        style="width: 100%"
        :min="field.min"
        :max="field.max"
        :step="field.step || 1"
        :placeholder="field.placeholder"
        @change="onChange"
      />

      <a-switch
        v-else-if="field.kind === 'switch'"
        v-model:checked="config[field.key]"
        @change="onChange"
      />

      <ColorPicker
        v-else-if="field.kind === 'color'"
        v-model:value="config[field.key]"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />

      <a-select
        v-else-if="field.kind === 'select'"
        v-model:value="config[field.key]"
        style="width: 100%"
        :options="field.options"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep, throttle } from 'lodash-es'
import { ref, watch } from 'vue'
import type { GaugeConfigField } from '../shared'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps<{
  configData?: Record<string, unknown>
  type: string
  fields: GaugeConfigField[]
}>()

const emits = defineEmits<{
  change: [Record<string, unknown>, string]
}>()

const config = ref<Record<string, unknown>>({})

const emitChange = throttle(() => {
  emits('change', config.value, props.type)
}, 20)

const onChange = () => {
  emitChange()
}

const getCurrentConfig = () => {
  const componentProps = (props.configData as { componentProps?: Record<string, Record<string, unknown>> } | undefined)
    ?.componentProps

  return componentProps?.[props.type]
}

watch(
  getCurrentConfig,
  (newValue) => {
    if (newValue && typeof newValue === 'object') {
      config.value = cloneDeep(newValue as Record<string, unknown>)
    }
  },
  { deep: true, immediate: true }
)
</script>

<style scoped lang="less">
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
}
</style>
