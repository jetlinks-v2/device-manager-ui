import { computed, onScopeDispose, ref, watch } from 'vue'
import { loadMetricOutputs, type MetricOutputSource } from '../../../api/metricSources'
import type { MetricSourceRequest } from '@jetlinks-web-core/components'
import type { Ref, ShallowRef } from 'vue'

/** 候选始终属于当前选择及授权生命周期；迟到请求不能回填另一个对象。 */
export function useMetricOutputSources(request:ShallowRef<MetricSourceRequest | undefined>, deviceId:Ref<string>, active:Ref<boolean>) {
  const items = ref<MetricOutputSource[]>([]), loading = ref(false), error = ref(false)
  let generation = 0
  const object = computed(() => {
    const context = request.value?.context
    return deviceId.value ? { type:'device', id:deviceId.value } : context ? { type:context.ownerType, id:context.ownerId } : undefined
  })
  async function load() {
    const token = ++generation
    items.value = []; error.value = false; loading.value = false
    if (!active.value || !request.value || !object.value || request.value.context.scope === 'children') return
    loading.value = true
    try {
      const values = await loadMetricOutputs(object.value.type, object.value.id)
      if (token === generation) items.value = values.filter(item => item.config.id !== request.value?.configId)
    } catch { if (token === generation) error.value = true }
    finally { if (token === generation) loading.value = false }
  }
  watch([request, object, active], load, { immediate:true })
  onScopeDispose(() => { generation++ })
  return { items, loading, error, load, object }
}
