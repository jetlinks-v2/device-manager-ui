export const switchSignalLightConfig = {
  name: '开关量信号灯',
  type: 'switchSignalLight',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 1,
      h: 3,
      minW: 1,
      minH: 2
    },
    switchSignalLight: {
      onColor: '#52C41A',
      offColor: '#F5222D',
      autoSize: true,
      size: 40,
      showGlow: true
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
