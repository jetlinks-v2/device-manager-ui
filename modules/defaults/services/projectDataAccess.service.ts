import type { Ref } from 'vue'
import { readonly } from 'vue'
import { err, ok } from '@device-manager-ui/services/shared/serviceResult'
import { projectIdentityService } from './projectIdentity.service'
import type {
  ProjectIdentitySettings,
  ProjectMember,
  ProjectMemberAreaAccess,
  ProjectMemberDataAccess,
} from '../types'

interface AreaScopeMeta {
  label: string
  areaIdPrefixes: string[]
  textMarkers: string[]
  refPrefixes: string[]
  rulePrefixes: string[]
}

export interface ProjectDataAccessView {
  projectId: string
  member: ProjectMember | null
  areaAccess: ProjectMemberAreaAccess
  dataAccess: ProjectMemberDataAccess
  dataAreaLabels: string[]
  dataAreaIdPrefixes: string[]
  dataTextMarkers: string[]
  dataRefPrefixes: string[]
  dataRulePrefixes: string[]
}

export interface ProjectDataAccessAdapter {
  getSettings(projectId: string): ReturnType<typeof projectIdentityService.getSettings>
  subscribeSettings(): Readonly<Ref<ProjectIdentitySettings | null>>
}

const PROJECT_ROOT_AREA_ID = 'area-dream-city'

const AREA_SCOPE_META: Record<string, AreaScopeMeta> = {
  [PROJECT_ROOT_AREA_ID]: {
    label: '梦想之城',
    areaIdPrefixes: ['area-'],
    textMarkers: ['梦想之城'],
    refPrefixes: [],
    rulePrefixes: [],
  },
  'area-mall': {
    label: '星环购物中心',
    areaIdPrefixes: ['area-mall'],
    textMarkers: ['星环购物中心', '购物中心', '商场', '中庭', '服务台', '主力店', '消防通道', '东侧车库', '卸货通道'],
    refPrefixes: [
      'iot-mall-', 'ch-dtb-mall-', 'src-dtb-mall', 'edge-dtb-mall',
      'vc-dtb-mall-', 'vec-dtb-mall-', 'alarm-doraemon-mall-', 'sp-dtb-mall-',
    ],
    rulePrefixes: ['rule-dtb-mall-', 'alarm-doraemon-mall-'],
  },
  'area-fuel-station': {
    label: '晨光能源站',
    areaIdPrefixes: ['area-fuel'],
    textMarkers: ['晨光能源站', '加油站', '能源站', '加油岛', '卸油区', '便利店', '收银区', '值班室'],
    refPrefixes: [
      'iot-fuel-', 'ch-dtb-fuel-', 'src-dtb-fuel', 'edge-dtb-fuel',
      'vc-dtb-fuel-', 'vec-dtb-fuel-', 'alarm-doraemon-fuel-', 'sp-dtb-fuel-',
    ],
    rulePrefixes: ['rule-dtb-fuel-', 'alarm-doraemon-fuel-'],
  },
  'area-care-home': {
    label: '松龄颐养院',
    areaIdPrefixes: ['area-care'],
    textMarkers: ['松龄颐养院', '颐养院', '养老院', '康养', '接待大厅', '护理站', '活动室', '东侧住区', '康复花园'],
    refPrefixes: [
      'iot-care-', 'ch-dtb-care-', 'src-dtb-care', 'edge-dtb-care',
      'vc-dtb-care-', 'vec-dtb-care-', 'alarm-doraemon-care-', 'sp-dtb-care-',
    ],
    rulePrefixes: ['rule-dtb-care-', 'alarm-doraemon-care-'],
  },
  'area-chem-plant': {
    label: '青岚化工厂',
    areaIdPrefixes: ['area-chem'],
    textMarkers: ['青岚化工厂', '化工厂', '中控', '反应釜', '投料', '储罐区', '装卸栈台'],
    refPrefixes: [
      'iot-chem-', 'ch-dtb-chem-', 'src-dtb-chem', 'edge-dtb-chem',
      'vc-dtb-chem-', 'vec-dtb-chem-', 'alarm-doraemon-chem-', 'sp-dtb-chem-',
    ],
    rulePrefixes: ['rule-dtb-chem-', 'alarm-doraemon-chem-'],
  },
  'area-tech-park': {
    label: '云栖科创园',
    areaIdPrefixes: ['area-tech'],
    textMarkers: ['云栖科创园', '科创园', '科技园区', '开放办公区', '联合实验室', '会议区', '主机房', 'UPS', '北门'],
    refPrefixes: [
      'iot-tech-', 'ch-dtb-tech-', 'src-dtb-tech', 'edge-dtb-tech',
      'vc-dtb-tech-', 'vec-dtb-tech-', 'alarm-doraemon-tech-', 'sp-dtb-tech-',
    ],
    rulePrefixes: ['rule-dtb-tech-', 'alarm-doraemon-tech-'],
  },
}

