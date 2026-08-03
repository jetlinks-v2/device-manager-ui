import { err, ok } from '@device-manager-ui/services/shared/serviceResult'
import type {
  ProjectMember,
  ProjectPermissionState,
  ProjectRole,
  ProjectRoleAdapter,
  ProjectRoleMenuActionPermission,
  ProjectRoleMenuDataScope,
  ProjectRoleMenuPermission,
  ProjectRoleMemberRef,
  ProjectRolePermission,
  ProjectRoleSettings,
} from '../../types'

interface ContentSeed<T> {
  items?: T[]
}

type PermissionOverrides = Record<string, Record<string, ProjectPermissionState>>
type MenuActionOverrides = Record<string, Record<string, Record<string, ProjectPermissionState>>>
type MenuScopeOverrides = Record<string, Record<string, ProjectRoleMenuDataScope>>

const ROLE_OVERRIDE_KEY = 'jl-project-roles:permission-overrides:v1'
const ROLE_MENU_OVERRIDE_KEY = 'jl-project-roles:menu-overrides:v1'
const ROLE_MENU_ACTION_OVERRIDE_KEY = 'jl-project-roles:menu-action-overrides:v1'
const ROLE_MENU_SCOPE_OVERRIDE_KEY = 'jl-project-roles:menu-scope-overrides:v1'

const MENU_ACTION_KEYS: Record<string, string[]> = {
  'menu.project.overview': ['project.settings.view'],
  'menu.iot.device': ['asset.view'],
  'menu.iot.groups': ['asset.view', 'asset.bind'],
  'menu.iot.health': ['asset.view'],
  'menu.video.resources': ['asset.view', 'asset.bind'],
  'menu.video.playback': ['asset.view'],
  'menu.video.archive': ['alarm.view', 'report.view'],
  'menu.video.butler': ['asset.view', 'alarm.view'],
  'menu.patrol.workbench': ['patrol.view', 'patrol.review'],
  'menu.patrol.records': ['patrol.view', 'report.view'],
  'menu.patrol.config': ['patrol.config.manage'],
  'menu.alarm.board': ['alarm.view', 'alarm.handle'],
  'menu.alarm.rules': ['alarm.rule.manage', 'notification.manage'],
  'menu.alarm.reports': ['report.view'],
  'menu.viz.board': ['report.view'],
  'menu.viz.report': ['report.view'],
  'menu.viz.mobile': ['report.view'],
  'menu.settings.overview': ['project.settings.view'],
  'menu.settings.areas': ['area.view', 'area.manage'],
  'menu.settings.users': ['project.members.manage'],
  'menu.settings.roles': ['project.roles.manage'],
  'menu.settings.notifications': ['notification.manage'],
  'menu.settings.contacts': ['notification.manage'],
  'menu.settings.testData': ['project.settings.manage'],
}

const MENU_ACTION_LABELS: Record<string, string> = {
  'project.settings.view': '查看',
  'project.settings.manage': '修改设置',
  'project.members.manage': '管理成员',
  'project.roles.manage': '管理角色',
  'area.view': '查看',
  'area.manage': '维护区域',
  'asset.view': '查看',
  'asset.bind': '绑定资源',
  'alarm.view': '查看',
  'alarm.handle': '处理',
  'alarm.rule.manage': '配置规则',
  'report.view': '查看报告',
  'notification.manage': '配置通知',
  'module.manage': '管理模块',
  'patrol.view': '查看巡检',
  'patrol.review': '审核巡检',
  'patrol.config.manage': '维护配置',
}

const MENU_ACTION_DESCRIPTIONS: Record<string, string> = {
  'project.settings.view': '查看当前入口的基础信息。',
  'project.settings.manage': '修改当前入口相关设置。',
  'project.members.manage': '邀请、停用成员或调整成员归属。',
  'project.roles.manage': '修改角色权限和数据范围。',
  'area.view': '查看区域、楼层和平面图。',
  'area.manage': '新建、编辑、移动区域。',
  'asset.view': '查看资源列表、状态和详情。',
  'asset.bind': '把设备、摄像头或规则绑定到区域。',
  'alarm.view': '查看告警、证据和复核记录。',
  'alarm.handle': '认领、复判、关闭告警。',
  'alarm.rule.manage': '修改规则阈值、通知对象和处置流程。',
  'report.view': '查看分析报告、导出记录和运行结果。',
  'notification.manage': '配置通知规则、接收人和动态接收人。',
  'module.manage': '启停模块并调整应用装配配置。',
  'patrol.view': '查看巡检任务、记录和报告。',
  'patrol.review': '确认远程跳点、异常候选和报告草稿。',
  'patrol.config.manage': '维护巡检模板、点位、计划和远程辅助策略。',
}

