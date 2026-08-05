export const switchStatusOneConfig = {
  name: '开关量状态1',
  type: 'switchStatusOne',
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
    switchStatusOne: {
      onIcon: 'icon-tishi',
      onIconColor: '#FFA940',
      onAnimation: 'none',
      onAnimationSpeed: 1,
      offIcon: 'BulbOutlined',
      offIconColor: '#BFBFBF',
      offAnimation: 'none',
      offAnimationSpeed: 1
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
