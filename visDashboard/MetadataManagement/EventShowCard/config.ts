export const eventShowCardConfig = {
  name: '事件',
  type: 'eventShowCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 12,
      h: 10,
      minW: 4,
      minH: 10
    },
    eventShowCard: {
      value: '',
      targetId: '',
      targetMetadata: '',
      isAutoRefresh: true,
      interval: 30
    }
  }
}
