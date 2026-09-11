export const propertyBatteryConfig = {
  name: '属性电量',
  type: 'propertyBattery',
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
    propertyBattery: {
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      value: '',
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 32,
      unit: '%',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 18,
      activeColor: '#54d28a',
      inactiveColor: '#d9d9d9',
      borderColor: '#d9d9d9',
      minValue: 0,
      maxValue: 100,
      segments: 4,
      deviceId: '',
      deviceName: '',
      propertyId: '',
      propertyName: ''
    }
  }
}
