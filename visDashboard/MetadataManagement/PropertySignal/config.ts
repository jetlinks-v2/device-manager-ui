export const propertySignalConfig = {
  name: '属性信号',
  type: 'propertySignal',
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
    propertySignal: {
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      value: '',
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 28,
      unit: '%',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 16,
      activeColor: '#54d28a',
      inactiveColor: '#d9d9d9',
      minValue: 0,
      maxValue: 100,
      levels: 4,
      deviceId: '',
      deviceName: '',
      propertyId: '',
      propertyName: ''
    }
  }
}
