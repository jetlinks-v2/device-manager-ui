import { onMounted } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import type { useCtwingEditor } from './useCtwingEditor'
import type { useOneNetEditor } from './useOneNetEditor'
import { basicGatewayStep, useGatewayWizard } from '../useGatewayWizard'
import { findGatewayResource } from '../gatewayOverview'

type CloudEditor = ReturnType<typeof useCtwingEditor> | ReturnType<typeof useOneNetEditor>
export function useCloudWizard(editor: CloudEditor) {
  const { $t: t, current, formData, props } = editor
  const ctwing = 'protocolCurrent' in editor
  const selected = ctwing ? editor.protocolCurrent : editor.procotolCurrent
  const resources = ctwing ? editor.allProtocolList : editor.allProcotolList
  onMounted(() => ctwing ? editor.queryProtocolList(props.provider.id) : editor.queryProcotolList(props.provider.id))
  return useGatewayWizard({ current, initial: 2,
    steps: () => {
      const protocol = findGatewayResource(resources.value, selected.value)
      return [basicGatewayStep(t, formData.value, 2), {
        id: 0, title: t('GatewayEditor.network'), hint: t('GatewayEditor.cloudHint'),
        complete: Boolean(editor.formState.value.apiAddress), rows: [
          { label: t('GatewayEditor.publicAddress'), value: editor.formState.value.apiAddress },
          { label: t('GatewayEditor.description'), value: editor.formState.value.description, block: true },
        ],
      }, {
        id: 1, title: t('GatewayEditor.protocol'), hint: t('GatewayEditor.protocolHint'),
        complete: Boolean(selected.value), empty: t('GatewayEditor.emptyProtocol'), rows: [
          { label: t('GatewayEditor.protocolName'), value: protocol?.name },
          { label: t('GatewayEditor.description'), value: protocol?.description, block: true },
        ],
      }]
    }, validate: async id => {
      if (id === 2) { await editor.formRef2.value?.validate(); return }
      if (id === 0) { await editor.formRef1.value?.validate(); return }
      if (!selected.value) {
        onlyMessage(t(ctwing ? 'Cloud.Ctwing.076179-45' : 'Cloud.OneNet.808542-59'), 'error'); return false
      }
    }, save: editor.saveData,
  })
}
