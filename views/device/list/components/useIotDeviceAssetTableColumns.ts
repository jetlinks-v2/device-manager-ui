import { computed } from 'vue'

type Translate = (key: string) => string

export function useIotDeviceAssetTableColumns($t: Translate, showArea: () => boolean) {
  return computed(() => [
    { title: $t('IotDeviceList.table.device'), dataIndex: 'device', key: 'device', scopedSlots: true, width: '17rem', align: 'left' },
    { title: $t('IotDeviceList.table.productName'), dataIndex: 'productName', key: 'productName', scopedSlots: true, width: '9.375rem' },
    { title: $t('IotDeviceList.table.brandModel'), dataIndex: 'brandModel', key: 'brandModel', scopedSlots: true, width: '9.375rem' },
    { title: $t('IotDeviceList.table.status'), dataIndex: 'status', key: 'status', scopedSlots: true, width: '5rem' },
    { title: $t('IotDeviceList.table.deviceType'), dataIndex: 'deviceType', key: 'deviceType', scopedSlots: true, width: '8.75rem' },
    {
      title: $t(showArea() ? 'IotDeviceList.table.areaGroup' : 'UnifiedDeviceList.group'),
      dataIndex: 'deviceGroup',
      key: 'deviceGroup',
      scopedSlots: true,
      width: showArea() ? '8.75rem' : '7.5rem',
    },
    { title: $t('IotDeviceList.table.action'), dataIndex: 'action', key: 'action', scopedSlots: true, width: '10.5rem' },
  ])
}
