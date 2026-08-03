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
    // const key = `${code}`
    const key = `iot-user/${code}` // views下不存在多模块时
    modules[key] = routerModules[item]
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
  register
}
