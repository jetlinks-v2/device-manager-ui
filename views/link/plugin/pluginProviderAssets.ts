import type { PluginProviderId } from './pluginProviders'

/** Ant Design Vue 图标名，用于来源选择行（AIcon），勿与图片混用 */
export const PLUGIN_PROVIDER_FONT_ICON: Record<PluginProviderId, string> = {
  jar: 'FileZipOutlined',
  marketplace: 'AppstoreOutlined',
}

export function pluginProviderFontIcon(type: string | undefined): string {
  if (!type) return 'FileOutlined'
  const k = String(type).trim().toLowerCase() as PluginProviderId
  return PLUGIN_PROVIDER_FONT_ICON[k] ?? 'FileOutlined'
}
