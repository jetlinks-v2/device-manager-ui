<template>
  <div class="config-container">
    <config-item :label="$t('NumericalListOne.Config.100035-0')">
      <IconLibrary
        v-model:type="config.icon"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('NumericalListOne.Config.100035-1')">
      <ColorPicker
        v-model:value="config.iconColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('NumericalListOne.Config.100035-2')">
      <a-input
        v-model:value="config.unit"
        :placeholder="$t('NumericalListOne.Config.100035-3')"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import IconLibrary from '@jetlinks-web-core/components/IconLibrary/index.vue'
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
    default: 'numericalListOne'
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
