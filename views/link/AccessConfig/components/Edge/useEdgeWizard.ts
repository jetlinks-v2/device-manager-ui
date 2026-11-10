import { onlyMessage } from '@jetlinks-web/utils'
import type { useEdgeEditor } from './useEdgeEditor'
import { basicGatewayStep, useGatewayWizard, type GatewayStep } from '../useGatewayWizard'
import { findGatewayResource } from '../gatewayOverview'

export function useEdgeWizard(editor: ReturnType<typeof useEdgeEditor>) {
  const { $t: t, current, formState, props, networkCurrent } = editor
  const child = props.provider.id === 'edge-child-device'
  return useGatewayWizard({ current, initial: 1,
    steps: () => {
      const network = findGatewayResource(editor.allNetworkList.value, networkCurrent.value)
      const steps: GatewayStep[] = [basicGatewayStep(t, formState.value, 1)]
      if (!child) steps.push({ id: 0, title: t('GatewayEditor.network'), hint: t('GatewayEditor.networkHint'),
        complete: Boolean(networkCurrent.value), empty: t('GatewayEditor.emptyNetwork'), rows: [
          { label: t('GatewayEditor.componentName'), value: network?.name },
          { label: t('GatewayEditor.publicAddress'), value: network?.addresses?.map(item => item.address).join('\n') },
          { label: t('GatewayEditor.description'), value: network?.description, block: true },
        ] })
      return [...steps, { id: -1, title: t('GatewayEditor.protocol'), complete: true, builtin: true,
        rows: [{ label: t('GatewayEditor.protocolName'), value: 'official-edge-protocol' }],
      }]
    }, validate: async id => {
      if (id === 1) { await editor.formRef.value?.validate(); return }
      if (id === 0 && !networkCurrent.value) { onlyMessage(t('Edge.index.066653-21'), 'error'); return false }
    }, save: editor.saveData,
  })
}
