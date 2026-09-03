export const enumerationConfig = {
  name: '枚举控制',
  type: 'enumeration',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 3,
      h: 4,
      minW: 2,
      minH: 3
    },
    enumeration: {
      showBorder: true,
      borderColor: '#e0e0e0ff',
      borderRadius: 4,
      borderWidth: 1,
      defaultBgColor: '#f5f5f5ff',
      defaultFontColor: '#333333ff',
      selectBgColor: '#1890ffff',
      selectFontColor: '#ffffffff',
      selectFontSize: 14
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
