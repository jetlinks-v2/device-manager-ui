import { computed } from 'vue'

type Translate = (key: string) => string

export function useIotDeviceAssetTableColumns($t: Translate) {
  return computed(() => [
    { title: $t('IotDeviceList.table.device'), dataIndex: 'device', key: 'device', scopedSlots: true, width: '10.625rem', align: 'left' },
    { title: $t('IotDeviceList.table.type'), dataIndex: 'productName', key: 'productName', scopedSlots: true, width: '7.5rem' },
    { title: $t('IotDeviceList.table.manufacturer'), dataIndex: 'productManufacturer', key: 'productManufacturer', scopedSlots: true, width: '10rem' },
    { title: $t('IotDeviceList.table.model'), dataIndex: 'productModel', key: 'productModel', scopedSlots: true, width: '7.5rem' },
    { title: $t('IotDeviceList.table.status'), dataIndex: 'status', key: 'status', scopedSlots: true, width: '5rem' },
    { title: $t('IotDeviceList.table.deviceType'), dataIndex: 'deviceType', key: 'deviceType', scopedSlots: true, width: '9.375rem' },
    { title: $t('IotDeviceList.table.deviceGroup'), dataIndex: 'deviceGroup', key: 'deviceGroup', scopedSlots: true, width: '11.25rem' },
    { title: $t('IotDeviceList.table.risk'), dataIndex: 'risk', key: 'risk', scopedSlots: true, width: '8.75rem' },
    { title: $t('IotDeviceList.table.action'), dataIndex: 'action', key: 'action', scopedSlots: true, width: '3.5rem', align: 'center' },
  ])
}
