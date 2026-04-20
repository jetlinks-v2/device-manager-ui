export const gauge1Config = {
  name: '温度辐射表盘',
  type: 'gauge1',
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
    gauge1: {
      arcAngle: 220,
      gaugeWidth: 12,
      pointerLength: 85,
      pointerColor: '#eb6d1f',
      showName: true,
      color1: '#7ec7f7',
      color2: '#f3a0a8',
      centerColor: '#d7dce2',
      splitRatio: 0.36,
      valueColor: '#544942',
      titleColor: '#8aa0b5',
      labelColor: '#78828f'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: [],
    config: {
      gaugeConfig: {
        min: -60,
        max: 60,
        unit: '°C'
      }
    }
  }
}
