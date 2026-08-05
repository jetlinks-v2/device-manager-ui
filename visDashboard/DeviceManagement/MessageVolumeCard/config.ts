export const messageVolumeCardConfig = {
  name: '今日设备消息量',
  type: 'messageVolumeCard',
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
    messageVolumeCard: {
      topTitle: '今日设备消息量',
      bottomTitle: '当月消息量',
      hoverTitle: '消息量',
      hoverTip: true,
      color: '#F29B55',
      type: 'all',
      isAutoRefresh: true,
      interval: 0
    }
  }
}
