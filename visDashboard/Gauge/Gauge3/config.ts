export const gauge3Config = {
  name: '速度仪表盘',
  type: 'gauge3',
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
    gauge3: {
      arcAngle: 270,
      gaugeWidth: 14,
      showName: false,
      backgroundColor: '#d6dce4',
      progressColor: '#f08d50',
      pointerColor: '#ea6b1b',
      labelColor: '#6e7680',
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
        min: 0,
        max: 180,
        unit: 'MPH'
      }
    }
  }
}
