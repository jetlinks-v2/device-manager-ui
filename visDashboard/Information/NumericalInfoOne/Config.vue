<template>
  <div class="card-container">
    <config-item :label="$t('NumericalInfoOne.Config.100029-0')">
      <ColorPicker
        v-model:value="config.fontColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
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
    default: 'numericalInfoOne'
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
