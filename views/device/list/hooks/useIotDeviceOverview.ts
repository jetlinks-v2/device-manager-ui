import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import useClipboard from 'vue-clipboard3'
import { onlyMessage } from '@jetlinks-web/utils'

import type { DeviceTemplate } from '../services/device-library/types'
import type { IotDevice, IotDeviceHealthDiagnosis, IotDeviceTodo } from '../types'
import type { RealtimePropertyRow, SimulatorSession } from '../components/device-detail/iotDeviceDetail.types'

export type OverviewAccessSummary = {
  addressRows: Array<{ address: string; health?: number }>
  configGroups: Array<{ name: string; properties: Array<{ property: string; name: string; type?: { type?: string }; value?: string }> }>
  principalRows: Array<{ name: string; fields: Array<{ label: string; value: string; copyValue?: string }> }>
}

export type IotDeviceOverviewProps = {
  device: IotDevice
  productTemplate?: DeviceTemplate | null
  healthPath?: string
  healthDiagnosis?: IotDeviceHealthDiagnosis | null
  todos?: IotDeviceTodo[]
  simulatorSession?: SimulatorSession | null
  accessSummary: OverviewAccessSummary
  properties: RealtimePropertyRow[]
}

export function useIotDeviceOverview(props: Readonly<IotDeviceOverviewProps>) {
  const { t: $t } = useI18n()
  const { toClipboard } = useClipboard()
  const selectedMetric = ref<RealtimePropertyRow | null>(null)
  const detailOpen = ref(false)

  const keyMetrics = computed(() => {
    const focused = props.properties.filter((item) => item.focused)
    return (focused.length ? focused : props.properties).slice(0, 5)
  })

  const overviewPropertyActions = computed(() => [
    {
      key: 'history',
      title: $t('IotDeviceDetail.runtime.historyData'),
      icon: 'HistoryOutlined',
      placement: 'head' as const,
    },
  ])

  function displayText(value?: string | null) {
    return value && String(value).trim() ? String(value) : '--'
  }

  function renderAccessValue(item: { type?: { type?: string }; value?: string }) {
    return item.value || '--'
  }

  function openHistory(metric: RealtimePropertyRow) {
    selectedMetric.value = metric
    detailOpen.value = true
  }

  async function copyText(value?: string) {
    if (!value) return
    await toClipboard(value)
    onlyMessage($t('IotDeviceDetail.accessDetail.copied'))
  }

  return {
    copyText,
    detailOpen,
    displayText,
    keyMetrics,
    openHistory,
    overviewPropertyActions,
    renderAccessValue,
    selectedMetric,
  }
}
