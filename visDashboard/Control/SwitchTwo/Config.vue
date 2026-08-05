<template>
  <div class="card-container">
    <config-item
      :label="$t('SwitchTwo.Config.100024-0')"
      :labelWidth="90"
    >
      <IconLibrary
        v-model:type="config.onType"
        @change="onChange"
      />
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-1')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.onColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchTwo.Config.100024-2')"
      :labelWidth="90"
    >
      <a-select
        v-model:value="config.onAnimation"
        style="width: 100%"
        @change="onChange"
      >
        <a-select-option value="none">{{ $t('SwitchTwo.Config.100024-3') }}</a-select-option>
        <a-select-option value="clockwise">{{ $t('SwitchTwo.Config.100024-4') }}</a-select-option>
        <a-select-option value="anticlockwise">{{ $t('SwitchTwo.Config.100024-5') }}</a-select-option>
        <a-select-option value="shake">{{ $t('SwitchTwo.Config.100024-6') }}</a-select-option>
      </a-select>
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-7')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.onSpeed"
        :min="0.1"
        :max="5"
        :step="0.1"
        @change="onChange"
      />
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-8')"
      :labelWidth="90"
    >
      <IconLibrary
        v-model:type="config.offType"
        @change="onChange"
      />
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-1')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.offColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-2')"
      :labelWidth="90"
    >
      <a-select
        v-model:value="config.offAnimation"
        style="width: 100%"
        @change="onChange"
      >
        <a-select-option value="none">{{ $t('SwitchTwo.Config.100024-3') }}</a-select-option>
        <a-select-option value="clockwise">{{ $t('SwitchTwo.Config.100024-4') }}</a-select-option>
        <a-select-option value="anticlockwise">{{ $t('SwitchTwo.Config.100024-5') }}</a-select-option>
        <a-select-option value="shake">{{ $t('SwitchTwo.Config.100024-6') }}</a-select-option>
      </a-select>
    </config-item>

    <config-item
      :label="$t('SwitchTwo.Config.100024-7')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.offSpeed"
        :min="0.1"
        :max="5"
        :step="0.1"
        @change="onChange"
      />
    </config-item>
  </div>
</template>
<script lang="ts" setup>
import { cloneDeep } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import IconLibrary from '@jetlinks-web-core/components/IconLibrary/index.vue'
import { useI18n } from 'vue-i18n'

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  }
})
const emits = defineEmits(['change'])
const config = ref<any>({})

const onChange = () => {
  emits('change', config.value, 'switchTwo')
}

watch(
  () => props.configData?.componentProps?.switchTwo,
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
