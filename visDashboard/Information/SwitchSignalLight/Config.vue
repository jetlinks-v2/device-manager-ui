<template>
  <div class="card-container">
    <config-item
      :label="$t('SwitchSignalLight.Config.100030-0')"
      :label-width="90"
    >
      <ColorPicker
        v-model:value="config.onColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchSignalLight.Config.100030-1')"
      :label-width="90"
    >
      <ColorPicker
        v-model:value="config.offColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchSignalLight.Config.100030-2')"
      :label-width="90"
    >
      <a-switch
        v-model:checked="config.autoSize"
        @change="onChange"
      />
    </config-item>
    <config-item
      v-if="!config.autoSize"
      :label="$t('SwitchSignalLight.Config.100030-3')"
      :label-width="90"
    >
      <a-slider
        v-model:value="config.size"
        :min="10"
        :max="50"
        :step="1"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchSignalLight.Config.100030-4')"
      :label-width="90"
    >
      <a-switch
        v-model:checked="config.showGlow"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep, throttle } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: 'switchSignalLight'
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

  .card-container-row {
    display: flex;
  }
}
</style>
