import { readonly, ref } from 'vue'

import { createIotDeviceApiAdapter } from './adapters/iotDeviceApiAdapter'
import type {
  CreateIotDeviceInput,
  ExecuteIotDeviceCommandInput,
  IotDevice,
  IotDeviceAdapter,
  IotDeviceCommandDefinition,
  IotDeviceCommandExecution,
  IotDeviceDiagnosis,
  IotDeviceFilters,
  IotDeviceGroupBasis,
  IotDeviceGroupsView,
  IotDeviceHealthDiagnosis,
  IotDeviceWorkbench,
  IotGroupDetail,
  IotHealthListView,
  IotNaturalLanguageFilterResult,
} from '../types'

export function createIotDeviceService(adapter: IotDeviceAdapter) {
  const workbench = ref<IotDeviceWorkbench | null>(null)
  const groupsView = ref<IotDeviceGroupsView | null>(null)
  const healthList = ref<IotHealthListView | null>(null)
  const currentDiagnosis = ref<IotDeviceHealthDiagnosis | null>(null)
  const currentDevice = ref<IotDevice | null>(null)
  const currentCommands = ref<IotDeviceCommandDefinition[]>([])
  const lastCommandExecution = ref<IotDeviceCommandExecution | null>(null)
  const lastNaturalFilter = ref<IotNaturalLanguageFilterResult | null>(null)
  const lastDiagnosis = ref<IotDeviceDiagnosis | null>(null)

  async function getWorkbench(filters: IotDeviceFilters) {
    const result = await adapter.getWorkbench(filters)
    if (result.ok) workbench.value = result.data
    return result
  }

  async function getDevice(projectId: string, deviceId: string) {
    const result = await adapter.getDevice(projectId, deviceId)
    if (result.ok) currentDevice.value = result.data
    return result
  }

  async function listDeviceCommands(projectId: string, deviceId: string) {
    const result = await adapter.listDeviceCommands(projectId, deviceId)
    if (result.ok) currentCommands.value = result.data
    return result
  }

  async function executeDeviceCommand(input: ExecuteIotDeviceCommandInput) {
    const result = await adapter.executeDeviceCommand(input)
    if (result.ok) lastCommandExecution.value = result.data
    return result
  }

  async function getGroups(projectId: string, basis?: IotDeviceGroupBasis) {
    const result = await adapter.getGroups(projectId, basis)
    if (result.ok) groupsView.value = result.data
    return result
  }

  const currentGroupDetail = ref<IotGroupDetail | null>(null)

  async function getGroupDetail(projectId: string, groupId: string) {
    const result = await adapter.getGroupDetail(projectId, groupId)
    if (result.ok) currentGroupDetail.value = result.data
    return result
  }

  async function notifyGroupOwners(projectId: string, groupId: string) {
    return adapter.notifyGroupOwners(projectId, groupId)
  }

  async function notifyDeviceOwners(projectId: string, deviceIds: string[]) {
    return adapter.notifyDeviceOwners(projectId, deviceIds)
  }

  async function getHealthList(projectId: string) {
    const result = await adapter.getHealthList(projectId)
    if (result.ok) healthList.value = result.data
    return result
  }

  async function getDeviceHealthDiagnosis(projectId: string, deviceId: string) {
    const result = await adapter.getDeviceHealthDiagnosis(projectId, deviceId)
    if (result.ok) currentDiagnosis.value = result.data
    return result
  }

  async function copyHealthAdvice(projectId: string, deviceId: string) {
    return adapter.copyHealthAdvice(projectId, deviceId)
  }

  async function notifyOwner(projectId: string, deviceId: string) {
    return adapter.notifyOwner(projectId, deviceId)
  }

  async function createDevice(input: CreateIotDeviceInput) {
    return adapter.createDevice(input)
  }

  async function setDeviceEnabled(projectId: string, deviceId: string, enabled: boolean) {
    const result = await adapter.setDeviceEnabled(projectId, deviceId, enabled)
    if (result.ok) {
      if (currentDevice.value?.id === deviceId) currentDevice.value = result.data
      if (workbench.value) {
        workbench.value = {
          ...workbench.value,
          devices: workbench.value.devices.map((device) => device.id === deviceId ? result.data : device),
        }
      }
    }
    return result
  }

  async function deleteDevice(projectId: string, deviceId: string) {
    const result = await adapter.deleteDevice(projectId, deviceId)
    if (result.ok) {
      if (currentDevice.value?.id === deviceId) currentDevice.value = null
      if (workbench.value) {
        workbench.value = {
          ...workbench.value,
          devices: workbench.value.devices.filter((device) => device.id !== deviceId),
        }
      }
    }
    return result
  }

  async function runNaturalLanguageFilter(projectId: string, text: string) {
    const result = await adapter.runNaturalLanguageFilter(projectId, text)
    if (result.ok) lastNaturalFilter.value = result.data
    return result
  }

  async function diagnoseDevice(projectId: string, deviceId: string) {
    const result = await adapter.diagnoseDevice(projectId, deviceId)
    if (result.ok) lastDiagnosis.value = result.data
    return result
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
      healthList.value = null
      currentDiagnosis.value = null
      currentDevice.value = null
      currentCommands.value = []
      lastCommandExecution.value = null
      lastNaturalFilter.value = null
      lastDiagnosis.value = null
      currentGroupDetail.value = null
    }
    return result
  }

  function subscribeWorkbench() {
    return readonly(workbench)
  }

  function subscribeCurrentDevice() {
    return readonly(currentDevice)
  }

  function subscribeCurrentCommands() {
    return readonly(currentCommands)
  }

  function subscribeLastCommandExecution() {
    return readonly(lastCommandExecution)
  }

  function subscribeGroupsView() {
    return readonly(groupsView)
  }

  function subscribeHealthList() {
    return readonly(healthList)
  }

  function subscribeCurrentDiagnosis() {
    return readonly(currentDiagnosis)
  }

  function subscribeLastNaturalFilter() {
    return readonly(lastNaturalFilter)
  }

  function subscribeLastDiagnosis() {
    return readonly(lastDiagnosis)
  }

  function subscribeCurrentGroupDetail() {
    return readonly(currentGroupDetail)
  }

  return {
    getWorkbench,
    getGroups,
    getGroupDetail,
    notifyGroupOwners,
    notifyDeviceOwners,
    subscribeCurrentGroupDetail,
    getHealthList,
    getDeviceHealthDiagnosis,
    copyHealthAdvice,
    notifyOwner,
    createDevice,
    getDevice,
    listDeviceCommands,
    executeDeviceCommand,
    setDeviceEnabled,
    deleteDevice,
    runNaturalLanguageFilter,
    diagnoseDevice,
    acceptTodo,
    completeTodo,
    snoozeTodo,
    dismissTodo,
    resetProjectData,
    subscribeWorkbench,
    subscribeGroupsView,
    subscribeHealthList,
    subscribeCurrentDiagnosis,
    subscribeCurrentDevice,
    subscribeCurrentCommands,
    subscribeLastCommandExecution,
    subscribeLastNaturalFilter,
    subscribeLastDiagnosis,
  }
}

export const iotDeviceService = createIotDeviceService(createIotDeviceApiAdapter())
