import { defineComponent, h, watch, type Ref } from 'vue'
import type { MetricContext } from '@jetlinks-web-core/components'
import MetricSourceModal from './MetricSourceModal.vue'
import { useMetricSourcePicker } from './useMetricSourcePicker'

/** 公开来源适配：调用者仅消费 picker 与 host，不依赖设备模块私有弹窗状态。 */
export function useMetricSourceAdapter(context: Ref<MetricContext>) {
  const state = useMetricSourcePicker()
  watch(() => [context.value.ownerType, context.value.ownerId], state.cancel)
  const host = defineComponent({ name: 'MetricDeviceSourceHost', setup: () => () => h(MetricSourceModal, { state }) })
  return { pickSource: state.pickSource, host }
}
