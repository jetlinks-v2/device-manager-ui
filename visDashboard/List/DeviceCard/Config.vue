<template>
  <div class="card-container">
    <config-item :label="$t('DeviceCard.Config.100033-0')" labelWidth="90">
      <a-slider
        v-model:value="config.gap"
        :min="0"
        :max="24"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-1')" labelWidth="90">
      <ColorPicker
        v-model:value="config.cardBgColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-2')" labelWidth="90">
      <ColorPicker
        v-model:value="config.cardSelectedBgColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-3')"  labelWidth="90">
      <a-switch
        v-model:checked="config.showBorder"
        @change="onChange"
      />
    </config-item>
    <config-item
      v-if="config.showBorder"
      :label="$t('DeviceCard.Config.100033-4')"
       labelWidth="90"
    >
      <a-slider
        v-model:value="config.borderWidth"
        :min="1"
        :max="5"
        @change="onChange"
      />
    </config-item>
    <config-item
      v-if="config.showBorder"
      :label="$t('DeviceCard.Config.100033-5')"
       labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.borderColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-6')"  labelWidth="90">
      <a-switch
        v-model:checked="config.showShadow"
        @change="onChange"
      />
    </config-item>
    <config-item
      v-if="config.showShadow"
      :label="$t('DeviceCard.Config.100033-7')"
       labelWidth="90"
    >
      <a-slider
        v-model:value="config.shadowSize"
        :min="1"
        :max="24"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-8')"  labelWidth="90">
      <a-slider
        v-model:value="config.borderRadius"
        :min="0"
        :max="24"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('DeviceCard.Config.100033-9')"  labelWidth="90">
      <a-switch
        v-model:checked="config.selectFirstByDefault"
        @change="onChange"
      />
      <template #tip>{{ $t('DeviceCard.Config.100033-10') }}</template>
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
    default: 'deviceCard'
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
