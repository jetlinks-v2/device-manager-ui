<template>
  <div class="card-container">
    <config-item
      :label="$t('RealtimeLineChart.Config.100019-0')"
      labelWidth="90"
    >
      <a-switch
        v-model:checked="config.showLegend"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('RealtimeLineChart.Config.100019-1')"
      labelWidth="90"
      v-if="config.showLegend"
    >
      <a-radio-group
        v-model:value="config.legendPosition"
        @change="onChange"
        option-type="button"
        button-style="solid"
      >
        <a-radio-button value="top">{{ $t('RealtimeLineChart.Config.100019-2') }}</a-radio-button>
        <a-radio-button value="bottom">{{ $t('RealtimeLineChart.Config.100019-3') }}</a-radio-button>
      </a-radio-group>
    </config-item>
    <config-item
      :label="$t('RealtimeLineChart.Config.100019-4')"
      labelWidth="90"
    >
      <a-switch
        v-model:checked="config.smooth"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('RealtimeLineChart.Config.100019-5')"
      labelWidth="90"
    >
      <a-switch
        v-model:checked="config.showSplitLine"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('RealtimeLineChart.Config.100019-6')">
      <a-switch
        v-model:checked="config.showSymbol"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('RealtimeLineChart.Config.100019-7')"
      labelWidth="90"
    >
      <a-switch
        v-model:checked="config.showAreaStyle"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script lang="ts" setup>
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
    default: 'realtimeLineChart'
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
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;
}
</style>
