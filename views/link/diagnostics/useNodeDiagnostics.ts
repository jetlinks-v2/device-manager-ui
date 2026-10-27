import { computed, onActivated, onDeactivated, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { MBeanDisplayConfig, MBeanInvocation, MBeanInvocationOutcome, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from './normalize'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticContentState, diagnosticErrorState } from './status'
import { isRuntimeMonitorRoute } from '../RuntimeMonitor/routeScope'
import { useClusterBufferContext } from '../RuntimeMonitor/useClusterBuffers'
import { invokeDiagnosticMBean } from './invokeDiagnosticMBean'

/** 发现元数据不执行getter；只为当前对象读取属性，切换对象隔离旧值与执行结果。 */
export function useNodeDiagnostics(node: Ref<string>, tab: Ref<string>, pageActive: Ref<boolean> = ref(true)) {
  const access = useDiagnosticsAccess()
  const collector = useClusterBufferContext()
  const route = useRoute(), router = useRouter(), preferences = useDiagnosticPreferences()
  const metadata = useDiagnosticQuery<ReturnType<typeof normalizeMBeans>>({ retainOnDeactivate: true })
  const detail = useDiagnosticQuery<ReturnType<typeof normalizeMBeans>>({ retainOnDeactivate: true })
  const invocation = useDiagnosticQuery<unknown>({ retainOnDeactivate: true })
  let invocationGeneration = 0
  const activated = ref(true), selectedBean = ref('')
  const allowed = computed(() => activated.value && pageActive.value && isRuntimeMonitorRoute(route) && !!node.value && tab.value === 'mbean' && access.value.monitor)
  const ownsRoute = computed(() => allowed.value && (!route.query.nodeId || route.query.nodeId === node.value))
  const beans = computed(() => (metadata.data.value ?? []).map(bean => detail.data.value?.find(value => value.objectName === bean.objectName) ?? bean))
  const config = computed(() => preferences?.value.value.nodes[node.value]?.mbeanDisplay)
  function configure(value: MBeanDisplayConfig) { if (allowed.value) preferences?.updateNode(node.value, { mbeanDisplay: value }) }
  function selectBean(objectName: string) {
    if (!ownsRoute.value || !metadata.data.value?.some(bean => bean.objectName === objectName)) return
    invocationGeneration++; invocation.clear()
    selectedBean.value = objectName
    preferences?.updateNode(node.value, { bean: objectName })
    if (route.query.bean !== objectName) void router.replace({ query: { ...route.query, bean: objectName } })
  }
  async function loadBeans() {
    if (!allowed.value) return
    await metadata.run(async signal => {
      return normalizeMBeans(await queryMBeans(node.value, signal, '*:*', []), true)
    }, true, { errorState: diagnosticErrorState, isEmpty: values => !values.length, retainData: true })
    clearRefused(metadata.state.value)
  }
  async function loadDetail() {
    const target = selectedBean.value
    if (!allowed.value || !target) return
    await detail.run(async signal => normalizeMBeans(await queryMBeans(node.value, signal, target), true), true, { errorState: diagnosticErrorState, retainData: detail.data.value?.[0]?.objectName === target })
    clearRefused(detail.state.value)
  }
  function clearRefused(state: ViewState) {
    if (!['forbidden', 'unsupported'].includes(state.status)) return
    metadata.clear(state); detail.clear(state); invocationGeneration++; invocation.clear(); selectedBean.value = ''
  }
  function syncSelection(refresh = false) {
    if (!ownsRoute.value) return
    const requested = typeof route.query.bean === 'string' ? route.query.bean : preferences?.value.value.nodes[node.value]?.bean ?? selectedBean.value
    const next = metadata.data.value?.find(bean => bean.objectName === requested)?.objectName ?? metadata.data.value?.find(bean => bean.objectName === selectedBean.value)?.objectName ?? metadata.data.value?.[0]?.objectName ?? ''
    if (selectedBean.value !== next) { detail.clear(); invocationGeneration++; invocation.clear(); selectedBean.value = next }
    else if (refresh) void loadDetail()
  }
  function pause() { metadata.cancel(); detail.cancel(); invocationGeneration++; invocation.cancel() }
  watch([node, access], () => {
    metadata.clear(); detail.clear(); invocationGeneration++; invocation.clear()
    selectedBean.value = ''
    if (allowed.value) void loadBeans()
  })
  watch(allowed, value => { if (value) { syncSelection(); void loadBeans() } else pause() }, { immediate: true })
  watch(selectedBean, () => { if (allowed.value) void loadDetail() })
  watch(() => metadata.data.value, () => syncSelection(true))
  watch([() => route.query.bean, () => route.query.nodeId], () => syncSelection())
  onDeactivated(() => { activated.value = false; pause() })
  onActivated(() => { activated.value = true })
  async function executeInvocation(value: MBeanInvocation): Promise<MBeanInvocationOutcome | undefined> {
    if (!allowed.value || !access.value.invoke || !node.value || invocation.state.value.status === 'loading' || selectedBean.value !== value.bean.objectName) return
    const known = metadata.data.value?.find(bean => bean.objectName === value.bean.objectName)
    const operation = known?.operations.find(operation => operation.name === value.operation.name && JSON.stringify(operation.signature) === JSON.stringify(value.operation.signature))
    if (!known || !operation || value.args.length !== operation.signature.length) return
    const target = node.value, objectName = known.objectName, current = ++invocationGeneration
    let completed = false, ownResult: unknown
    await invocation.run(async signal => {
      try {
        const result = await invokeDiagnosticMBean(target, { bean: known, operation, args: value.args }, signal, collector)
        if (!signal.aborted) { completed = true; ownResult = result }
        return result
      } catch (error) {
        if (!signal.aborted) completed = true
        throw error
      }
    }, access.value.invoke, { errorState: diagnosticErrorState })
    const state = { ...invocation.state.value }
    clearRefused(state)
    if (!completed || current !== invocationGeneration || !allowed.value || !access.value.invoke || node.value !== target || selectedBean.value !== objectName) return
    return { state, result: ownResult }
  }
  function invoke(value: MBeanInvocation) { return executeInvocation(value) }
  const beanState = computed(() => access.value.monitor ? diagnosticContentState(metadata.state.value, !!metadata.data.value?.length) : { status: 'forbidden' as const })
  const detailState = computed(() => diagnosticContentState(detail.state.value, !!detail.data.value?.some(bean => bean.objectName === selectedBean.value)))
  return { metadata, beans, detail, detailState, invocation, loadBeans, invoke, executeInvocation, beanState, selectedBean, selectBean, config, configure }
}
