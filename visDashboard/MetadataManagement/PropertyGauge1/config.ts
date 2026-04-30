export const propertyGauge1Config = {
  name: '半圆仪表盘',
  type: 'propertyGauge1',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 6
    },
    propertyGauge1: {
      titleColor: '#666',
      titleFontSize: 14,
      minValue: 0,
      maxValue: 1,
      splitNumber: 5,
      valueColor: '#00b86b',
      valueFontSize: 36,
      unit: '',
      unitColor: '#333',
      unitFontSize: 14,
      startColor: '#1fcf8b',
      middleColor: '#f4b447',
      endColor: '#f0825d',
      deviceId: '',
      deviceName: '',
      propertyId: undefined,
      propertyName: ''
    }
  }
}
