export const switchListConfig = {
  name: '开关量控制列表',
  type: 'switchList',
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
      minW: 1,
      minH: 1
    },
    switchList: {
      iconType: 'icon-gaojing',
      iconColor: '#ffcc80',
      iconAnimation: 'none',
      iconSpeed: 1,
      switchColor: '#ffcc80'
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
