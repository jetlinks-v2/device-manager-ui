<template>
  <div class="card-container">
    <!-- ON 配置 -->
    <config-item :label="$t('SwitchStatusOne.Config.100031-0')">
      <IconLibrary
        v-model:type="config.onIcon"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('SwitchStatusOne.Config.100031-1')">
      <ColorPicker
        v-model:value="config.onIconColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <!-- 动画配置 -->
    <config-item :label="$t('SwitchStatusOne.Config.100031-2')">
      <a-select
        v-model:value="config.onAnimation"
        style="width: 100%"
        @change="onChange"
      >
        <a-select-option value="none">{{ $t('SwitchStatusOne.Config.100031-3') }}</a-select-option>
        <a-select-option value="clockwise">{{ $t('SwitchStatusOne.Config.100031-4') }}</a-select-option>
        <a-select-option value="counterclockwise">{{ $t('SwitchStatusOne.Config.100031-5') }}</a-select-option>
        <a-select-option value="shake">{{ $t('SwitchStatusOne.Config.100031-6') }}</a-select-option>
      </a-select>
    </config-item>

    <config-item :label="$t('SwitchStatusOne.Config.100031-7')">
      <a-slider
        v-model:value="config.onAnimationSpeed"
        :min="0.1"
        :max="5"
        :step="0.1"
        @change="onChange"
      />
    </config-item>

    <!-- OFF 配置 -->
    <config-item :label="$t('SwitchStatusOne.Config.100031-8')">
      <IconLibrary
        v-model:type="config.offIcon"
        @change="onChange"
      />
    </config-item>
    <config-item :label="$t('SwitchStatusOne.Config.100031-1')">
      <ColorPicker
        v-model:value="config.offIconColor"
        :isInput="false"
        style="margin-right: 6px"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('SwitchStatusOne.Config.100031-2')">
      <a-select
        v-model:value="config.offAnimation"
        style="width: 100%"
        @change="onChange"
      >
        <a-select-option value="none">{{ $t('SwitchStatusOne.Config.100031-3') }}</a-select-option>
        <a-select-option value="clockwise">{{ $t('SwitchStatusOne.Config.100031-4') }}</a-select-option>
        <a-select-option value="counterclockwise">{{ $t('SwitchStatusOne.Config.100031-5') }}</a-select-option>
        <a-select-option value="shake">{{ $t('SwitchStatusOne.Config.100031-6') }}</a-select-option>
      </a-select>
    </config-item>
    <config-item :label="$t('SwitchStatusOne.Config.100031-7')">
      <a-slider
        v-model:value="config.offAnimationSpeed"
        :min="0.1"
        :max="5"
        :step="0.1"
        @change="onChange"
      />
    </config-item>
  </div>
</template>

<script lang="ts" setup>
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep, throttle } from 'lodash-es'
import IconLibrary from '@jetlinks-web-core/components/IconLibrary/index.vue'
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
    default: 'switchStatusOne'
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
