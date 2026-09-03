export const amapConfig = {
  name: '高德地图',
  type: 'aMap',
  componentProps: {
    style: {
      independence: false,
      gridLayout: {}
    },
    gridItem: {
      x: 0,
      y: 0,
      w: 12,
      h: 12,
      // minW: 4,
      // minH: 4
    },
    amap: {
      styleMode: 'standard',
      styleTemplate: 'amap://styles/normal',
      popupTheme: 'light',
      customStyleId: '',
      mapRange: {
        keyword: '重庆'
      },
      zoom: 9,
      center: [106.550483, 29.563707],
      mapInfo: {
        background: true,
        road: true,
        label: true,
        traffic: false
      },
      filter: {
        enable: false,
        brightness: 100,
        contrast: 100,
        grayscale: 0,
        hue: 0,
        invert: 0,
        saturate: 100,
        sepia: 0
      }
    }
  },
  dataSourceProps: [],
  extraProps: {
    type: 'device',
    options: []
  }
}
