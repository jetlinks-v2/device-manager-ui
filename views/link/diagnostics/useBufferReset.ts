import { watch, type Ref } from 'vue'
import type { MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { useClusterBuffers } from '../RuntimeMonitor/useClusterBuffers'
import { diagnosticErrorState } from './status'
import { bufferResetOperation, invokeDiagnosticMBean } from './invokeDiagnosticMBean'

/** 单队列统计操作；权限、激活和身份均属于宿主，不进入通用展示组件。 */
export function useBufferReset(nodeId: Ref<string>, enabled: Ref<boolean>, scopeKey: Ref<string>, beans: Ref<MBeanDescriptor[]>, allowed: Ref<boolean>, collector?: ReturnType<typeof useClusterBuffers>) {
  const action = useDiagnosticQuery<void>({ retainOnDeactivate: true })
  watch([nodeId, enabled, scopeKey, allowed], () => action.clear(), { flush: 'sync' })
  async function reset(objectName: string) {
    if (!enabled.value || !allowed.value || !nodeId.value || action.state.value.status === 'loading') return
    const bean = beans.value.find(item => item.objectName === objectName)
    const operation = bean && bufferResetOperation(bean)
    if (!bean || !operation) return
    const target = nodeId.value
    await action.run(async signal => {
      await invokeDiagnosticMBean(target, { bean, operation, args: [] }, signal, collector)
    }, true, { errorState: diagnosticErrorState })
  }
  return { state: action.state, reset }
}
