export const gaugeCompassConfig = {
  name: '指南针',
  type: 'gaugeCompass',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 6,
      minW: 1,
      minH: 3
    },
    gaugeCompass: {
      showName: false,
      backgroundColor: '#25282d',
      textColor: '#f4f5f7',
      northColor: '#d85a5a',
      southColor: '#f4f5f7',
      ringColor: '#aeb4bb'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: [],
    config: {
      gaugeConfig: {
        min: 0,
        max: 360,
        unit: '°'
      }
    }
  }
}
