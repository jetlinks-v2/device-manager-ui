export const propertyGaugeConfig = {
  name: '属性仪表盘',
  type: 'propertyGauge',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 9,
    },
    propertyGauge: {
      title: 'Temperature',
      titleColor: '#7f7f7f',
      titleFontSize: 18,
      minValue: -100,
      maxValue: 100,
      splitNumber: 10,
      pointerColor: '#e85d04',
      progressStartColor: '#f3e7df',
      progressEndColor: '#f97316',
      valueColor: '#3f3f46',
      valueFontSize: 44,
      unit: '',
      unitColor: '#666',
      unitFontSize: 34,
      deviceId: '',
      deviceName: '',
      propertyId: undefined,
      propertyName: ''
    }
  },
}
