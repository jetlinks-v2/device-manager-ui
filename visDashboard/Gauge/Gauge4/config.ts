export const gauge4Config = {
  name: '径向表盘',
  type: 'gauge4',
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
    gauge4: {
      arcAngle: 240,
      gaugeWidth: 13,
      showName: true,
      backgroundColor: '#dbdee4',
      progressColor: '#ef8f46',
      pointerColor: '#eb6d1f',
      labelColor: '#7b848d',
      valueColor: '#5d5048',
      titleColor: '#7d8793'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: [],
    config: {
      gaugeConfig: {
        min: -100,
        max: 80,
        unit: ''
      }
    }
  }
}
