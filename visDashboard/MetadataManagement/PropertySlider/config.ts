export const propertySliderConfig = {
  name: '属性滑块',
  type: 'propertySlider',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 4,
      h: 5,
      minW: 3,
      minH: 3
    },
    propertySlider: {
      title: 'Slider',
      titleColor: 'rgba(0, 0, 0, 0.88)',
      titleFontSize: 16,
      value: 0,
      valueColor: 'rgba(0, 0, 0, 0.88)',
      valueFontSize: 40,
      unit: '%',
      unitColor: 'rgba(0, 0, 0, 0.88)',
      unitFontSize: 22,
      activeColor: '#0f766e',
      trailColor: '#cfe9e5',
      tickColor: '#2f9d93',
      thumbColor: '#0f766e',
      minValue: 0,
      maxValue: 100,
      deviceId: '',
      deviceName: '',
      propertyId: undefined,
      propertyName: '',
      functionId: undefined,
      paramId: undefined
    }
  }
}
