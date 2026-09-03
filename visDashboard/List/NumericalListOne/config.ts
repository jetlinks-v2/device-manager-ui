export const numericalListOneConfig = {
  name: '数值列表1',
  type: 'numericalListOne',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      minW: 2,
      minH: 2
    },
    numericalListOne: {
      icon: 'AppleOutlined',
      iconColor: '#f5a623',
      unit: '℃'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
