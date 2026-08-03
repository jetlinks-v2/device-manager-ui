import { DEVICE_ACCESS_META } from '../deviceLibraryAccessMeta'
import { DEVICE_LIBRARY } from './deviceLibrary.seed'
import { err, ok } from '../../shared/serviceResult'
import type {
  AddToProjectInput,
  AdapterBrand,
  AdapterGroup,
  DeviceAccessMode,
  DeviceLibraryAdapter,
  DeviceTemplate,
} from '../types'

type SupportedModel = (typeof DEVICE_LIBRARY)[number]['supportedModels'][number]

function uniqueItems<T>(items: T[]): T[] {
  return [...new Set(items)]
}

const PROJECT_TEMPLATE_STORAGE_PREFIX = 'jetlinks:project-device-templates:'

const DEFAULT_PROJECT_TEMPLATE_IDS: Record<string, string[]> = {
  doraemon: [
    'water-leak-sensor',
    'temperature-humidity-sensor',
    'smoke-detector',
    'network-camera',
    'emergency-button',
    'smart-energy-meter',
  ],
}

function projectTemplateStorageKey(projectId: string) {
  return `${PROJECT_TEMPLATE_STORAGE_PREFIX}${projectId}`
}

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined'
}

function readProjectTemplateIds(projectId: string): string[] {
  if (!canUseLocalStorage()) return DEFAULT_PROJECT_TEMPLATE_IDS[projectId] ?? []
  const raw = localStorage.getItem(projectTemplateStorageKey(projectId))
  if (!raw) return DEFAULT_PROJECT_TEMPLATE_IDS[projectId] ?? []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return DEFAULT_PROJECT_TEMPLATE_IDS[projectId] ?? []
  }
}

function writeProjectTemplateIds(projectId: string, ids: string[]) {
  if (!canUseLocalStorage()) return
  localStorage.setItem(projectTemplateStorageKey(projectId), JSON.stringify(uniqueItems(ids)))
}

function accessTechTokens(mode: DeviceAccessMode) {
  return DEVICE_ACCESS_META[mode].tech.split(' / ')
}

function toAdapterBrand(brand: string, models: SupportedModel[]): AdapterBrand {
  const modelNames = uniqueItems(models.flatMap((model) => model.models))
  const accessModes = uniqueItems(models.map((model) => model.accessMode))

  return {
    brand,
    models: modelNames,
    modelsPreview: modelNames.slice(0, 3),
    modelCount: modelNames.length,
    accessModes,
    accessNames: uniqueItems(models.map((model) => model.accessName)),
    accessBusiness: uniqueItems(accessModes.map((mode) => DEVICE_ACCESS_META[mode].business)),
    accessTech: uniqueItems(accessModes.flatMap(accessTechTokens)),
    note: uniqueItems(models.map((model) => model.note)).join('；'),
    connectionHint: uniqueItems(models.map((model) => model.connectionHint)).join('；'),
    requirements: uniqueItems(models.flatMap((model) => model.requirements)),
  }
}

function deriveAdapterGroups(): AdapterGroup[] {
  return DEVICE_LIBRARY.map((template) => {
    const brandModels = new Map<string, SupportedModel[]>()

    for (const model of template.supportedModels) {
      const list = brandModels.get(model.brand) ?? []
      list.push(model)
      brandModels.set(model.brand, list)
    }

    const accessModes = uniqueItems(template.supportedModels.map((model) => model.accessMode))
    const accessNames = uniqueItems(template.supportedModels.map((model) => model.accessName))

    return {
      id: template.id,
      templateId: template.id,
      family: template.name,
      summary: template.summary,
      category: template.category,
      accessMode: accessModes[0] ?? 'direct',
      accessModes,
      accessName: template.accessName,
      accessNames,
      accessBusiness: `${accessModes.length} 种接入方式`,
      accessTech: uniqueItems(accessModes.flatMap(accessTechTokens)).join(' / '),
      maintainedBy: template.maintainedBy,
      industries: [...template.industries],
      scenarios: [...template.scenarios],
      brands: [...brandModels.entries()]
        .map(([brand, models]) => toAdapterBrand(brand, models))
        .sort((a, b) => a.brand.localeCompare(b.brand, 'zh-CN')),
      requirements: [...template.requirements],
      testSteps: [...template.testSteps],
      dataKinds: [...template.dataKinds],
      dataPoints: template.dataPoints.map((point) => ({ ...point })),
      /* v2 字段透传（深拷贝避免 mock 数据被消费方改动） */
      faultCodeDict: template.faultCodeDict?.map((entry) => ({
        ...entry,
        knowledgeRefs: entry.knowledgeRefs ? [...entry.knowledgeRefs] : undefined,
      })),
      telemetryNormalRanges: template.telemetryNormalRanges?.map((range) => ({ ...range })),
      knowledgeBase: template.knowledgeBase?.map((entry) => ({
        ...entry,
        tags: [...entry.tags],
      })),
    }
  })
}

