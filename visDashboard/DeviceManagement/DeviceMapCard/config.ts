export const deviceMapCardConfig = {
  name: '设备地图',
  type: 'deviceMapCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 12,
      h: 12,
      minW: 6,
      minH: 8
    },
    deviceMapCard: {
      topTitle: '设备地图',
      isAutoRefresh: true,
      interval: 60
    }
  }
}