const FALLBACK_ADMIN_AREA_ACCESS: ProjectMemberAreaAccess = {
  mode: 'all',
  label: '全部区域',
  description: '可查看项目完整区域结构。',
  areaIds: [PROJECT_ROOT_AREA_ID],
}

const FALLBACK_ADMIN_DATA_ACCESS: ProjectMemberDataAccess = {
  mode: 'all',
  label: '全项目数据',
  description: '可访问项目全部业务数据。',
  areaIds: [PROJECT_ROOT_AREA_ID],
}

const FALLBACK_ASSIGNED_AREA_ACCESS: ProjectMemberAreaAccess = {
  mode: 'selected',
  label: '分配区域',
  description: '可查看已分配区域及其下级空间。',
  areaIds: ['area-mall', 'area-fuel-station', 'area-care-home'],
}

const FALLBACK_ASSIGNED_DATA_ACCESS: ProjectMemberDataAccess = {
  mode: 'selected',
  label: '分配区域数据',
  description: '可访问星环购物中心、晨光能源站、松龄颐养院下的业务数据。',
  areaIds: ['area-mall', 'area-fuel-station', 'area-care-home'],
}

const FALLBACK_EMPTY_AREA_ACCESS: ProjectMemberAreaAccess = {
  mode: 'all',
  label: '全部区域',
  description: '可查看项目完整区域结构。',
  areaIds: [PROJECT_ROOT_AREA_ID],
}

