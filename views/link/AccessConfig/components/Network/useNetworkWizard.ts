import { onMounted, watch } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import type { useNetworkEditor } from './useNetworkEditor'
import { basicGatewayStep, useGatewayWizard, type GatewayStep } from '../useGatewayWizard'
import { findGatewayResource } from '../gatewayOverview'

/** 新向导只编排原选择与表单，保存参数仍由 useNetworkEditor 生成。 */
export function useNetworkWizard(editor: ReturnType<typeof useNetworkEditor>) {
  const { $t: t, props, current, formData, isAgent, networkCurrent, procotolCurrent } = editor
  const child = props.provider.id === 'child-device'
  const networkStep = (): GatewayStep => {
    const resource = findGatewayResource(editor.allNetworkList.value, networkCurrent.value)
    return { id: 0, title: t('GatewayEditor.network'), hint: t('GatewayEditor.networkHint'),
      complete: Boolean(networkCurrent.value), empty: t('GatewayEditor.emptyNetwork'), rows: [
        { label: t('GatewayEditor.componentName'), value: resource?.name },
        { label: t('GatewayEditor.publicAddress'), value: resource?.addresses?.map(item => item.address).join('\n') },
        { label: t('GatewayEditor.description'), value: resource?.description, block: true },
      ] }
  }
  const protocolStep = (): GatewayStep => {
    const resource = findGatewayResource(editor.allProcotolList.value, procotolCurrent.value)
    return { id: 1, title: t('GatewayEditor.protocol'), hint: t('GatewayEditor.protocolHint'),
      complete: Boolean(procotolCurrent.value), empty: t('GatewayEditor.emptyProtocol'), rows: [
        { label: t('GatewayEditor.protocolName'), value: resource?.name },
        { label: t('GatewayEditor.description'), value: resource?.description, block: true },
      ] }
  }
  onMounted(() => { if (!isAgent) editor.queryProcotolList(props.provider.id) })
  watch(procotolCurrent, value => { if (value && !isAgent) editor.loadProtocolConfig() })
  watch(networkCurrent, () => { if (isAgent) procotolCurrent.value = props.provider.id })
  return useGatewayWizard({ current, initial: isAgent ? 0 : 2,
    steps: () => isAgent ? [networkStep(), basicGatewayStep(t, formData.value, 2)]
      : [basicGatewayStep(t, formData.value, 2), ...(!child ? [networkStep()] : []), protocolStep()],
    validate: async id => {
      if (id === 2) { await editor.validate(); return }
      const selected = id === 0 ? networkCurrent.value : procotolCurrent.value
      if (!selected) {
        onlyMessage(t(id === 0 ? 'Network.index.041705-26' : 'Network.index.041705-27'), 'error')
        return false
      }
    }, save: editor.saveData,
  })
}
