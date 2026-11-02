import router from '@jetlinks-web-core/router'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { HomeAgentCapabilityContext } from '@jetlinks-web-core/layout/components/AiChat/homeAgentContracts'
import type { DeviceListProvider } from '../deviceListProvider'
import type { IotDevice } from '../views/device/list/types'
import { findDeviceAgentMenu } from './deviceMenus'

/** Reuse the owning type's registered navigation, just as the unified device list does. */
export const resolveDeviceAgentDetailNavigation = (context: HomeAgentCapabilityContext, device: IotDevice) => {
  const providers = moduleRegistry.getAllModuleIds().flatMap(moduleId => Object.values(
    moduleRegistry.getResource(moduleId, 'deviceListProviders') || {},
  ) as DeviceListProvider[])
  const provider = providers.find(candidate => candidate.matches(device))
  const menu = provider ? context.findMenu(provider.menuCode) : findDeviceAgentMenu(context, 'instance')
  if (!menu || provider?.detailComponent) return undefined
  const routeName = provider?.detailRoute || `${menu.routeName || menu.code}/Detail`
  const params = { [provider?.detailParam || 'id']: device.id }
  const query = provider ? { type: provider.id } : {}
  const location = provider?.detailPath
    ? provider.detailPath({ ...device, category: provider.id })
    : { name: routeName, params, query }
  if (!provider?.detailPath && !router.hasRoute(routeName)) return undefined
  const resolved = router.resolve(location)
  return {
    menu,
    routeName: String(resolved.name || routeName),
    params: resolved.params,
    query: resolved.query,
    path: resolved.fullPath,
  }
}
