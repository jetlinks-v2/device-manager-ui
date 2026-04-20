<template>
  <div class="card-container">
    <config-item
      :label="$t('SwitchOne.Config.100023-0')"
      :label-width="90"
    >
      <a-switch
        v-model:checked="config.showValue"
        @change="onChange"
      ></a-switch>
    </config-item>

    <config-item
      :label="$t('SwitchOne.Config.100023-1')"
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
  emits('change', config.value, 'switchOne')
}

watch(
  () => props.configData?.componentProps?.switchOne,
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
