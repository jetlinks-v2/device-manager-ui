import { ref, watch, onBeforeUnmount, type Ref } from 'vue'

import dayjs from 'dayjs'

export function useDeviceListData(props: any, configRef: Ref<any>) {
  const deviceListData = ref<any[]>([])
  const selectedRowKey = ref<string | null>(null) // 用于卡片和列表的项目选择
  let events: any = []

  watch(
    () => props.info?.dataSourceProps,
    (val) => {
      // 1. 清理旧订阅
      events?.forEach((event: any) => event?.())
      events = []

      // 2. 如果没有挂载真实数据源，注入 Mock 数据
      if (!val || !val.length) {
        deviceListData.value = [
          {
            id: 'mock_1',
            name: '演示设备-A (环境传感器)',
            deviceType: '直连设备',
            online: true,
            activeTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
          },
          {
            id: 'mock_2',
            name: '演示设备-B (智能网关)',
            deviceType: '网关设备',
            online: false,
            activeTime: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss')
          },
          {
            id: 'mock_3',
            name: '演示设备-C (工业控制终端)',
            deviceType: '网关子设备',
            online: true,
            activeTime: dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss')
          }
        ]
        if (configRef.value?.selectFirstByDefault) {
          selectedRowKey.value = 'mock_1'
        }
        return
      }

      // 3. 有真实数据，执行正常的事件总线提取和拼接格式
      deviceListData.value = []
      val.forEach((item: any) => {
        const id = item.id
        events.push(
          (window as any).$viewDataEventBus?.subscribe(id, (data: any) => {
            const formatted = {
              id: data.id,
              name: data.name,
              deviceType: data['deviceType.text'] || '',
              online: data['state.value'] === 'online',
              activeTime: data.onlineTime
                ? dayjs(data.onlineTime).format('YYYY-MM-DD HH:mm:ss')
                : data.offlineTime
                  ? dayjs(data.offlineTime).format('YYYY-MM-DD HH:mm:ss')
                  : '--'
            }

            const index = deviceListData.value.findIndex((item) => item.id === formatted.id)
            if (index > -1) {
              deviceListData.value[index] = formatted
            } else {
              deviceListData.value.push(formatted)
            }

            if (configRef.value?.selectFirstByDefault && deviceListData.value.length === 1) {
              selectedRowKey.value = deviceListData.value[0].id
            }
          })
        )
      })
    },
    { deep: true, immediate: true }
  )

  onBeforeUnmount(() => {
    events?.forEach((event: any) => event?.())
  })

  return { deviceListData, selectedRowKey }
}
