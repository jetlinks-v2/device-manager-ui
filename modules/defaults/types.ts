import type { ServiceResult } from '@device-manager-ui/services/shared/serviceResult'

export type ProjectAreaType = 'site' | 'building' | 'floor' | 'zone' | 'room' | 'point'
export type ProjectAreaPlanMode = 'own' | 'inherit'

export interface ProjectFloorPlanSourceReference {
  name: string
  url: string
  previewImageUrl?: string
  publisher: string
  note: string
}

export interface ProjectArea {
  id: string
  projectId: string
  parentId?: string
  name: string
  type: ProjectAreaType
  canBindAsset?: boolean
  code: string
  aliases: string[]
  sortOrder: number
  description: string
  planMode: ProjectAreaPlanMode
  floorPlanId?: string
}

export interface ProjectFloorPlan {
  id: string
  projectId: string
  areaId: string
  name: string
  fileName: string
  fileType: 'svg' | 'pdf' | 'image'
  scale: string
  rotation: string
  status: 'ready' | 'draft'
  updatedAt: string
  sourceReference?: ProjectFloorPlanSourceReference
}

export type ProjectFloorPlanWhiteModelStatus = 'draft' | 'generated' | 'published' | 'archived'
export type ProjectFloorPlanWhiteModelJobStatus = 'idle' | 'recognizing' | 'generating' | 'ready' | 'published'
export type ProjectFloorPlanWhiteModelGenerationMode = 'internal'

export interface ProjectFloorPlanWhiteModelRecognition {
  walls: number
  rooms: number
  doors: number
  labels: number
  confidence: number
  reviewItems: string[]
}

export interface ProjectFloorPlanWhiteModelCandidate {
  id: string
  floorPlanId: string
  generationMode: ProjectFloorPlanWhiteModelGenerationMode
  styleKey: string
  styleName: string
  imageUrl: string
  status: ProjectFloorPlanWhiteModelStatus
  generatedAt: string
  promptSummary: string
  qualityLabel: string
  qualityReason: string
  sourceReference?: ProjectFloorPlanSourceReference
  reviewItems: string[]
  score: number
}

export interface ProjectFloorPlanWhiteModelJob {
  id: string
  projectId: string
  floorPlanId: string
  status: ProjectFloorPlanWhiteModelJobStatus
  mode: ProjectFloorPlanWhiteModelGenerationMode
  progress: number
  stageLabel: string
  startedAt: string
  completedAt?: string
  selectedCandidateId?: string
  publishedCandidateId?: string
  qualityScore: number
  qualityThreshold: number
  reviewReason: string
  recognition: ProjectFloorPlanWhiteModelRecognition
}

export interface ProjectAreaGeometry {
  id: string
  projectId: string
  floorPlanId: string
  areaId: string
  x: number
  y: number
  width: number
  height: number
  labelX: number
  labelY: number
}

export interface ProjectAreaSettings {
  projectId: string
  rootAreaId: string
  areas: ProjectArea[]
  floorPlans: ProjectFloorPlan[]
  geometries: ProjectAreaGeometry[]
  whiteModelJobs: ProjectFloorPlanWhiteModelJob[]
  whiteModelCandidates: ProjectFloorPlanWhiteModelCandidate[]
}

export interface ProjectAreaUpdateInput {
  name: string
  code: string
  aliases: string[]
  description: string
  sortOrder: number
  planMode: ProjectAreaPlanMode
}

export interface ProjectAreaMoveInput {
  parentId?: string
  sortOrder: number
}

export interface ProjectAreaAdapter {
  getSettings(projectId: string): Promise<ServiceResult<ProjectAreaSettings>>
  resetProjectData(projectId: string): Promise<ServiceResult<ProjectAreaSettings>>
  updateArea(
    projectId: string,
    areaId: string,
    input: ProjectAreaUpdateInput,
  ): Promise<ServiceResult<ProjectAreaSettings>>
  moveArea(
    projectId: string,
    areaId: string,
    input: ProjectAreaMoveInput,
  ): Promise<ServiceResult<ProjectAreaSettings>>
  startWhiteModelJob(projectId: string, floorPlanId: string): Promise<ServiceResult<ProjectAreaSettings>>
  selectWhiteModelCandidate(
    projectId: string,
    floorPlanId: string,
    candidateId: string,
  ): Promise<ServiceResult<ProjectAreaSettings>>
  publishWhiteModelCandidate(
    projectId: string,
    floorPlanId: string,
    candidateId: string,
  ): Promise<ServiceResult<ProjectAreaSettings>>
}

