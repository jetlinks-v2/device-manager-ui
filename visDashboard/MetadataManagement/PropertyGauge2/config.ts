export const propertyGauge2Config = {
  name: '多环仪表盘',
  type: 'propertyGauge2',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 7
    },
    propertyGauge2: {
      minValue: 0,
      maxValue: 100,
      ringWidth: 26,
      titleFontSize: 24,
      valueFontSize: 18,
      deviceId: '',
      deviceName: '',
      propertyIds: [],
      propertyNames: []
    }
  }
}
