import { computed, readonly, ref } from 'vue'

import { createDeviceLibraryMockAdapter } from './adapters/deviceLibraryMockAdapter'
import type { AddToProjectInput, AdapterGroup, DeviceLibraryAdapter, DeviceTemplate } from './types'

export function createDeviceLibraryService(adapter: DeviceLibraryAdapter) {
  const templates = ref<DeviceTemplate[]>([])
  const projectTemplates = ref<Record<string, DeviceTemplate[]>>({})
  const adapters = ref<AdapterGroup[]>([])

  async function listTemplates() {
    const result = await adapter.listTemplates()
    if (result.ok) templates.value = result.data
    return result
  }

  async function getTemplate(id: string) {
    const existing = templates.value.find((item) => item.id === id)
    if (existing) return { ok: true as const, data: existing }
    return adapter.getTemplate(id)
  }

  async function listProjectTemplates(projectId: string) {
    const result = await adapter.listProjectTemplates(projectId)
    if (result.ok) {
      projectTemplates.value = {
        ...projectTemplates.value,
        [projectId]: result.data,
      }
    }
    return result
  }

  async function listAdapters() {
    const result = await adapter.listAdapters()
    if (result.ok) adapters.value = result.data
    return result
  }

  async function getAdapter(id: string) {
    const existing = adapters.value.find((item) => item.id === id)
    if (existing) return { ok: true as const, data: existing }
    return adapter.getAdapter(id)
  }

  async function addToProject(input: AddToProjectInput) {
    const result = await adapter.addToProject(input)
    if (result.ok) await listProjectTemplates(input.projectId)
    return result
  }

  function subscribeAdapters() {
    return readonly(adapters)
  }

  function subscribeTemplates() {
    return readonly(templates)
  }

  function subscribeProjectTemplates(projectId: string) {
    return readonly(computed(() => projectTemplates.value[projectId] ?? []))
  }

  return {
    listTemplates,
    getTemplate,
    listProjectTemplates,
    listAdapters,
    getAdapter,
    addToProject,
    subscribeAdapters,
    subscribeTemplates,
    subscribeProjectTemplates,
  }
}

export const deviceLibraryService = createDeviceLibraryService(createDeviceLibraryMockAdapter())
