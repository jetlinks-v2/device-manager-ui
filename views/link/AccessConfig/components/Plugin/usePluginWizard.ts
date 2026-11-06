import { nextTick } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import type { usePluginEditor } from './usePluginEditor'
import { basicGatewayStep, useGatewayWizard } from '../useGatewayWizard'
import { findGatewayResource } from '../gatewayOverview'

export function usePluginWizard(editor: ReturnType<typeof usePluginEditor>) {
  const { $t: t, current, formData, AccessCurrent } = editor
  return useGatewayWizard({ current, initial: 1,
    steps: () => {
      const plugin = findGatewayResource(editor.pluginList.value, AccessCurrent.value)
      return [basicGatewayStep(t, formData, 1), {
        id: 0, title: t('GatewayEditor.plugin'), hint: t('GatewayEditor.pluginHint'),
        complete: Boolean(AccessCurrent.value), empty: t('GatewayEditor.emptyPlugin'), rows: [
          { label: t('GatewayEditor.pluginName'), value: plugin?.name },
          { label: t('GatewayEditor.description'), value: plugin?.description, block: true },
        ],
      }]
    }, validate: async id => {
      if (id === 1) { await editor.waitForPluginConfig(); await nextTick(); await editor.formRef.value?.validate(); return }
      if (!AccessCurrent.value) { onlyMessage(t('Plugin.index.626239-21'), 'error'); return false }
    }, save: editor.saveData,
  })
}
