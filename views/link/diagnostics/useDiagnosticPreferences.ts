import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import {
  diagnosticPreferenceKey, emptyDiagnosticPreferences, sanitizeDiagnosticPreferences,
  type DiagnosticNodePreference, type DiagnosticPreferences, type DiagnosticPreferenceScope,
} from './preferences'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const preferenceContext: InjectionKey<ReturnType<typeof createDiagnosticPreferences>> = Symbol('runtime-diagnostic-preferences')
const browserStorage = (): PreferenceStorage | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}

/** 宿主注入账号 / 项目；失败只影响恢复，不阻止当前会话浏览。 */
export function createDiagnosticPreferences(scope: Ref<DiagnosticPreferenceScope>, storage = browserStorage) {
  const key = computed(() => diagnosticPreferenceKey(scope.value))
  const value = ref<DiagnosticPreferences>(emptyDiagnosticPreferences())
  watch(key, current => {
    value.value = emptyDiagnosticPreferences()
    if (!current) return
    try {
      const saved = storage()?.getItem(current)
      if (saved) value.value = sanitizeDiagnosticPreferences(JSON.parse(saved))
    } catch { /* 隐私模式、损坏JSON或配额限制均回退本会话配置。 */ }
  }, { immediate: true, flush: 'sync' })

  /** 写入前再次白名单清理，调用方不能借此保存日志或采集任务。 */
  function update(patch: Partial<DiagnosticPreferences>) {
    value.value = sanitizeDiagnosticPreferences({ ...value.value, ...patch, version: 1 })
    try { if (key.value) storage()?.setItem(key.value, JSON.stringify(value.value)) } catch { /* 当前会话仍保留配置。 */ }
  }
  function updateNode(nodeId: string, patch: Partial<DiagnosticNodePreference>) {
    if (!nodeId) return
    update({ nodes: Object.fromEntries([...Object.entries(value.value.nodes).filter(([id]) => id !== nodeId), [nodeId, { ...value.value.nodes[nodeId], ...patch }]]) })
  }
  function clear() {
    value.value = emptyDiagnosticPreferences()
    try { if (key.value) storage()?.removeItem(key.value) } catch { /* 不依赖存储完成本地清除。 */ }
  }
  return { value, key, update, updateNode, clear }
}

export function provideDiagnosticPreferences(scope: Ref<DiagnosticPreferenceScope>) {
  const preferences = createDiagnosticPreferences(scope)
  provide(preferenceContext, preferences)
  return preferences
}
export const useDiagnosticPreferences = () => inject(preferenceContext, undefined)
