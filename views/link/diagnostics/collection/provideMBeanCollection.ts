import { computed, onScopeDispose, provide, ref, watch, type Ref } from 'vue'
import { streamMBeanCollection } from '../../../../api/link/mbeanCollection'
import { diagnosticIntervalSeconds } from '../preferences'
import { createMBeanCollectionManager } from './manager'
import { mbeanCollectionContext } from './useMBeanCollection'

/** 工作区拥有身份、周期和传输；KeepAlive 子树仅撤销自己的声明。 */
export function provideMBeanCollection(scope: Ref<string>, enabled: Ref<boolean>, interval: Ref<unknown>) {
  const manager = createMBeanCollectionManager(streamMBeanCollection)
  const visible = ref(typeof document === 'undefined' || !document.hidden)
  const visibility = () => { visible.value = !document.hidden }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility)
  const collecting = computed(() => enabled.value && visible.value)
  provide(mbeanCollectionContext, manager)
  watch([scope, collecting, interval], () => manager.configure({ scope: scope.value, enabled: collecting.value, interval: diagnosticIntervalSeconds(interval.value) }), { immediate: true, flush: 'sync' })
  onScopeDispose(() => { manager.dispose(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility) })
  return manager
}
