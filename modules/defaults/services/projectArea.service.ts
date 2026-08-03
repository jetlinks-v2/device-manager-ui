import { readonly, ref } from 'vue'

import { createProjectAreaMockAdapter } from './adapters/projectAreaMockAdapter'
import type { ProjectAreaAdapter, ProjectAreaSettings } from '../types'

const MOCK_PROJECT_ID = 'doraemon'

/**
 * Contract:
 * getSettings(projectId)
 * resetProjectData(projectId)
 * updateArea(projectId, areaId, input)
 * moveArea(projectId, areaId, input)
 * startWhiteModelJob(projectId, floorPlanId)
 * selectWhiteModelCandidate(projectId, floorPlanId, candidateId)
 * publishWhiteModelCandidate(projectId, floorPlanId, candidateId)
 *
 * 项目区域管理的业务真值源。区域管理只维护空间结构与平面图，
 * 白模制作结果以图纸版本发布，设备、摄像头、网关和规则在各自模块中引用区域，
 * 不在这里管理。
 */
export function createProjectAreaService(adapter: ProjectAreaAdapter) {
  const currentSettings = ref<ProjectAreaSettings | null>(null)

  async function getSettings(projectId: string) {
    let result = await adapter.getSettings(projectId)
    if ((!result.ok || result.data.areas.length === 0) && projectId !== MOCK_PROJECT_ID) {
      result = await adapter.getSettings(MOCK_PROJECT_ID)
    }
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function resetProjectData(projectId: string) {
    const result = await adapter.resetProjectData(projectId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updateArea(projectId: string, areaId: string, input: Parameters<ProjectAreaAdapter['updateArea']>[2]) {
    const result = await adapter.updateArea(projectId, areaId, input)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function moveArea(projectId: string, areaId: string, input: Parameters<ProjectAreaAdapter['moveArea']>[2]) {
    const result = await adapter.moveArea(projectId, areaId, input)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function startWhiteModelJob(projectId: string, floorPlanId: string) {
    const result = await adapter.startWhiteModelJob(projectId, floorPlanId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function selectWhiteModelCandidate(
    projectId: string,
    floorPlanId: string,
    candidateId: string,
  ) {
    const result = await adapter.selectWhiteModelCandidate(projectId, floorPlanId, candidateId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function publishWhiteModelCandidate(
    projectId: string,
    floorPlanId: string,
    candidateId: string,
  ) {
    const result = await adapter.publishWhiteModelCandidate(projectId, floorPlanId, candidateId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  function subscribeSettings() {
    return readonly(currentSettings)
  }

  return {
    getSettings,
    resetProjectData,
    updateArea,
    moveArea,
    startWhiteModelJob,
    selectWhiteModelCandidate,
    publishWhiteModelCandidate,
    subscribeSettings,
  }
}

export const projectAreaService = createProjectAreaService(createProjectAreaMockAdapter())

