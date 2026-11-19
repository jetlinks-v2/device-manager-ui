<template>
  <section ref="root" class="device-child-mapping">
    <a-spin :spinning="loading">
      <a-alert v-if="loadFailed" type="error" show-icon :message="$t('DeviceChildMapping.loadFailed')" />
      <div v-if="ready" class="device-child-mapping__content" :style="{ height: `${availableHeight}px` }">
        <Child :key="deviceId" ref="mapping" />
      </div>
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import Child from './index.vue'
import { useEmbeddedChildDeviceContext, type ChildDeviceMappingHandle } from './useChildDeviceContext'

// deviceId 必须是运行时设备实例 ID，而非运营资产 ID。
const props = defineProps<{ deviceId: string }>()
const { t: $t } = useI18n()
const root = ref<HTMLElement>()
const { top } = useElementBounding(root)
const { height: viewportHeight } = useWindowSize()
// 随宿主摘要、页签及窗口变化填充剩余空间，避免固定高度造成底部空白或页面溢出。
const availableHeight = computed(() => Math.max(320, viewportHeight.value - Math.max(0, top.value) - 24))
const mapping = ref<ChildDeviceMappingHandle>()
const { loading, loadFailed, ready, refresh, beforeLeave } = useEmbeddedChildDeviceContext(
  toRef(props, 'deviceId'), mapping,
)
// 刷新动作交由宿主分类栏展示，继续使用同一保存确认与加载状态。
defineExpose({ beforeLeave, refresh, loading })
</script>

<style scoped lang="less">
.device-child-mapping { min-width: 0; }
.device-child-mapping__content { min-height: 0; }
</style>
