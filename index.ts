import i18n from '@jetlinks-web-core/locales'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import registerSetting from './register'
import { name } from './package.json'
import './assets/iot-design-bridge.css'

const routerModules = import.meta.glob('./views/**/index.vue')

const getAsyncRoutesMap = () => {
  const modules: Record<string, (typeof routerModules)[string]> = {}
  Object.keys(routerModules).forEach(item => {
    const code = item.replace('./views/', '').replace('/index.vue', '')
    modules[code] = routerModules[item]
    modules[`iot-user/${code}`] = routerModules[item]
  })
  return modules
}

const deviceListExtraRoutes = [
  {
    code: 'Detail',
    name: i18n.global.t('IotWorkbench.route.deviceDetail'),
    url: '/Detail/:id',
    meta: {
      pageAgentClientId: 'deviceDetailChat',
    },
    component: () => import('./views/device/list/Detail/index.vue'),
  }
]

const sceneLinkageExtraRoutes = [
  {
    code: 'Editor',
    url: '/editor/:id?',
    name: i18n.global.t('IotSceneLinkage.title.editor'),
    component: () => import('./views/scene-linkage/editor/index.vue'),
  },
]


const getExtraRoutesMap = () => ({
  'device/Product': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        component: () => import('./views/device/Product/Detail/index.vue'),
      },
      {
        code: 'QuickCreate',
        url: '/QuickCreate',
        name: i18n.global.t('device-manager-ui.index.106686-1'),
        component: () => import('./views/resource/QuickCreate/index.vue'),
      },
    ],
  },
  'device/Instance': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        meta: { pageAgentClientId: 'deviceDetailChat' },
        component: () => import('./views/device/Instance/Detail/index.vue'),
      },
    ],
  },
  'link/AccessConfig': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        component: () => import('./views/link/AccessConfig/Detail/index.vue'),
      },
    ],
  },
  'link/Certificate': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        component: () => import('./views/link/Certificate/Detail/index.vue'),
      },
    ],
  },
  'link/Type': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        component: () => import('./views/link/Type/Detail/index.vue'),
      },
    ],
  },
  'resource/Resource': {
    children: [
      {
        code: 'Detail',
        url: '/detail/:id',
        name: i18n.global.t('device-manager-ui.index.106686-0'),
        component: () => import('./views/resource/Resource/Detail/index.vue'),
      },
    ],
  },
  'iot-user/device/list': deviceListExtraRoutes,
  'iot-user/scene-linkage': sceneLinkageExtraRoutes,
})

const getCoreRouteOverrides = () => {
  return []
}

const getComponents = () => ({})

const register = () => {
  moduleRegistry.register(name, registerSetting)
}

export default {
  getAsyncRoutesMap,
  getExtraRoutesMap,
  getCoreRouteOverrides,
  getComponents,
  register,
  priority: -100,
}
