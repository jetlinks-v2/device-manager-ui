export const propertyProgressConfig = {
  name: '属性进度条',
  type: 'propertyProgress',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 5,
      minW: 2,
      minH: 2
    },
    propertyProgress: {
      title: '',
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      value: 'N/A',
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 24,
      unit: '',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 12,
      progressColor: '#0f766e',
      trailColor: '#f0f0f0',
      minValue: 0,
      maxValue: 100,
      deviceId: '',
      deviceName: '',
      propertyId: '',
      propertyName: ''
    }
  },
}