async function loadProjectRoleSeed(): Promise<ProjectRole[]> {
  const root = await queryCollection('projectRoles').first() as ContentSeed<ProjectRole> | null
  return root?.items ?? []
}

async function loadProjectMemberSeed(): Promise<ProjectMember[]> {
  const root = await queryCollection('projectMembers').first() as ContentSeed<ProjectMember> | null
  return root?.items ?? []
}

function overrideStorageKey(projectId: string): string {
  return `${ROLE_OVERRIDE_KEY}:${projectId}`
}

function menuOverrideStorageKey(projectId: string): string {
  return `${ROLE_MENU_OVERRIDE_KEY}:${projectId}`
}

function menuActionOverrideStorageKey(projectId: string): string {
  return `${ROLE_MENU_ACTION_OVERRIDE_KEY}:${projectId}`
}

function menuScopeOverrideStorageKey(projectId: string): string {
  return `${ROLE_MENU_SCOPE_OVERRIDE_KEY}:${projectId}`
}

function readPermissionOverrides(projectId: string): PermissionOverrides {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(overrideStorageKey(projectId))
    return raw ? JSON.parse(raw) as PermissionOverrides : {}
  } catch {
    return {}
  }
}

function readMenuOverrides(projectId: string): PermissionOverrides {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(menuOverrideStorageKey(projectId))
    return raw ? JSON.parse(raw) as PermissionOverrides : {}
  } catch {
    return {}
  }
}

function readMenuActionOverrides(projectId: string): MenuActionOverrides {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(menuActionOverrideStorageKey(projectId))
    return raw ? JSON.parse(raw) as MenuActionOverrides : {}
  } catch {
    return {}
  }
}

function readMenuScopeOverrides(projectId: string): MenuScopeOverrides {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(menuScopeOverrideStorageKey(projectId))
    return raw ? JSON.parse(raw) as MenuScopeOverrides : {}
  } catch {
    return {}
  }
}

function writePermissionOverrides(projectId: string, overrides: PermissionOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(overrideStorageKey(projectId), JSON.stringify(overrides))
}

function writeMenuOverrides(projectId: string, overrides: PermissionOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(menuOverrideStorageKey(projectId), JSON.stringify(overrides))
}

function writeMenuActionOverrides(projectId: string, overrides: MenuActionOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(menuActionOverrideStorageKey(projectId), JSON.stringify(overrides))
}

function writeMenuScopeOverrides(projectId: string, overrides: MenuScopeOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(menuScopeOverrideStorageKey(projectId), JSON.stringify(overrides))
}

function clearRoleOverrides(projectId: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(overrideStorageKey(projectId))
  localStorage.removeItem(menuOverrideStorageKey(projectId))
  localStorage.removeItem(menuActionOverrideStorageKey(projectId))
  localStorage.removeItem(menuScopeOverrideStorageKey(projectId))
}

function getPermissionByKey(role: ProjectRole, key: string): ProjectRolePermission | undefined {
  return role.permissions.find((permission) => permission.key === key)
}

function menuUsesDataScope(menuKey: string): boolean {
  return !menuKey.startsWith('menu.settings.') && menuKey !== 'menu.project.overview'
}

function dataScopeLabel(mode: ProjectRoleMenuDataScope, role: ProjectRole): string {
  if (mode === 'inherit') return `沿用角色：${role.dataScope.label}`
  if (mode === 'all') return '全项目'
  if (mode === 'assigned') return '按分配范围'
  if (mode === 'none') return '无数据'
  return '不适用'
}

function dataScopeDescription(mode: ProjectRoleMenuDataScope, role: ProjectRole): string {
  if (mode === 'inherit') return role.dataScope.description
  if (mode === 'all') return '这个菜单可访问项目内全部业务数据。'
  if (mode === 'assigned') return '这个菜单只访问已分配区域、设备、摄像头、告警和证据。'
  if (mode === 'none') return '这个菜单不访问业务数据。'
  return '系统设置或入口类菜单不需要业务数据范围。'
}