function cloneAdapter(group: AdapterGroup): AdapterGroup {
  return {
    ...group,
    accessModes: [...group.accessModes],
    accessNames: [...group.accessNames],
    brands: group.brands.map((brand) => ({
      ...brand,
      models: [...brand.models],
      modelsPreview: [...brand.modelsPreview],
      accessModes: [...brand.accessModes],
      accessNames: [...brand.accessNames],
      accessBusiness: [...brand.accessBusiness],
      accessTech: [...brand.accessTech],
      requirements: [...brand.requirements],
    })),
    faultCodeDict: group.faultCodeDict?.map((entry) => ({
      ...entry,
      knowledgeRefs: entry.knowledgeRefs ? [...entry.knowledgeRefs] : undefined,
    })),
    telemetryNormalRanges: group.telemetryNormalRanges?.map((range) => ({ ...range })),
    knowledgeBase: group.knowledgeBase?.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
    })),
  }
}

function cloneTemplate(template: DeviceTemplate): DeviceTemplate {
  return {
    ...template,
    scenarios: [...template.scenarios],
    industries: [...template.industries],
    supportedBrands: [...template.supportedBrands],
    supportedModels: template.supportedModels.map((model) => ({
      ...model,
      models: [...model.models],
      requirements: [...model.requirements],
    })),
    modelKeywords: [...template.modelKeywords],
    accessModes: [...template.accessModes],
    dataKinds: [...template.dataKinds],
    dataPoints: template.dataPoints.map((point) => ({ ...point })),
    requirements: [...template.requirements],
    testSteps: [...template.testSteps],
    projectDefaults: [...template.projectDefaults],
    faultCodeDict: template.faultCodeDict?.map((entry) => ({
      ...entry,
      knowledgeRefs: entry.knowledgeRefs ? [...entry.knowledgeRefs] : undefined,
    })),
    telemetryNormalRanges: template.telemetryNormalRanges?.map((range) => ({ ...range })),
    knowledgeBase: template.knowledgeBase?.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
    })),
  }
}

export function createDeviceLibraryMockAdapter(): DeviceLibraryAdapter {
  const adapterGroups = deriveAdapterGroups()

  return {
    async listTemplates() {
      return ok(DEVICE_LIBRARY.map(cloneTemplate))
    },

    async getTemplate(id: string) {
      const found = DEVICE_LIBRARY.find((template) => template.id === id)
      if (!found) return err('NOT_FOUND', '未找到该物联设备', { id })
      return ok(cloneTemplate(found))
    },

    async listProjectTemplates(projectId: string) {
      const ids = readProjectTemplateIds(projectId)
      const templates = ids
        .map((id) => DEVICE_LIBRARY.find((template) => template.id === id))
        .filter((template): template is DeviceTemplate => Boolean(template))
      return ok(templates.map(cloneTemplate))
    },

    async listAdapters() {
      return ok(adapterGroups.map(cloneAdapter))
    },

    async getAdapter(id: string) {
      const found = adapterGroups.find((group) => group.id === id)
      if (!found) return err('NOT_FOUND', '未找到该设备适配方案', { id })
      return ok(cloneAdapter(found))
    },

    async addToProject(input: AddToProjectInput) {
      const found = adapterGroups.find((group) => group.id === input.adapterId)
      if (!found) return err('NOT_FOUND', '未找到该设备适配方案', input)
      const brand = found.brands.find((item) => item.brand === input.brand)
      if (!brand) return err('NOT_FOUND', '未找到该厂商适配范围', input)
      if (!input.modelNames.length) return err('VALIDATION_FAILED', '请至少选择一个型号', input)
      const invalidModels = input.modelNames.filter((model) => !brand.models.includes(model))
      if (invalidModels.length) return err('VALIDATION_FAILED', '型号不属于该厂商适配范围', { ...input, invalidModels })
      if (input.accessMode && !brand.accessModes.includes(input.accessMode)) {
        return err('VALIDATION_FAILED', '接入方式不属于该厂商适配范围', input)
      }
      const nextIds = uniqueItems([...readProjectTemplateIds(input.projectId), found.templateId])
      writeProjectTemplateIds(input.projectId, nextIds)
      return ok({
        taskId: `device-add-${Date.now()}`,
        projectId: input.projectId,
        templateId: found.templateId,
        addedAt: new Date().toISOString(),
      })
    },
  }
}
