export const onlineRateCardConfig = {
  name: '设备在线率',
  type: 'onlineRateCard',
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
    onlineRateCard: {
      topTitle: '设备在线率',
      bottomTitle: '在线 / 总数',
      hoverTip: true,
      hoverTitle: '在线率',
      color: '#5B8FF9',
      isAutoRefresh: true,
      interval: 5
    }
  }
}
