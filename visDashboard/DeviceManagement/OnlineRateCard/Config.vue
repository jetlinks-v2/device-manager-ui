<template>
  <div class="card-container">
    <config-item label="图表颜色">
      <ColorPicker
        v-model:value="config.color"
        :isInput="false"
        theme="white"
        @change="onChange"
      />
    </config-item>

    <config-item label="显示悬浮提示">
      <a-switch
        v-model:checked="config.hoverTip"
        @change="onChange"
      />
    </config-item>

    <template v-if="config.hoverTip">
      <config-item label="提示标题">
        <a-input
          v-model:value="config.hoverTitle"
          :maxlength="64"
          placeholder="请输入提示标题"
          @change="onChange"
        />
      </config-item>
    </template>

    <config-item label="自动刷新">
      <a-switch
        v-model:checked="config.isAutoRefresh"
        @change="onChange"
      />
    </config-item>

    <template v-if="config.isAutoRefresh">
      <config-item label="刷新间隔">
        <a-space>
          <InputNumber
            v-model:value="config.interval"
            :max="999999"
            :min="1"
            :valueOnClear="1"
            style="width: 100%"
            @change="onChange"
          />
          <span>秒</span>
        </a-space>
      </config-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { cloneDeep } from 'lodash-es'

defineOptions({
  name: 'OnlineRateCardConfig'
})

const { ConfigItem, ColorPicker, InputNumber } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['change'])
const config = ref<any>({})

const onChange = () => {
  emit('change', config.value, 'onlineRateCard')
}

watch(
  () => props.configData?.componentProps?.onlineRateCard,
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
  margin-left: 20px;
}
</style>