const FALLBACK_EMPTY_DATA_ACCESS: ProjectMemberDataAccess = {
  mode: 'none',
  label: '暂无业务数据',
  description: '不访问设备、摄像头、告警、证据和报告。',
  areaIds: [],
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function fallbackAreaAccess(member: ProjectMember | null): ProjectMemberAreaAccess {
  if (member?.dataProfile === 'assigned') return FALLBACK_ASSIGNED_AREA_ACCESS
  if (member?.dataProfile === 'empty') return FALLBACK_EMPTY_AREA_ACCESS
  return FALLBACK_ADMIN_AREA_ACCESS
}

function fallbackDataAccess(member: ProjectMember | null): ProjectMemberDataAccess {
  if (member?.dataProfile === 'assigned') return FALLBACK_ASSIGNED_DATA_ACCESS
  if (member?.dataProfile === 'empty') return FALLBACK_EMPTY_DATA_ACCESS
  return FALLBACK_ADMIN_DATA_ACCESS
}

function areaMetaFor(areaId: string): AreaScopeMeta {
  return AREA_SCOPE_META[areaId] ?? {
    label: areaId,
    areaIdPrefixes: [areaId],
    textMarkers: [areaId],
    refPrefixes: [],
    rulePrefixes: [],
  }
}

function expandAreaLabels(areaIds: string[]): string[] {
  if (areaIds.includes(PROJECT_ROOT_AREA_ID)) return ['全部区域']
  return areaIds.map((areaId) => areaMetaFor(areaId).label)
}

function expandAreaIdPrefixes(areaIds: string[]): string[] {
  if (areaIds.includes(PROJECT_ROOT_AREA_ID)) return ['area-']
  return uniq(areaIds.flatMap((areaId) => areaMetaFor(areaId).areaIdPrefixes))
}

function expandTextMarkers(areaIds: string[]): string[] {
  if (areaIds.includes(PROJECT_ROOT_AREA_ID)) return []
  return uniq(areaIds.flatMap((areaId) => areaMetaFor(areaId).textMarkers))
}

function expandRefPrefixes(areaIds: string[]): string[] {
  if (areaIds.includes(PROJECT_ROOT_AREA_ID)) return []
  return uniq(areaIds.flatMap((areaId) => areaMetaFor(areaId).refPrefixes))
}

function expandRulePrefixes(areaIds: string[]): string[] {
  if (areaIds.includes(PROJECT_ROOT_AREA_ID)) return []
  return uniq(areaIds.flatMap((areaId) => areaMetaFor(areaId).rulePrefixes))
}

function buildAccess(projectId: string, member: ProjectMember | null): ProjectDataAccessView {
  const areaAccess = member?.areaAccess ?? fallbackAreaAccess(member)
  const dataAccess = member?.dataAccess ?? fallbackDataAccess(member)
  const dataAreaIds = dataAccess.mode === 'all' ? [PROJECT_ROOT_AREA_ID] : dataAccess.areaIds

  return {
    projectId,
    member,
    areaAccess,
    dataAccess,
    dataAreaLabels: expandAreaLabels(dataAreaIds),
    dataAreaIdPrefixes: expandAreaIdPrefixes(dataAreaIds),
    dataTextMarkers: expandTextMarkers(dataAreaIds),
    dataRefPrefixes: expandRefPrefixes(dataAreaIds),
    dataRulePrefixes: expandRulePrefixes(dataAreaIds),
  }
}

function findActiveMember(settings: ProjectIdentitySettings | null): ProjectMember | null {
  if (!settings) return null
  return settings.members.find((member) => member.id === settings.activeMemberId) ?? settings.members[0] ?? null
}

export function createProjectDataAccessService(adapter: ProjectDataAccessAdapter) {
  async function getActiveAccess(projectId: string) {
    const cached = adapter.subscribeSettings().value
    if (cached?.projectId === projectId) {
      return ok(buildAccess(projectId, findActiveMember(cached)))
    }

    const result = await adapter.getSettings(projectId)
    if (!result.ok) return err(result.error.code, result.error.message, result.error.detail)
    return ok(buildAccess(projectId, findActiveMember(result.data)))
  }

  function getActiveAccessFromCache(projectId: string): ProjectDataAccessView | null {
    const cached = adapter.subscribeSettings().value
    if (cached?.projectId !== projectId) return null
    return buildAccess(projectId, findActiveMember(cached))
  }

  function subscribeIdentitySettings() {
    return readonly(adapter.subscribeSettings()) as Readonly<Ref<ProjectIdentitySettings | null>>
  }

  function canReadBusinessArea(access: ProjectDataAccessView, areaId?: string, ...textParts: Array<string | undefined>) {
    if (access.dataAccess.mode === 'all') return true
    if (access.dataAccess.mode === 'none') return false

    if (areaId && access.dataAreaIdPrefixes.some((prefix) => areaId.startsWith(prefix))) return true

    const text = textParts.filter(Boolean).join(' ')
    return !!text && access.dataTextMarkers.some((marker) => text.includes(marker))
  }

  function canReadBusinessRef(access: ProjectDataAccessView, ref?: string) {
    if (access.dataAccess.mode === 'all') return true
    if (access.dataAccess.mode === 'none') return false
    return !!ref && access.dataRefPrefixes.some((prefix) => ref.startsWith(prefix))
  }

  function canReadBusinessRule(access: ProjectDataAccessView, ruleId?: string) {
    if (access.dataAccess.mode === 'all') return true
    if (access.dataAccess.mode === 'none') return false
    return !!ruleId && access.dataRulePrefixes.some((prefix) => ruleId.startsWith(prefix))
  }

  function businessTextMatches(access: ProjectDataAccessView, ...parts: Array<string | undefined>) {
    if (access.dataAccess.mode === 'all') return true
    if (access.dataAccess.mode === 'none') return false
    const text = parts.filter(Boolean).join(' ')
    return !!text && access.dataTextMarkers.some((marker) => text.includes(marker))
  }

  function filterBusinessByArea<T>(
    access: ProjectDataAccessView,
    items: T[],
    read: (item: T) => { areaId?: string; text?: Array<string | undefined> },
  ): T[] {
    if (access.dataAccess.mode === 'all') return items
    if (access.dataAccess.mode === 'none') return []
    return items.filter((item) => {
      const scope = read(item)
      return canReadBusinessArea(access, scope.areaId, ...(scope.text ?? []))
    })
  }

  return {
    getActiveAccess,
    getActiveAccessFromCache,
    subscribeIdentitySettings,
    canReadBusinessArea,
    canReadBusinessRef,
    canReadBusinessRule,
    businessTextMatches,
    filterBusinessByArea,
  }
}

export const projectDataAccessService = createProjectDataAccessService({
  getSettings: (projectId) => projectIdentityService.getSettings(projectId),
  // Vue 的 readonly() 返回 DeepReadonly<Ref<T>>；adapter 契约只要求 Readonly<Ref<T>>，
  // 这里 cast 一次让 service 接口对消费者保持稳定。
  subscribeSettings: () =>
    projectIdentityService.subscribeSettings() as unknown as Readonly<
      Ref<ProjectIdentitySettings | null>
    >,
})

