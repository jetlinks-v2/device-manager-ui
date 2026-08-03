import { readonly, ref } from 'vue'

import { createIotDeviceMockAdapter } from './adapters/iotDeviceMockAdapter'
import type {
  IotDeviceAdapter,
  IotDeviceFilters,
  IotDeviceGroupBasis,
  IotDeviceGroupUpdateInput,
  IotGroupDetail,
  IotDeviceGroupsView,
  IotDeviceWorkbench,
} from '../types'

export const IOT_MOCK_PROJECT_ID = 'doraemon'

export function createIotDeviceService(adapter: IotDeviceAdapter) {
  const workbench = ref<IotDeviceWorkbench | null>(null)
  const groupsView = ref<IotDeviceGroupsView | null>(null)
  const currentGroupDetail = ref<IotGroupDetail | null>(null)

  function shouldFallbackWorkbench(result: Awaited<ReturnType<IotDeviceAdapter['getWorkbench']>>) {
    return !result.ok || result.data.devices.length === 0
  }

  function shouldFallbackGroups(result: Awaited<ReturnType<IotDeviceAdapter['getGroups']>>) {
    return !result.ok || result.data.devices.length === 0 || result.data.groups.length === 0
  }

  async function getWorkbench(filters: IotDeviceFilters) {
    let result = await adapter.getWorkbench(filters)
    if (filters.projectId !== IOT_MOCK_PROJECT_ID && shouldFallbackWorkbench(result)) {
      result = await adapter.getWorkbench({ ...filters, projectId: IOT_MOCK_PROJECT_ID })
    }
    if (result.ok) workbench.value = result.data
    return result
  }

  async function getGroups(projectId: string, basis?: IotDeviceGroupBasis) {
    let result = await adapter.getGroups(projectId, basis)
    if (projectId !== IOT_MOCK_PROJECT_ID && shouldFallbackGroups(result)) {
      result = await adapter.getGroups(IOT_MOCK_PROJECT_ID, basis)
    }
    if (result.ok) groupsView.value = result.data
    return result
  }

  async function getGroupDetail(projectId: string, groupId: string) {
    let result = await adapter.getGroupDetail(projectId, groupId)
    if (projectId !== IOT_MOCK_PROJECT_ID && (!result.ok || result.data.devices.length === 0)) {
      result = await adapter.getGroupDetail(IOT_MOCK_PROJECT_ID, groupId)
    }
    if (result.ok) currentGroupDetail.value = result.data
    return result
  }

  async function notifyGroupOwners(projectId: string, groupId: string) {
    return adapter.notifyGroupOwners(projectId, groupId)
  }

  async function updateGroup(projectId: string, groupId: string, input: IotDeviceGroupUpdateInput) {
    const result = await adapter.updateGroup(projectId, groupId, input)
    if (result.ok && currentGroupDetail.value?.group.id === groupId) {
      currentGroupDetail.value = { ...currentGroupDetail.value, group: result.data }
    }
    groupsView.value = null
    return result
  }

  async function deleteGroup(projectId: string, groupId: string) {
    const result = await adapter.deleteGroup(projectId, groupId)
    if (result.ok) {
      if (currentGroupDetail.value?.group.id === groupId) currentGroupDetail.value = null
      groupsView.value = null
    }
    return result
  }

  async function notifyDeviceOwners(projectId: string, deviceIds: string[]) {
    return adapter.notifyDeviceOwners(projectId, deviceIds)
  }

  async function acceptTodo(projectId: string, todoId: string) {
    return adapter.acceptTodo(projectId, todoId)
  }

  async function completeTodo(projectId: string, todoId: string, action?: string) {
    return adapter.completeTodo(projectId, todoId, action)
  }

  async function snoozeTodo(projectId: string, todoId: string, action?: string) {
    return adapter.snoozeTodo(projectId, todoId, action)
  }

  async function dismissTodo(projectId: string, todoId: string) {
    return adapter.dismissTodo(projectId, todoId)
  }

  async function resetProjectData(projectId: string) {
    const result = await adapter.resetProjectData(projectId)
    if (result.ok) {
      workbench.value = null
      groupsView.value = null
      currentGroupDetail.value = null
    }
    return result
  }

  function subscribeWorkbench() {
    return readonly(workbench)
  }

  function subscribeGroupsView() {
    return readonly(groupsView)
  }

  function subscribeCurrentGroupDetail() {
    return readonly(currentGroupDetail)
  }

  return {
    getWorkbench,
    getGroups,
    getGroupDetail,
    updateGroup,
    deleteGroup,
    notifyGroupOwners,
    notifyDeviceOwners,
    acceptTodo,
    completeTodo,
    snoozeTodo,
    dismissTodo,
    resetProjectData,
    subscribeWorkbench,
    subscribeGroupsView,
    subscribeCurrentGroupDetail,
  }
}

export const iotDeviceService = createIotDeviceService(createIotDeviceMockAdapter())