function createMenuAction(
  role: ProjectRole,
  actionKey: string,
  overrideState?: ProjectPermissionState,
): ProjectRoleMenuActionPermission {
  const permission = getPermissionByKey(role, actionKey)

  return {
    key: actionKey,
    label: MENU_ACTION_LABELS[actionKey] ?? permission?.label ?? actionKey,
    description: MENU_ACTION_DESCRIPTIONS[actionKey] ?? permission?.description ?? '',
    state: overrideState ?? permission?.state ?? 'deny',
    fixed: permission?.fixed,
  }
}

function normalizeMenu(
  role: ProjectRole,
  menu: ProjectRoleMenuPermission,
  actionOverrides: Record<string, Record<string, ProjectPermissionState>>,
  scopeOverrides: Record<string, ProjectRoleMenuDataScope>,
): ProjectRoleMenuPermission {
  const actionKeys = MENU_ACTION_KEYS[menu.key] ?? []
  const scopeMode = menuUsesDataScope(menu.key)
    ? scopeOverrides[menu.key] ?? menu.dataScope?.mode ?? 'inherit'
    : 'not-applicable'

  return {
    ...menu,
    actions: actionKeys.map((actionKey) =>
      createMenuAction(role, actionKey, actionOverrides[menu.key]?.[actionKey]),
    ),
    dataScope: {
      mode: scopeMode,
      label: dataScopeLabel(scopeMode, role),
      description: dataScopeDescription(scopeMode, role),
    },
  }
}

function cloneRole(role: ProjectRole): ProjectRole {
  return {
    ...role,
    dataScope: {
      ...role.dataScope,
      includes: [...role.dataScope.includes],
      excludes: [...role.dataScope.excludes],
    },
    menuPermissions: (role.menuPermissions ?? []).map((permission) => ({
      ...permission,
      actions: permission.actions?.map((action) => ({ ...action })) ?? [],
      dataScope: permission.dataScope ? { ...permission.dataScope } : {
        mode: 'inherit',
        label: '',
        description: '',
      },
    })),
    permissions: role.permissions.map((permission) => ({ ...permission })),
    notes: [...role.notes],
  }
}

function applyOverrides(projectId: string, roles: ProjectRole[]): ProjectRole[] {
  const overrides = readPermissionOverrides(projectId)
  const menuOverrides = readMenuOverrides(projectId)
  const menuActionOverrides = readMenuActionOverrides(projectId)
  const menuScopeOverrides = readMenuScopeOverrides(projectId)

  return roles.map((sourceRole) => {
    const role = cloneRole(sourceRole)
    const roleOverrides = overrides[role.id] ?? {}
    const roleMenuOverrides = menuOverrides[role.id] ?? {}
    const roleMenuActionOverrides = menuActionOverrides[role.id] ?? {}
    const roleMenuScopeOverrides = menuScopeOverrides[role.id] ?? {}
    role.menuPermissions = role.menuPermissions.map((permission) => ({
      ...normalizeMenu(role, permission, roleMenuActionOverrides, roleMenuScopeOverrides),
      state: roleMenuOverrides[permission.key] ?? permission.state,
    }))
    role.permissions = role.permissions.map((permission) => ({
      ...permission,
      state: roleOverrides[permission.key] ?? permission.state,
    }))
    return role
  })
}

function toMemberRef(member: ProjectMember): ProjectRoleMemberRef {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    title: member.title,
    organization: member.organization,
    status: member.status,
    role: member.role,
    areaAccess: {
      ...member.areaAccess,
      areaIds: [...member.areaAccess.areaIds],
    },
    dataAccess: {
      ...member.dataAccess,
      areaIds: [...member.dataAccess.areaIds],
    },
  }
}

async function buildSettings(projectId: string): Promise<ProjectRoleSettings | null> {
  const roles = (await loadProjectRoleSeed()).filter((role) => role.projectId === projectId)
  if (!roles.length) return null

  const members = (await loadProjectMemberSeed())
    .filter((member) => member.projectId === projectId)
    .map(toMemberRef)

  return {
    projectId,
    roles: applyOverrides(projectId, roles),
    members,
  }
}

