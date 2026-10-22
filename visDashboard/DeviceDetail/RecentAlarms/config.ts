import i18n from '@jetlinks-web-core/locales'
import { defaultSettings, titleKeys, typeOf } from '../shared'
export const config = {
  name: i18n.global.t(titleKeys.RecentAlarms), type: typeOf('RecentAlarms'),
  componentProps: {
    style: { width: '100%', height: '100%' },
    gridItem: { x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
    [typeOf('RecentAlarms')]: { ...defaultSettings },
  },
}
