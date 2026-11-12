import type { ComputedRef, InjectionKey, ShallowRef } from 'vue'

export interface GatewayChildDraft {
  provider: { id: string; name?: string; description?: string; type?: string; channel?: string }
  data: Record<string, unknown>
  mode: 'create' | 'edit'
}

export const gatewayChildSaveKey: InjectionKey<(data: Record<string, unknown>) => void> = Symbol('gateway-child-save')

// 独立于子编辑器上下文，所有类型和内嵌子配置共用当前弹窗的原生 footer。
export const gatewayFooterHostKey: InjectionKey<ShallowRef<HTMLElement | undefined>> = Symbol('gateway-footer-host')

export const gatewayEditorKey: InjectionKey<{
  canReselect: ComputedRef<boolean>
  cancel: () => void
  reselect: () => void
  setTitleProvider?: (provider?: GatewayChildDraft['provider']) => void
}> = Symbol('gateway-editor')
