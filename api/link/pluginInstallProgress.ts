export interface PluginPackageDescription {
  id: string
  name: string
  description?: string
  version: string
  type: string
  typeName: string
  others?: Record<string, unknown>
}

export interface PluginInstallProgress {
  name: string
  type?: 'STEP' | 'MEASURABLE'
  status: 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  message?: string
  errorMessage?: string
  measurable?: { current?: number | string | null; total?: number | string | null; unitValue?: string | null; unitText?: string | null }
  attributes?: { serverId?: string; serviceId?: string; applicable?: boolean; progressAvailable?: boolean;
    errorCode?: string; result?: PluginPackageDescription }
}

/** The request adapter and progress views share the same terminal-result contract. */
export function pluginCheckResult(event: PluginInstallProgress): PluginPackageDescription | undefined {
  return event.name === 'plugin.check' && event.status === 'COMPLETED' ? event.attributes?.result : undefined
}
