import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, type Component } from 'vue'
import { routeLocationKey, useRoute } from 'vue-router'
import { gatewayChildSaveKey, gatewayEditorKey, type GatewayChildDraft } from '../gatewayEditorContext'

/** 子编辑器使用局部路由上下文，复用原表单的 provider 分支，不修改地址栏或发出保存请求。 */
export function useGatewayChildContext(
  props: { draft: GatewayChildDraft },
  emit: { (event: 'save', data: Record<string, unknown>): void; (event: 'cancel'): void; (event: 'reselect'): void },
  components: { network: Component; plugin: Component },
) {
  const route = useRoute()
  const parent = inject(gatewayEditorKey, undefined)
  const childRoute = reactive({ ...route,
    params: { ...route.params, id: String(props.draft.data.id || ':id') },
    query: { view: 'false', provider: JSON.stringify(props.draft.provider) },
  })
  provide(routeLocationKey, childRoute)
  provide(gatewayChildSaveKey, data => emit('save', data))
  // 已添加的子网关保持原接入方式，父网关是否已保存不影响该限制。
  const canReselect = computed(() => props.draft.mode === 'create')
  provide(gatewayEditorKey, {
    canReselect, cancel: () => emit('cancel'), reselect: () => {
      if (canReselect.value) emit('reselect')
    },
  })
  onMounted(() => parent?.setTitleProvider?.(props.draft.provider))
  onBeforeUnmount(() => parent?.setTitleProvider?.())
  return { component: computed(() => props.draft.provider.id === 'plugin_gateway' ? components.plugin : components.network) }
}
