export const switchTwoConfig = {
  name: '开关量控制2',
  type: 'switchTwo',
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
    switchTwo: {
      onType: 'icon-kaiji',
      onColor: '#ffcc80',
      onAnimation: 'none',
      onSpeed: 1,
      offType: 'icon-guanji',
      offColor: '#b3b3b3ff',
      offAnimation: 'none',
      offSpeed: 1
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
