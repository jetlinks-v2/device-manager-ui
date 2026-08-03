import i18n from '@jetlinks-web-core/locales'

export const IOT_MODULE_ID = 'mod-iot'
export const IOT_MODULE_SLUG = 'iot'

export type IotView = 'device-overview' | 'device-groups'

export const IOT_VIEW_PATH: Record<IotView, string> = {
  'device-overview': '/iot-user/device',
  'device-groups': '/iot-user/groups',
}

export const IOT_VIEW_CHILD_KEY: Record<IotView, string> = {
  'device-overview': 'iot-device-overview',
  'device-groups': 'iot-device-groups',
}

export interface IotModuleExposes {
  getWorkbench: 'iotDevice.service.getWorkbench'
  getGroups: 'iotDevice.service.getGroups'
}

export interface IotModuleConfig {
  id: typeof IOT_MODULE_ID
  slug: typeof IOT_MODULE_SLUG
  name: string
  kind: 'connect'
  routes: Array<{ view: IotView; path: string; component: string }>
  requires: {
    platform: string[]
    modulesHard: string[]
    modulesSoft: string[]
  }
  exposes: IotModuleExposes
}

const config: IotModuleConfig = {
  id: IOT_MODULE_ID,
  slug: IOT_MODULE_SLUG,
  get name() { return i18n.global.t('IotModule.name') },
  kind: 'connect',
  routes: [
    { view: 'device-overview', path: '/iot-user/device', component: 'IotDeviceWorkbenchView' },
    { view: 'device-groups', path: '/iot-user/groups', component: 'IotDeviceGroupsView' },
  ],
  requires: {
    platform: [],
    modulesHard: [],
    modulesSoft: [],
  },
  exposes: {
    getWorkbench: 'iotDevice.service.getWorkbench',
    getGroups: 'iotDevice.service.getGroups',
  },
}

export default config
