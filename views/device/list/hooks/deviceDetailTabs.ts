import type { DeviceDetailSubject, DeviceDetailTabProvider } from '../../../../deviceDetailProvider'

export const DEVICE_DETAIL_TAB_KEYS = ['overview', 'access', 'thing-model', 'commands', 'data', 'alarm', 'logs'] as const
export type BuiltinDeviceDetailTab = typeof DEVICE_DETAIL_TAB_KEYS[number]
export type DeviceDetailTab = BuiltinDeviceDetailTab | (string & {})

const legacyTabs: Record<string, BuiltinDeviceDetailTab> = {
  realtime: 'data', alarms: 'alarm', records: 'logs', function: 'commands',
  advanced: 'access', identity: 'access', links: 'access', health: 'access',
  children: 'access', simulator: 'commands',
}

/** 按真实设备筛选扩展，并保护内置及已注册的同名页签。 */
export function selectDeviceDetailTabs(
  device: DeviceDetailSubject | null,
  providers: readonly DeviceDetailTabProvider[],
): DeviceDetailTabProvider[] {
  if (!device) return []
  const keys = new Set<string>(DEVICE_DETAIL_TAB_KEYS)
  return [...providers].sort((left, right) => (left.order ?? 100) - (right.order ?? 100))
    .filter(provider => {
      if (!provider.key || keys.has(provider.key) || !provider.matches(device)) return false
      keys.add(provider.key)
      return true
    })
}

/** 只解析当前显示页签，不改写 URL，让异步设备或模块加载后能恢复扩展深链。 */
export function normalizeDeviceDetailTab(
  value: unknown,
  extensions: readonly DeviceDetailTabProvider[],
): DeviceDetailTab {
  if (typeof value !== 'string') return 'overview'
  if ((DEVICE_DETAIL_TAB_KEYS as readonly string[]).includes(value) || extensions.some(tab => tab.key === value)) return value
  return Object.prototype.hasOwnProperty.call(legacyTabs, value) ? legacyTabs[value] : 'overview'
}
