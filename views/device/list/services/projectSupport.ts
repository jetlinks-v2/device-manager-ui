import { readonly, ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'

import { ok, type ServiceResult } from './shared/serviceResult'

const t = (key: string) => i18n.global.t(key)

export type ProjectAreaType = 'site' | 'building' | 'floor' | 'zone' | 'room' | 'point'

export interface ProjectArea {
  id: string
  projectId: string
  parentId?: string
  name: string
  type: ProjectAreaType
  code: string
  aliases: string[]
  sortOrder: number
  description: string
  planMode: 'own' | 'inherit'
  floorPlanId?: string
}

export interface ProjectAreaSettings {
  projectId: string
  rootAreaId: string
  areas: ProjectArea[]
  floorPlans: unknown[]
  geometries: unknown[]
  whiteModelJobs: unknown[]
  whiteModelCandidates: unknown[]
}

export interface ProjectRole {
  id: string
  projectId: string
  name: string
  code: string
  description: string
}

export interface ProjectRoleSettings {
  projectId: string
  roles: ProjectRole[]
}

export interface ProjectIdentitySettings {
  projectId: string
  activeMemberId: string
}

const activeIdentity = ref<ProjectIdentitySettings | null>({
  projectId: 'doraemon',
  activeMemberId: 'demo-user',
})

function createAreas(projectId: string): ProjectArea[] {
  return [
    {
      id: 'area-root',
      projectId,
      name: t('IotDeviceLibrary.project.doraemon'),
      type: 'site',
      code: 'ROOT',
      aliases: [],
      sortOrder: 1,
      description: t('IotProjectMock.area.rootDescription'),
      planMode: 'own',
    },
    {
      id: 'area-mall-atrium',
      projectId,
      parentId: 'area-root',
      name: t('IotProjectMock.area.mallAtrium'),
      type: 'zone',
      code: 'MALL-ATRIUM',
      aliases: [t('IotProjectMock.area.mallAtriumAlias')],
      sortOrder: 10,
      description: t('IotProjectMock.area.mallAtriumDescription'),
      planMode: 'inherit',
    },
    {
      id: 'area-parking-east',
      projectId,
      parentId: 'area-root',
      name: t('IotProjectMock.area.parkingEast'),
      type: 'zone',
      code: 'PARK-EAST',
      aliases: [t('IotProjectMock.area.parkingEastAlias')],
      sortOrder: 20,
      description: t('IotProjectMock.area.parkingEastDescription'),
      planMode: 'inherit',
    },
    {
      id: 'area-data-room',
      projectId,
      parentId: 'area-root',
      name: t('IotProjectMock.area.dataRoom'),
      type: 'room',
      code: 'DATA-ROOM',
      aliases: [t('IotProjectMock.area.dataRoomAlias')],
      sortOrder: 30,
      description: t('IotProjectMock.area.dataRoomDescription'),
      planMode: 'inherit',
    },
    {
      id: 'area-care-garden',
      projectId,
      parentId: 'area-root',
      name: t('IotProjectMock.area.careGarden'),
      type: 'zone',
      code: 'CARE-GARDEN',
      aliases: [t('IotProjectMock.area.careGardenAlias')],
      sortOrder: 40,
      description: t('IotProjectMock.area.careGardenDescription'),
      planMode: 'inherit',
    },
  ]
}

function createAreaSettings(projectId: string): ProjectAreaSettings {
  return {
    projectId,
    rootAreaId: 'area-root',
    areas: createAreas(projectId),
    floorPlans: [],
    geometries: [],
    whiteModelJobs: [],
    whiteModelCandidates: [],
  }
}

export function createProjectAreaMockAdapter() {
  return {
    async getSettings(projectId: string): Promise<ServiceResult<ProjectAreaSettings>> {
      return ok(createAreaSettings(projectId))
    },
  }
}

export const projectAreaService = {
  async getSettings(projectId: string) {
    return ok(createAreaSettings(projectId))
  },
}

export const projectRoleService = {
  async getSettings(projectId: string): Promise<ServiceResult<ProjectRoleSettings>> {
    return ok({
      projectId,
      roles: [
        { id: 'role-property', projectId, name: t('IotProjectMock.role.property'), code: 'property', description: t('IotProjectMock.role.propertyDescription') },
        { id: 'role-security', projectId, name: t('IotProjectMock.role.security'), code: 'security', description: t('IotProjectMock.role.securityDescription') },
        { id: 'role-maintenance', projectId, name: t('IotProjectMock.role.maintenance'), code: 'maintenance', description: t('IotProjectMock.role.maintenanceDescription') },
      ],
    })
  },
}

export const projectIdentityService = {
  subscribeSettings() {
    return readonly(activeIdentity)
  },
}

export const projectDataAccessService = {
  async getActiveAccess(projectId: string) {
    return ok({
      projectId,
      mode: 'all',
      areaIds: [] as string[],
    })
  },
  filterBusinessByArea<T>(
    _access: { mode: string; areaIds: string[] },
    records: T[],
    _resolve: (record: T) => { areaId?: string; text?: unknown[] },
  ) {
    return records
  },
}
