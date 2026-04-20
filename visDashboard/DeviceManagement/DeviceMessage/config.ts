export const deviceMessageConfig = {
  name: '设备消息',
  type: 'deviceMessage',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 12,
      h: 16,
      minW: 6,
      minH: 8
    },
    deviceMessage: {
      quickBtn: true,
      defaultType: 'week',
      topTitle: '设备消息',
      hoverTip: true,
      hoverTitle: '消息量',
      color: '#ADC6FF',
      isAutoRefresh: true,
      interval: 0
    }
  }
}
