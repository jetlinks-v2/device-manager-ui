import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getI18nText } from '../../../../utils/i18n'
import { loadGatewayOutline } from './loadOutline'
import { buildOutlineSections, displayOutlineValue } from './outlineSections'
import type { GatewayRecord, GatewayOutlineModel } from './types'

/** 详情只读状态与请求生命周期；关闭/切换对象后丢弃过期响应。 */
export function useGatewayOutline(props: { data: GatewayRecord; draft: boolean }) {
  const { t } = useI18n()
  const model = shallowRef<GatewayOutlineModel>()
  const loading = ref(true)
  const unexpectedError = ref(false)
  const revision = ref(0)
  const reload = () => { revision.value++ }
  watch([() => props.data, () => props.draft, revision], async ([data, draft], _, onCleanup) => {
    let active = true
    onCleanup(() => { active = false })
    loading.value = true
    unexpectedError.value = false
    model.value = undefined
    try {
      const loaded = await loadGatewayOutline(data, draft)
      if (active) model.value = loaded
    } catch {
      if (active) unexpectedError.value = true
    } finally {
      if (active) loading.value = false
    }
  }, { immediate: true, deep: true })

  const gateway = computed(() => model.value?.gateway || props.data)
  const name = computed(() => displayOutlineValue(getI18nText(gateway.value, 'name'), t))
  const providerName = computed(() => getI18nText(model.value?.provider, 'name') || gateway.value.provider || t('GatewayEditor.unconfigured'))
  const state = computed(() => gateway.value.state)
  const status = computed(() => state.value?.value === 'enabled' ? 'success' : state.value?.value === 'disabled' ? 'error' : 'default')
  const sections = computed(() => model.value ? buildOutlineSections(model.value, t) : [])
  const hasError = computed(() => unexpectedError.value || !!model.value?.issues.length || model.value?.children.some(item => item.issues.length))
  return { t, loading, name, providerName, state, status, sections, hasError, reload }
}
