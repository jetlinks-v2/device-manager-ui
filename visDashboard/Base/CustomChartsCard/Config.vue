<template>
  <div class="card-container">
    <config-item :label="$t('CustomChartsCard.Config.100005-0')">
      <a-input
        v-model:value="config.topTitle"
        :maxlength="64"
        :placeholder="$t('CustomChartsCard.Config.100005-1')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomChartsCard.Config.100005-2')">
      <a-input
        v-model:value="config.tooltip"
        :maxlength="64"
        :placeholder="$t('CustomChartsCard.Config.100005-3')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomChartsCard.Config.100005-4')">
      <a-input
        v-model:value="config.bottomTitle"
        :maxlength="64"
        :placeholder="$t('CustomChartsCard.Config.100005-5')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('AlertStats.Config.100003-5')">
      <ColorPicker
        v-model:value="config.color"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('AlertStats.Config.100003-6')">
      <a-switch
        v-model:checked="config.hoverTip"
        @change="onChange"
      />
    </config-item>

    <template v-if="config.hoverTip">
      <config-item :label="$t('AlertStats.Config.100003-7')">
        <a-input
          v-model:value="config.hoverTitle"
          :maxlength="64"
          :placeholder="$t('AlertStats.Config.100003-8')"
          @change="onChange"
        />
      </config-item>
    </template>
  </div>
</template>

<script lang="ts" name="CustomChartsCard" setup>
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  }
})

const { ConfigItem, ColorPicker } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const emits = defineEmits(['change'])
const config = ref<any>({})

const onChange = () => {
  emits('change', config.value, 'customChartsCard')
}

watch(
  () => props.configData?.componentProps?.customChartsCard,
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
