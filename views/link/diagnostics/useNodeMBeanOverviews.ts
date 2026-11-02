import { computed, shallowRef, watch, type Ref } from 'vue'
import { mbeanOverviewRenderers, type MBeanOverviewEntry } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useMBeanCollection } from './collection/useMBeanCollection'
import { normalizeMBeans } from './normalize'
import { diagnosticErrorState } from './status'

/** 模块在路由装配前完成注册；概览只向统一采集器声明当前节点的轻量属性。 */
export function useNodeMBeanOverviews(nodeId: Ref<string>, enabled: Ref<boolean>, scopeKey: Ref<string>, canRead: Ref<boolean>) {
  const entries = shallowRef<MBeanOverviewEntry[]>([])
  watch([nodeId, scopeKey, canRead], () => { entries.value = [] }, { flush: 'sync' })
  const collections = mbeanOverviewRenderers().map(renderer => useMBeanCollection(
    () => ({ nodeIds: [nodeId.value], enabled: enabled.value && canRead.value, name: renderer.overview.name, attributes: renderer.overview.attributes }),
    result => {
      if (!enabled.value || !canRead.value || result.nodeId !== nodeId.value) return
      const others = entries.value.filter(entry => entry.id !== renderer.id)
      if (result.status === 'fulfilled') {
        const beans = normalizeMBeans(result.value, true)
        entries.value = [...others, ...beans.map(bean => ({ id: renderer.id, bean, state: { status: 'ready' as const, sampledAt: result.collectedAt } }))]
        return
      }
      const failure = diagnosticErrorState(result.reason), previous = entries.value.filter(entry => entry.id === renderer.id)
      entries.value = [...others, ...(previous.length && !['forbidden', 'unsupported'].includes(failure.status)
        ? previous.map(entry => ({ ...entry, state: { ...failure, status: 'stale' as const, sampledAt: entry.state.sampledAt } }))
        : [{ id: renderer.id, state: failure }])]
    },
  ))
  return { entries: computed(() => entries.value), refresh: () => { if (enabled.value && canRead.value) collections[0]?.refresh() } }
}
