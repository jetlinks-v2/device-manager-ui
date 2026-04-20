import { device } from '@device-manager-ui/assets/device'

export const deviceCountCardConfig = {
  name: '设备数量',
  type: 'deviceCountCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 5,
      minW: 3,
      minH: 5
    },
    deviceCountCard: {
      topTitle: '设备数量',
      bottomLeftTitle: '在线',
      bottomLeftStatus: 'success',
      bottomRightTitle: '离线',
      bottomRightStatus: 'error',
      type: 'all',
      isAutoRefresh: true,
      interval: 0,
      img: device.deviceNumber
    }
  }
}
