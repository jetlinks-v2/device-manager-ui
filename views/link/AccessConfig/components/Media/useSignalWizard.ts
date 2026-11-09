import type { useGb28181Editor } from './useGb28181Editor'
import { basicGatewayStep, useGatewayWizard } from '../useGatewayWizard'

export function useSignalWizard(editor: ReturnType<typeof useGb28181Editor>) {
  const { $t: t, current, formData, formState, props } = editor
  const formatPublicAddress = (host?: string, port?: number | string) => host || port
    ? `${host || t('GatewayEditor.unconfigured')}:${port || t('GatewayEditor.unconfigured')}` : ''
  const wizard = useGatewayWizard({ current, initial: 1,
    steps: () => [basicGatewayStep(t, formData.value, 1), {
      id: 0, title: t('GatewayEditor.signal'), hint: t('GatewayEditor.signalHint'),
      complete: Boolean(formState.value.domain && formState.value.sipId), rows: [
        { label: t('Media.GB28181.666483-1'), value: formState.value.domain },
        { label: 'SIP ID', value: formState.value.sipId },
        { label: t('GatewayEditor.cluster'), value: t(formState.value.shareCluster ? 'GatewayEditor.shared' : 'GatewayEditor.independent') },
        { label: t('GatewayEditor.publicAddress'), value: formState.value.shareCluster
          ? formatPublicAddress(formState.value.hostPort.publicHost, formState.value.hostPort.publicPort)
          : editor.dynamicValidateForm.cluster.map(item => formatPublicAddress(item.publicHost, item.publicPort)).filter(Boolean).join('\n') },
      ],
    }, {
      id: -1, title: t('GatewayEditor.protocol'), complete: true, builtin: true,
      rows: [{ label: t('GatewayEditor.protocolName'), value: props.provider.name },
        { label: t('GatewayEditor.description'), value: props.provider.description, block: true }],
    }], validate: async id => {
      if (id === 1) { await editor.validate(); return }
      if (id === 0) {
        // 原 next 负责共享端口/独立集群归一化，必须在原 saveData 前执行。
        current.value = 0
        await editor.next()
        return current.value === 1
      }
    }, save: editor.saveData,
  })
  const select = (id: number) => {
    if (id === 0 && current.value === 1) editor.prev()
    else wizard.select(id)
  }
  return { ...wizard, select }
}