export function createProjectRoleMockAdapter(): ProjectRoleAdapter {
  return {
    async getSettings(projectId) {
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')
      return ok(settings)
    },

    async resetProjectData(projectId) {
      clearRoleOverrides(projectId)
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')
      return ok(settings)
    },

    async updatePermission(projectId, roleId, permissionKey, state) {
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')

      const role = settings.roles.find((item) => item.id === roleId)
      if (!role) return err('NOT_FOUND', `角色 ${roleId} 不存在`)

      const permission = role.permissions.find((item) => item.key === permissionKey)
      if (!permission) return err('NOT_FOUND', `权限 ${permissionKey} 不存在`)
      if (permission.fixed) return err('VALIDATION_FAILED', '该权限由系统保护，不能在这里修改')

      const overrides = readPermissionOverrides(projectId)
      overrides[roleId] = {
        ...(overrides[roleId] ?? {}),
        [permissionKey]: state,
      }
      writePermissionOverrides(projectId, overrides)

      const nextSettings = await buildSettings(projectId)
      return nextSettings ? ok(nextSettings) : err('NOT_FOUND', '未找到项目角色权限配置')
    },

    async updateMenuPermission(projectId, roleId, menuKey, state) {
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')

      const role = settings.roles.find((item) => item.id === roleId)
      if (!role) return err('NOT_FOUND', `角色 ${roleId} 不存在`)

      const permission = role.menuPermissions.find((item) => item.key === menuKey)
      if (!permission) return err('NOT_FOUND', `菜单 ${menuKey} 不存在`)
      if (permission.fixed) return err('VALIDATION_FAILED', '该菜单权限由系统保护，不能在这里修改')

      const overrides = readMenuOverrides(projectId)
      overrides[roleId] = {
        ...(overrides[roleId] ?? {}),
        [menuKey]: state,
      }
      writeMenuOverrides(projectId, overrides)

      const nextSettings = await buildSettings(projectId)
      return nextSettings ? ok(nextSettings) : err('NOT_FOUND', '未找到项目角色权限配置')
    },

    async updateMenuActionPermission(projectId, roleId, menuKey, actionKey, state) {
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')

      const role = settings.roles.find((item) => item.id === roleId)
      if (!role) return err('NOT_FOUND', `角色 ${roleId} 不存在`)

      const menu = role.menuPermissions.find((item) => item.key === menuKey)
      if (!menu) return err('NOT_FOUND', `菜单 ${menuKey} 不存在`)

      const action = menu.actions.find((item) => item.key === actionKey)
      if (!action) return err('NOT_FOUND', `操作 ${actionKey} 不存在`)
      if (action.fixed) return err('VALIDATION_FAILED', '该操作权限由系统保护，不能在这里修改')

      const overrides = readMenuActionOverrides(projectId)
      overrides[roleId] = {
        ...(overrides[roleId] ?? {}),
        [menuKey]: {
          ...(overrides[roleId]?.[menuKey] ?? {}),
          [actionKey]: state,
        },
      }
      writeMenuActionOverrides(projectId, overrides)

      const nextSettings = await buildSettings(projectId)
      return nextSettings ? ok(nextSettings) : err('NOT_FOUND', '未找到项目角色权限配置')
    },

    async updateMenuDataScope(projectId, roleId, menuKey, mode) {
      const settings = await buildSettings(projectId)
      if (!settings) return err('NOT_FOUND', '未找到项目角色权限配置')

      const role = settings.roles.find((item) => item.id === roleId)
      if (!role) return err('NOT_FOUND', `角色 ${roleId} 不存在`)

      const menu = role.menuPermissions.find((item) => item.key === menuKey)
      if (!menu) return err('NOT_FOUND', `菜单 ${menuKey} 不存在`)
      if (menu.dataScope.mode === 'not-applicable') return err('VALIDATION_FAILED', '该菜单不需要配置数据范围')

      const overrides = readMenuScopeOverrides(projectId)
      overrides[roleId] = {
        ...(overrides[roleId] ?? {}),
        [menuKey]: mode,
      }
      writeMenuScopeOverrides(projectId, overrides)

      const nextSettings = await buildSettings(projectId)
      return nextSettings ? ok(nextSettings) : err('NOT_FOUND', '未找到项目角色权限配置')
    },
  }
}

