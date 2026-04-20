export const switchOneConfig = {
  name: '开关量控制1',
  type: 'switchOne',
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
      minH: 1
    },
    switchOne: {
      showValue: false,
      switchColor: '#ffcc80'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
