export const propertySwitchConfig = {
  name: '属性开关',
  type: 'propertySwitch',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 4,
      minW: 2,
      minH: 3
    },
    propertySwitch: {
      title: 'Switch',
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 24,
      activeColor: '#0f766e',
      inactiveColor: '#d9d9d9',
      trueLabel: 'ON',
      falseLabel: 'OFF',
      deviceId: '',
      deviceName: '',
      propertyId: undefined,
      propertyName: '',
      functionId: undefined,
      paramId: undefined
    }
  }
}
