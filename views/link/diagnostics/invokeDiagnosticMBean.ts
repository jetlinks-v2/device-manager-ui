import i18n from '@jetlinks-web-core/locales'
import type { MBeanDescriptor, MBeanInvocation, MBeanOperation } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { invokeMBean } from '../../../api/link/diagnostics'
import type { useClusterBuffers } from '../RuntimeMonitor/useClusterBuffers'

/** 只识别当前元数据声明的持久化队列统计重置，不影响其他对象的同名方法。 */
function isBufferResetOperation(bean: MBeanDescriptor, operation: MBeanOperation) {
  return bean.domain === 'org.jetlinks' && bean.type === 'PersistenceBuffer' && operation.name === 'resetMonitor'
    && Array.isArray(operation.signature) && operation.signature.length === 0
    && Array.isArray(operation.parameters) && operation.parameters.length === 0
}
export function bufferResetOperation(bean: MBeanDescriptor): MBeanOperation | undefined {
  return bean.operations.find(operation => isBufferResetOperation(bean, operation))
}

/** 两种操作入口共用宿主屏障；调用方先用当前元数据与权限验证请求。 */
export async function invokeDiagnosticMBean(nodeId: string, invocation: MBeanInvocation, signal: AbortSignal, collector?: ReturnType<typeof useClusterBuffers>) {
  signal.throwIfAborted()
  const reset = invocation.args.length === 0 && isBufferResetOperation(invocation.bean, invocation.operation)
  const session = reset ? collector?.beginReset(nodeId, invocation.bean.objectName) : undefined
  if (reset && !session) throw new Error(i18n.global.t('RuntimeMonitor.bufferResetUnavailable'))
  const cancel = () => session?.finish(false)
  if (session) signal.addEventListener('abort', cancel, { once: true })
  try {
    const response = await invokeMBean(nodeId, invocation, signal)
    if (!response.success) throw Object.assign(new Error(response.message || 'MBean invocation failed'), { status: response.status })
    if (!signal.aborted) session?.finish(true)
    return response.result ?? null
  } finally {
    if (session) signal.removeEventListener('abort', cancel)
    session?.finish(false)
  }
}
