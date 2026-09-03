export const deviceCardConfig = {
  name: '设备卡片',
  type: 'deviceCard',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 8,
      h: 5,
      minW: 3,
      minH: 3
    },
    deviceCard: {
      gap: 16,
      cardBgColor: '#ffffff',
      cardSelectedBgColor: '#f0f7ff',
      showBorder: false,
      borderWidth: 1,
      borderColor: '#e8e8e8',
      showShadow: true,
      shadowSize: 8,
      borderRadius: 8,
      selectFirstByDefault: false
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
