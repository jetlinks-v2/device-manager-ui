import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

export type EnsureVisualizationDashboardProjectParams = {
  entityId: string
  projectName?: string
  groupId: string
  groupName?: string
  configuration: Record<string, any>
}

export const ensureVisualizationDashboardProject = async (params: EnsureVisualizationDashboardProjectParams) => {
  if (!moduleRegistry.hasModule('visualization-manager-ui')) return

  const apis: any = moduleRegistry.getResource('visualization-manager-ui', 'apis')
  const ensureFn = apis?.ensureDashboardProject as
    | undefined
    | ((p: EnsureVisualizationDashboardProjectParams) => Promise<any>)

  if (!ensureFn) return

  await ensureFn(params)
}
