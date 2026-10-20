import i18n from '@jetlinks-web-core/locales'

export const deviceMapCardConfig = {
  get name() {
    return i18n.global.t('components.DeviceMap.title')
  },
  type: 'deviceMapCard',
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
      minW: 6,
      minH: 8
    },
    deviceMapCard: {
      topTitle: '',
      isAutoRefresh: true,
      interval: 60
    }
  }
}
