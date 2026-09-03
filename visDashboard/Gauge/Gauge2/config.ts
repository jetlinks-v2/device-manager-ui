export const gauge2Config = {
  name: '温度刻度表',
  type: 'gauge2',
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
    gauge2: {
      barHeight: 14,
      showName: true,
      markerColor: '#5b4e47',
      coldColor: '#8bc5eb',
      hotColor: '#ff5c4d',
      trackColor: '#dfe7f0',
      titleColor: '#6b8ba4',
      labelColor: '#39424c',
      valueColor: '#4c4c4c'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: [],
    config: {
      gaugeConfig: {
        min: -60,
        max: 100,
        unit: '°C'
      }
    }
  }
}
