export const propertyChartConfig = {
  name: '属性实时值折线图',
  type: 'propertyChart',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 6,
      minW: 3,
      minH: 2
    },
    propertyChart: {
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 32,
      unit: '',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 16,
      lineColor: '#2f7cf6',
      showAreaStyle: true,
      smooth: true,
      history: 20,
      deviceId: '',
      deviceName: '',
      propertyId: '',
      propertyName: ''
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
