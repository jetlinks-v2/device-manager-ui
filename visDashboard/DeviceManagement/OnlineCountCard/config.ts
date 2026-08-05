export const onlineCountCardConfig = {
  name: '当前在线',
  type: 'onlineCountCard',
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
    onlineCountCard: {
      topTitle: '当前在线',
      bottomTitle: '昨日在线',
      hoverTip: true,
      hoverTitle: '在线数',
      color: '#D3ADF7',
      type: 'all',
      isAutoRefresh: true,
      interval: 5
    }
  }
}
