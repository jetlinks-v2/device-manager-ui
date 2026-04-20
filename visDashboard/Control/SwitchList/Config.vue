<template>
  <div class="card-container">
    <config-item
      :label="$t('SwitchList.Config.100022-0')"
      :label-width="90"
    >
      <IconLibrary
        v-model:type="config.iconType"
        style="margin-right: 6px"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchList.Config.100022-1')"
      :label-width="90"
    >
      <ColorPicker
        v-model:value="config.iconColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchList.Config.100022-2')"
      :label-width="90"
    >
      <a-select
        v-model:value="config.iconAnimation"
        style="width: 100%"
        @change="onChange"
      >
        <a-select-option value="none">{{ $t('SwitchList.Config.100022-3') }}</a-select-option>
        <a-select-option value="clockwise">{{ $t('SwitchList.Config.100022-4') }}</a-select-option>
        <a-select-option value="anticlockwise">{{ $t('SwitchList.Config.100022-5') }}</a-select-option>
        <a-select-option value="shake">{{ $t('SwitchList.Config.100022-6') }}</a-select-option>
      </a-select>
    </config-item>
    <config-item
      :label="$t('SwitchList.Config.100022-7')"
      :label-width="90"
    >
      <a-slider
        v-model:value="config.iconSpeed"
        :min="0.1"
        :max="5"
        :step="0.1"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('SwitchList.Config.100022-8')"
      :label-width="90"
    >
      <ColorPicker
        v-model:value="config.switchColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
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
const config = ref<any>({
  iconType: 'PlusOutlined',
  iconColor: '#ffcc80',
  iconAnimation: 'none',
  iconSpeed: 10,
  switchColor: '#1890ff'
})

const onChange = () => {
  emits('change', config.value, 'switchList')
}

watch(
  () => props.configData?.componentProps?.switchList,
  (newVal) => {
    config.value = cloneDeep(
      newVal || {
        iconType: 'PlusOutlined',
        iconColor: '#ffcc80',
        iconAnimation: 'none',
        iconSpeed: 10,
        switchColor: '#1890ff'
      }
    )
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
