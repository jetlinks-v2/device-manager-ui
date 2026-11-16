import i18n from '@jetlinks-web-core/locales'
import { registerDocumentHelpPoints } from '@jetlinks-web-core/utils/documentHelpRegistry'

/** 模块启动注册，未打开产品表单或接入弹窗的点位也可扫描配置。 */
export function registerDeviceHelpPoints() {
  registerDocumentHelpPoints([
    ...[
      ['deviceType.device', 'Save.index.912481-11'],
      ['deviceType.childrenDevice', 'Save.index.912481-13'],
      ['deviceType.gateway', 'Save.index.912481-15'],
      ['syncCache', 'Product.index.660348-41'],
    ].map(([key, title]) => ({
      code: 'device/Product', key,
      name: () => i18n.global.t(title),
      page: () => i18n.global.t('Product.index.660348-15'),
      location: () => i18n.global.t(key === 'syncCache' ? 'DocumentHelp.productList' : 'DocumentHelp.productForm'),
    })),
    {
      code: 'iot-user-device-list', key: 'onboarding.libraryTemplate',
      name: () => i18n.global.t('IotDeviceList.add.librarySource'),
      page: () => i18n.global.t('UnifiedDeviceList.title'),
    },
  ])
}
