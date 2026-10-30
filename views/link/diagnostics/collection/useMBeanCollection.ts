import { inject, onScopeDispose, watch, type InjectionKey } from 'vue'
import type { createMBeanCollectionManager, MBeanDemand, MBeanResult } from './manager'

type Manager = ReturnType<typeof createMBeanCollectionManager>
export const mbeanCollectionContext: InjectionKey<Manager> = Symbol('runtime-mbean-collection')

/** 业务 hook 声明投影并消费结果，不能自行创建周期请求。 */
export function useMBeanCollection(demand: () => MBeanDemand, receive: (result: MBeanResult) => void, owner?: Manager) {
  const manager = owner ?? inject(mbeanCollectionContext, undefined)
  if (!manager) throw new Error('MBean collection requires RuntimeWorkspace provider')
  const registration = manager.register(receive)
  watch(demand, value => registration.update(value), { immediate: true, deep: true, flush: 'sync' })
  onScopeDispose(registration.dispose)
  return { refresh: manager.refresh }
}
