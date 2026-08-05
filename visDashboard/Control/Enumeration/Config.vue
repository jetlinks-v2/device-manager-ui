<template>
  <div class="card-container">
    <config-item
      :label="$t('Enumeration.Config.100021-0')"
      :labelWidth="90"
    >
      <a-switch v-model:checked="config.showBorder"></a-switch>
    </config-item>
    <template v-if="config.showBorder">
      <config-item
        :label="$t('Enumeration.Config.100021-1')"
        :labelWidth="90"
      >
        <ColorPicker
          v-model:value="config.borderColor"
          style="margin-right: 6px"
          theme="white"
          @change="onChange"
        />
      </config-item>
      <config-item
        :label="$t('Enumeration.Config.100021-2')"
        :labelWidth="90"
      >
        <a-slider
          v-model:value="config.borderRadius"
          :min="0"
          :max="10"
          @change="onChange"
        />
      </config-item>
      <config-item
        :label="$t('Enumeration.Config.100021-3')"
        :labelWidth="90"
      >
        <a-slider
          v-model:value="config.borderWidth"
          :min="0"
          :max="10"
          @change="onChange"
        />
      </config-item>
    </template>

    <config-item
      :label="$t('Enumeration.Config.100021-4')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.defaultBgColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-5')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.selectBgColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-6')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.fontSize"
        :min="12"
        :max="48"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-7')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.defaultFontColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-8')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.selectFontColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-9')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.hoverBgColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-10')"
      :labelWidth="90"
    >
      <ColorPicker
        v-model:value="config.hoverFontColor"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-11')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.itemGap"
        :min="0"
        :max="32"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-12')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.itemPadding"
        :min="4"
        :max="32"
        @change="onChange"
      />
    </config-item>
    <config-item
      :label="$t('Enumeration.Config.100021-13')"
      :labelWidth="90"
    >
      <a-switch v-model:checked="config.transition"></a-switch>
    </config-item>
    <config-item
      v-if="config.transition"
      :label="$t('Enumeration.Config.100021-14')"
      :labelWidth="90"
    >
      <a-slider
        v-model:value="config.transitionDuration"
        :min="100"
        :max="1000"
        :step="50"
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
  emits('change', config.value, 'enumeration')
}

watch(
  () => props.configData?.componentProps?.enumeration,
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
