<template>
  <div class="card-container">
    <config-item label="类型">
      <a-select
        v-model:value="config.type"
        :options="typeOptions"
        placeholder="请选择类型"
        popupClassName="is-dark"
        style="width: 100%"
        @change="onTypeChange"
      />
    </config-item>

    <config-item label="自动刷新">
      <a-switch
        v-model:checked="config.isAutoRefresh"
        @change="onChange"
      />
    </config-item>

    <template v-if="config.isAutoRefresh">
      <config-item label="刷新间隔">
        <a-space>
          <input-number
            v-model:value="config.interval"
            :max="999999"
            :min="1"
            :valueOnClear="1"
            style="width: 100%"
            @change="onChange"
          />
          <span>秒</span>
        </a-space>
      </config-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'
import type { DashboardCardInfo, DashboardCountOption } from '../shared'

const { ConfigItem, InputNumber } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = withDefaults(
  defineProps<{
    configData?: DashboardCardInfo
    type: string
    typeOptions: DashboardCountOption[]
  }>(),
  {
    configData: () => ({}),
    typeOptions: () => []
  }
)

const emits = defineEmits<{
  (e: 'change', value: Record<string, unknown>, key: string): void
}>()

const config = ref<Record<string, unknown>>({})

const onChange = () => {
  emits('change', config.value, props.type)
}

const onTypeChange = () => {
  const selected = props.typeOptions.find((item) => item.value === config.value.type)
  config.value.topTitle = selected?.name || ''
  emits('change', config.value, props.type)
}

watch(
  () => props.configData?.componentProps?.[props.type],
  (value) => {
    config.value = cloneDeep((value as Record<string, unknown>) || {})
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