export type ProjectMemberRole = 'admin' | 'operator' | 'member'
export type ProjectMemberDataProfile = 'admin' | 'assigned' | 'empty'
export type ProjectMemberStatus = 'active' | 'invited' | 'disabled'
export type ProjectRoleDataScope = 'all' | 'assigned' | 'none'
export type ProjectPermissionState = 'allow' | 'deny'
export type ProjectMemberAreaAccessMode = 'all' | 'selected'
export type ProjectMemberDataAccessMode = 'all' | 'selected' | 'none'

export interface ProjectMemberAssignment {
  label: string
  value: string
}

export interface ProjectMemberAreaAccess {
  mode: ProjectMemberAreaAccessMode
  label: string
  description: string
  areaIds: string[]
}

export interface ProjectMemberDataAccess {
  mode: ProjectMemberDataAccessMode
  label: string
  description: string
  areaIds: string[]
}

export interface ProjectMember {
  id: string
  projectId: string
  name: string
  email: string
  avatarUrl: string
  title: string
  organization: string
  role: ProjectMemberRole
  dataProfile: ProjectMemberDataProfile
  areaAccess: ProjectMemberAreaAccess
  dataAccess: ProjectMemberDataAccess
  status: ProjectMemberStatus
  lastActiveAt: string
  assignments: ProjectMemberAssignment[]
  note: string
}

export interface ProjectIdentitySettings {
  projectId: string
  activeMemberId: string
  members: ProjectMember[]
}

export interface ProjectMemberAccessUpdateInput {
  areaAccess: ProjectMemberAreaAccess
  dataAccess: ProjectMemberDataAccess
}

export interface ProjectIdentityAdapter {
  getSettings(projectId: string): Promise<ServiceResult<ProjectIdentitySettings>>
  setActiveMember(projectId: string, memberId: string): Promise<ServiceResult<ProjectIdentitySettings>>
  updateMemberAccess(
    projectId: string,
    memberId: string,
    input: ProjectMemberAccessUpdateInput,
  ): Promise<ServiceResult<ProjectIdentitySettings>>
  resetProjectData(projectId: string): Promise<ServiceResult<ProjectIdentitySettings>>
}

export interface ProjectRolePermission {
  key: string
  group: string
  label: string
  description: string
  state: ProjectPermissionState
  fixed?: boolean
}

export interface ProjectRoleMenuActionPermission {
  key: string
  label: string
  description: string
  state: ProjectPermissionState
  fixed?: boolean
}

export type ProjectRoleMenuDataScope =
  | 'inherit'
  | ProjectRoleDataScope
  | 'not-applicable'

export interface ProjectRoleMenuDataScopeRule {
  mode: ProjectRoleMenuDataScope
  label: string
  description: string
}

export interface ProjectRoleMenuPermission {
  key: string
  group: string
  label: string
  description: string
  route: string
  state: ProjectPermissionState
  actions: ProjectRoleMenuActionPermission[]
  dataScope: ProjectRoleMenuDataScopeRule
  fixed?: boolean
}

export interface ProjectRoleDataScopeRule {
  mode: ProjectRoleDataScope
  label: string
  description: string
  includes: string[]
  excludes: string[]
}

export interface ProjectRole {
  id: string
  projectId: string
  key: ProjectMemberRole
  name: string
  description: string
  builtIn: boolean
  dataScope: ProjectRoleDataScopeRule
  menuPermissions: ProjectRoleMenuPermission[]
  permissions: ProjectRolePermission[]
  notes: string[]
  updatedAt: string
}

export interface ProjectRoleMemberRef {
  id: string
  name: string
  email: string
  title: string
  organization: string
  status: ProjectMemberStatus
  role: ProjectMemberRole
  areaAccess: ProjectMemberAreaAccess
  dataAccess: ProjectMemberDataAccess
}

export interface ProjectRoleSettings {
  projectId: string
  roles: ProjectRole[]
  members: ProjectRoleMemberRef[]
}

export interface ProjectRoleAdapter {
  getSettings(projectId: string): Promise<ServiceResult<ProjectRoleSettings>>
  resetProjectData(projectId: string): Promise<ServiceResult<ProjectRoleSettings>>
  updatePermission(
    projectId: string,
    roleId: string,
    permissionKey: string,
    state: ProjectPermissionState,
  ): Promise<ServiceResult<ProjectRoleSettings>>
  updateMenuPermission(
    projectId: string,
    roleId: string,
    menuKey: string,
    state: ProjectPermissionState,
  ): Promise<ServiceResult<ProjectRoleSettings>>
  updateMenuActionPermission(
    projectId: string,
    roleId: string,
    menuKey: string,
    actionKey: string,
    state: ProjectPermissionState,
  ): Promise<ServiceResult<ProjectRoleSettings>>
  updateMenuDataScope(
    projectId: string,
    roleId: string,
    menuKey: string,
    mode: ProjectRoleMenuDataScope,
  ): Promise<ServiceResult<ProjectRoleSettings>>
}

