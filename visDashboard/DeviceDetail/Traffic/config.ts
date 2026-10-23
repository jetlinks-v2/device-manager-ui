import i18n from '@jetlinks-web-core/locales'
import { defaultSettings, titleKeys, typeOf } from '../shared'
export const config = {
  name: i18n.global.t(titleKeys.Traffic), type: typeOf('Traffic'),
  componentProps: {
    style: { width: '100%', height: '100%' },
    gridItem: { x: 0, y: 0, w: 6, h: 5, minW: 3, minH: 4 },
    [typeOf('Traffic')]: { ...defaultSettings },
  },
}
