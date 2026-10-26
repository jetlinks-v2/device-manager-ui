import { computed, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import { createFlameGraphHtml, type FlameFrame, type JfrSnapshot, type JvmDiagnosticAccess, type SamplingState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { streamDiagnostic } from '../../../api/link/diagnosticStream'
import { sampleThreads, saveDiagnosticFile } from '../../../api/link/diagnostics'
import { normalizeThreads } from './normalize'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import { diagnosticContentState, diagnosticErrorState } from './status'

type JvmTab = 'threads' | 'performance' | 'memory'
const FIRST_FRAME_DELAY_SECONDS = 15, UPDATE_DELAY_SECONDS = 5
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
/** 服务端发累计快照，整份替换；未知/无效计数不能转成健康的0样本。 */
export function normalizeJfrSnapshot(value: unknown, startedAt: number): JfrSnapshot {
  const raw = record(value)
  if (!Array.isArray(raw.flameGraph)) throw new Error('Invalid JFR snapshot')
  const frames = (items: unknown): FlameFrame[] => !Array.isArray(items) ? [] : items.map(value => {
    const frame = record(value)
    if (typeof frame.className !== 'string' || !Number.isFinite(frame.samples) || Number(frame.samples) < 0) throw new Error('Invalid JFR frame')
    return { className: frame.className, method: typeof frame.method === 'string' ? frame.method : undefined, line: Number.isSafeInteger(frame.line) && Number(frame.line) > 0 ? Number(frame.line) : undefined, samples: Number(frame.samples), children: frames(frame.children) }
  })
  return { flameGraph: frames(raw.flameGraph), objectAllocations: Array.isArray(raw.objectAllocations) ? raw.objectAllocations.flatMap(value => {
    const allocation = record(value)
    return typeof allocation.className === 'string' && Number.isFinite(allocation.allocationSize) && Number(allocation.allocationSize) >= 0
      ? [{ className: allocation.className, allocationSize: Number(allocation.allocationSize) }] : []
  }) : [], sampledAt: Date.now(), startedAt }
}

/** 每页独立订阅；停止只unsubscribe，绝不调用共享RecordingStream的全局stop。 */
export function useJvmDiagnostics(node: Ref<string>, tool: Ref<string>, pageActive: Ref<boolean> = ref(true)) {
  const permissions = useDiagnosticsAccess(), preferences = useDiagnosticPreferences(), { t } = useI18n()
  const threads = useDiagnosticQuery<ReturnType<typeof normalizeThreads>>({ retainOnDeactivate: true })
  const snapshot = shallowRef<JfrSnapshot>(), sampling = ref<SamplingState>({ status: 'idle' })
  const streamPhase = ref<'connecting' | 'waiting' | 'receiving'>(), elapsedSeconds = ref(0)
  const exportState = ref<string>()
  const captureKind = ref<'jfr' | 'heap-dump'>(), captureLive = ref(false)
  let generation = 0, active = true, subscription: { unsubscribe(): void } | undefined
  let controller: AbortController | undefined
  let exportController: AbortController | undefined
  let clock: ReturnType<typeof setInterval> | undefined
  const access = computed<JvmDiagnosticAccess>(() => ({
    threadDump: { allowed: permissions.value.threads }, jfr: { allowed: permissions.value.jfr }, jfrView: { allowed: permissions.value.jfr },
    jfrExport: { allowed: permissions.value.exportJfr }, heapDump: { allowed: permissions.value.heapDump }, heapExport: { allowed: permissions.value.heap },
  }))
  const activeTab = computed<JvmTab>(() => preferences?.value.value.nodes[node.value]?.jvmTab ?? (permissions.value.threads ? 'threads' : permissions.value.jfr ? 'performance' : 'memory'))
  function selectTab(value: JvmTab) { preferences?.updateNode(node.value, { jvmTab: value }) }
  /** 只度量本页实际接收间隔，不因等待时间增加而制造远端样本或自动中断录制。 */
  function tick() {
    const state = sampling.value
    if (state.startedAt === undefined) return
    const now = Date.now(), quietSeconds = Math.max(0, Math.floor((now - (state.sampledAt ?? state.startedAt)) / 1000))
    elapsedSeconds.value = Math.max(0, Math.floor((now - state.startedAt) / 1000))
    const running = state.status === 'starting' || state.status === 'recording'
    const delay = running && quietSeconds >= (state.sampledAt === undefined ? FIRST_FRAME_DELAY_SECONDS : UPDATE_DELAY_SECONDS)
      ? state.sampledAt === undefined ? 'first-frame' : 'updates' : undefined
    sampling.value = { ...state, quietSeconds, delay }
  }
  function stop() {
    if (clock) tick()
    clearInterval(clock); clock = undefined; streamPhase.value = undefined
    generation++; subscription?.unsubscribe(); subscription = undefined; controller?.abort(); controller = undefined; exportController?.abort()
    sampling.value = { ...sampling.value, delay: undefined, status: snapshot.value || ['starting', 'recording'].includes(sampling.value.status) ? 'stopped' : sampling.value.status }
  }
  function start() {
    if (!active || !pageActive.value || tool.value !== 'jvm' || !node.value || !permissions.value.jfr || subscription) return
    stop()
    const current = ++generation, target = node.value, startedAt = Date.now()
    controller = new AbortController(); snapshot.value = undefined; exportState.value = undefined
    sampling.value = { status: 'starting', startedAt, updateCount: 0, quietSeconds: 0 }
    elapsedSeconds.value = 0; streamPhase.value = 'connecting'; clock = setInterval(tick, 1000)
    const next = streamDiagnostic<unknown>(target, 'jfr', controller.signal, { onRequest() { if (current === generation) streamPhase.value = 'waiting' } }).subscribe({
      next(value) {
        if (current !== generation || !permissions.value.jfr || target !== node.value) return
        try {
          snapshot.value = normalizeJfrSnapshot(value, startedAt)
          sampling.value = { status: 'recording', startedAt, sampledAt: snapshot.value.sampledAt, updateCount: (sampling.value.updateCount ?? 0) + 1, quietSeconds: 0 }
          streamPhase.value = 'receiving'
        } catch (error) { stop(); sampling.value = { ...sampling.value, status: 'error', message: diagnosticErrorState(error).message } }
      },
      error(error) {
        if (current !== generation) return
        const state = diagnosticErrorState(error)
        stop(); sampling.value = { ...sampling.value, status: state.status === 'forbidden' || state.status === 'unsupported' ? state.status : 'error', message: state.message }
        if (['forbidden', 'unsupported'].includes(state.status)) { snapshot.value = undefined; elapsedSeconds.value = 0 }
      },
      complete() { if (current === generation) stop() },
    })
    if (current === generation) subscription = next
    else next.unsubscribe()
  }
  function sample() {
    if (!active || !pageActive.value || tool.value !== 'jvm' || !node.value || !permissions.value.threads || threads.state.value.status === 'loading') return
    return threads.run(signal => sampleThreads(node.value, signal).then(normalizeThreads), true, { errorState: diagnosticErrorState, isEmpty: values => !values.length, retainData: true })
  }
  function requestCapture(kind: 'jfr' | 'heap-dump', live = false) {
    if (!active || !pageActive.value || tool.value !== 'jvm' || !node.value || !(kind === 'jfr' ? permissions.value.exportJfr : permissions.value.heap)) return
    captureLive.value = live; captureKind.value = kind
  }
  async function exportHtml() {
    if (!active || !pageActive.value || tool.value !== 'jvm' || !permissions.value.jfr || !permissions.value.exportJfr || !snapshot.value || !node.value) return
    const target = node.value, frozen = snapshot.value, current = generation
    exportController?.abort(); exportController = new AbortController()
    const html = createFlameGraphHtml({ nodeId: target, snapshot: frozen, platformPrefixes: ['org.jetlinks.'], labels: {
      title: t('runtimeDiagnostics.performance'), search: t('runtimeDiagnostics.flameSearch'), reset: t('runtimeDiagnostics.resetFocus'), samples: t('runtimeDiagnostics.samples'), platform: t('runtimeDiagnostics.platformHotspot'), range: t('runtimeDiagnostics.sampleRange'),
      categories: ['all', 'network', 'platform', 'gc', 'reactive', 'other'].map(key => t(`runtimeDiagnostics.flameCategory.${key}`)),
      noMatches: t('runtimeDiagnostics.noMatchingFrames'),
      insights: {
        samplingHints: t('runtimeDiagnostics.flameInsights.samplingHints'), limited: t('runtimeDiagnostics.flameInsights.limited', { count: '{count}' }),
        invalid: t('runtimeDiagnostics.flameInsights.invalid'), self: t('runtimeDiagnostics.flameInsights.self', { name: '{name}', count: '{count}', total: '{total}' }),
        platform: t('runtimeDiagnostics.flameInsights.platform', { name: '{name}', count: '{count}', total: '{total}' }), none: t('runtimeDiagnostics.flameInsights.none'),
        sampleRule: t('runtimeDiagnostics.flameInsights.sampleRule', { minimum: '{minimum}' }), locate: t('runtimeDiagnostics.flameInsights.locate'),
        evidence: t('runtimeDiagnostics.flameInsights.evidence'), compressed: t('runtimeDiagnostics.flameInsights.compressed', { count: '{count}' }),
        path: t('runtimeDiagnostics.flameInsights.path'), downstream: t('runtimeDiagnostics.flameInsights.downstream'), selfSamples: t('runtimeDiagnostics.flameInsights.selfSamples'),
        inclusiveSamples: t('runtimeDiagnostics.flameInsights.inclusiveSamples'), selfUnavailable: t('runtimeDiagnostics.flameInsights.selfUnavailable'), selfBoundary: t('runtimeDiagnostics.flameInsights.selfBoundary'),
        rawName: t('runtimeDiagnostics.flameInsights.rawName'), copy: t('runtimeDiagnostics.flameInsights.copy'), copied: t('runtimeDiagnostics.flameInsights.copied'), copyFailed: t('runtimeDiagnostics.flameInsights.copyFailed'),
      },
    } })
    try { if (current === generation && permissions.value.exportJfr) await saveDiagnosticFile(new Blob([html], { type: 'text/html' }), `flame-${target}-${Date.now()}.html`, exportController.signal) }
    catch (error) { exportState.value = diagnosticErrorState(error).message }
  }
  watch([node, permissions], () => { stop(); snapshot.value = undefined; sampling.value = { status: 'idle' }; elapsedSeconds.value = 0; threads.clear(); captureKind.value = undefined; exportState.value = undefined }, { flush: 'sync' })
  watch([tool, pageActive], ([value, enabled]) => { if (value !== 'jvm' || !enabled) { stop(); threads.cancel(); captureKind.value = undefined } })
  onDeactivated(() => { active = false; stop(); threads.cancel(); captureKind.value = undefined })
  onActivated(() => { active = true })
  onScopeDispose(stop)
  const threadState = computed(() => diagnosticContentState(threads.state.value, !!threads.data.value?.length))
  return { threads, threadState, snapshot, sampling, streamPhase, elapsedSeconds, access, activeTab, selectTab, start, stop, sample, exportHtml, exportState, captureKind, captureLive, requestCapture }
}
