import { inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { mergeObjectArrays } from '@jetlinks-web-core/utils'
import { removeFn } from '../../../api/link/plugin'
import type { PluginDriverRecord } from '../../../api/link/pluginRuntime'

export interface PluginCardAction {
  key: string; text: string; icon: string; disabled?: boolean
  popConfirm?: { title?: string; onConfirm?: () => unknown }
  tooltip?: { title?: string }
  onClick?: () => unknown
}
export function usePluginActions(refresh: () => void) {
  const { t } = useI18n()
  const visible = ref(false)
  const editData = ref<PluginDriverRecord>()
  const parent = inject<{ getActions?: (data: PluginDriverRecord) => PluginCardAction[] }>('getActions', {})
  function add() { editData.value = undefined; visible.value = true }
  function save() {
    visible.value = false
    refresh()
  }
  function actions(data: PluginDriverRecord): PluginCardAction[] {
    const managed = !!(data.configuration?.sourceId || data.configuration?.autoCreate)
    const action = (key: string) => t(`plugin.index.293829-${key === 'update' ? '8' : '9'}`)
    const tooltip = (key: string) => ({ title: managed ? t('plugin.index.293829-14', [action(key)]) : action(key) })
    return mergeObjectArrays([
      { key: 'update', text: action('update'), icon: 'EditOutlined', disabled: managed, tooltip: tooltip('update'),
        onClick: () => { editData.value = data; visible.value = true } },
      { key: 'delete', text: action('delete'), icon: 'DeleteOutlined', disabled: managed, tooltip: tooltip('delete'),
        popConfirm: { title: t('plugin.index.293829-10'), onConfirm: async () => {
          const response = await removeFn(data.id)
          if (response.status === 200) { onlyMessage(t('plugin.index.293829-11')); refresh() }
          else onlyMessage(response.message || t('plugin.index.293829-12'), 'error')
        } } },
    ], parent.getActions?.(data) || []).filter((item: PluginCardAction) => item.key !== 'view')
  }
  return { visible, editData, add, save, actions }
}
