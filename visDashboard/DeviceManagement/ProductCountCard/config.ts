import { device } from '@device-manager-ui/assets/device'

export const productCountCardConfig = {
  name: '产品数量',
  type: 'productCountCard',
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
    productCountCard: {
      topTitle: '产品数量',
      bottomLeftTitle: '正常',
      bottomLeftStatus: 'success',
      bottomRightTitle: '禁用',
      bottomRightStatus: 'error',
      type: 'all',
      isAutoRefresh: true,
      interval: 5,
      img: device.deviceProduct
    }
  }
}
