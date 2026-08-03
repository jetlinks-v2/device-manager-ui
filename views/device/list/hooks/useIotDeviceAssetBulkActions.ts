import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { batchDeployDevice_api, batchUndeployDevice_api } from '@device-manager-ui/api/device'

import { getIotDeviceConnectionStatus } from './useIotDeviceStatus'
import type { IotDevice } from '../types'

type ExportFormatter = {
  fileName: string
  headers: string[]
  mapRow: (device: IotDevice) => Array<string | number>
}

export function useIotDeviceAssetBulkActions(
  devices: Ref<IotDevice[]>,
  refreshTable: (resetPage?: boolean) => void,
) {
  const { t: $t } = useI18n()
  const selectedRowKeys = ref<string[]>([])
  const runningAction = ref<'enable' | 'disable' | 'export' | ''>('')

  const selectedDevices = computed(() => {
    const idSet = new Set(selectedRowKeys.value)
    return devices.value.filter((device) => idSet.has(device.id))
  })

  watch(devices, (nextDevices) => {
    const idSet = new Set(nextDevices.map((item) => item.id))
    selectedRowKeys.value = selectedRowKeys.value.filter((id) => idSet.has(id))
  })

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onSelect(record: IotDevice, selected: boolean) {
      const rowSet = new Set(selectedRowKeys.value)
      if (selected) rowSet.add(record.id)
      else rowSet.delete(record.id)
      selectedRowKeys.value = [...rowSet]
    },
    onSelectAll(selected: boolean, _selectedRows: IotDevice[], changeRows: IotDevice[]) {
      const rowSet = new Set(selectedRowKeys.value)
      changeRows.forEach((item) => {
        if (selected) rowSet.add(item.id)
        else rowSet.delete(item.id)
      })
      selectedRowKeys.value = [...rowSet]
    },
  }))

  function clearSelection() {
    selectedRowKeys.value = []
  }

  async function toggleSelectedDevices(target: 'enable' | 'disable') {
    const targetRows = selectedDevices.value.filter((device) => {
      const status = getIotDeviceConnectionStatus(device)
      return target === 'enable' ? status === 'disabled' : status !== 'disabled'
    })

    if (!targetRows.length) {
      onlyMessage(
        target === 'enable'
          ? $t('IotDeviceList.message.noEnableTarget')
          : $t('IotDeviceList.message.noDisableTarget'),
        'warning',
      )
      return
    }

    runningAction.value = target
    const request = target === 'enable' ? batchDeployDevice_api : batchUndeployDevice_api

    try {
      const response = await request(targetRows.map((device) => device.id))
      const affectedCount = resolveAffectedCount(response, targetRows.length)
      onlyMessage(
        target === 'enable'
          ? $t('IotDeviceList.message.batchEnableSuccess', { count: affectedCount })
          : $t('IotDeviceList.message.batchDisableSuccess', { count: affectedCount }),
      )
      clearSelection()
      refreshTable()
    } catch (error) {
      const fallbackMessage = target === 'enable'
        ? $t('IotDeviceList.message.batchEnableFailed')
        : $t('IotDeviceList.message.batchDisableFailed')
      onlyMessage(error instanceof Error ? error.message : fallbackMessage, 'error')
    } finally {
      runningAction.value = ''
    }
  }

  function exportRows(rows: IotDevice[], formatter: ExportFormatter) {
    if (!rows.length) {
      onlyMessage($t('IotDeviceList.message.exportEmpty'), 'warning')
      return
    }

    runningAction.value = 'export'
    const lines = [
      formatter.headers.join(','),
      ...rows.map((device) => formatter.mapRow(device).map(escapeCsvCell).join(',')),
    ]

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = formatter.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    runningAction.value = ''
    onlyMessage($t('IotDeviceList.message.exportDone', { count: rows.length }))
  }

  function exportSelectedRows(formatter: ExportFormatter) {
    exportRows(selectedDevices.value, formatter)
  }

  return {
    rowSelection,
    selectedRowKeys,
    selectedDevices,
    runningAction,
    clearSelection,
    toggleSelectedDevices,
    exportRows,
    exportSelectedRows,
  }
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function resolveAffectedCount(response: unknown, fallback: number) {
  if (typeof response === 'number') return response
  if (response && typeof response === 'object' && 'result' in response) {
    const result = (response as { result?: unknown }).result
    if (typeof result === 'number') return result
  }
  return fallback
}
