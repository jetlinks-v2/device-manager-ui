import { err, ok } from '@jetlinks-web-core/utils/service-result'

import {
  buildIot2ProductTemplateFilterOptions,
  buildIot2TemplateParameterOptions,
  findIot2ProductTemplate,
  IOT2_PRODUCT_TEMPLATE_SEEDS,
} from '@device-manager-ui/views/device/shared/device-library/data/productTemplates.mock'
import type { Iot2ProductTemplate } from '@device-manager-ui/views/device/shared/device-library/services/iot2.types'

import type {
  IotDeviceLibraryAdapter,
  IotDeviceLibraryConnectionHealthConfig,
  IotDeviceLibraryFilterGroup,
  IotDeviceLibraryJoinedProduct,
  IotDeviceLibraryJoinInput,
  IotDeviceLibraryJoinResult,
  IotDeviceLibraryListResult,
  IotDeviceLibraryMarketInfo,
  IotDeviceLibraryQuery,
  IotDeviceLibraryTagOption,
  IotDeviceLibraryTemplateCard,
  IotDeviceLibraryTemplateDetail,
  IotDeviceLibraryThingModelDefinition,
} from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'

const STORAGE_KEY = 'jl:iot:device-library:joined-products'

function deriveTenantId(projectId: string) {
  return `tenant:${projectId}`
}

function readJoinedProducts(): IotDeviceLibraryJoinedProduct[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IotDeviceLibraryJoinedProduct[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJoinedProducts(items: IotDeviceLibraryJoinedProduct[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function normalizeBrand(value: string) {
  return value || 'all'
}

function getSearchTexts(template: Iot2ProductTemplate, field: IotDeviceLibraryQuery['searchField']) {
  if (field === 'name') return [template.name]
  if (field === 'brand') return [template.brand]
  if (field === 'model') return [template.model]
  if (field === 'tag') return [...template.tags]
  if (field === 'description') return [template.description]
  return [
    template.name,
    template.brand,
    template.model,
    template.description,
    template.protocol,
    ...template.tags,
  ]
}

function matchesKeyword(template: Iot2ProductTemplate, keyword: string, field: IotDeviceLibraryQuery['searchField']) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return getSearchTexts(template, field).join(' ').toLowerCase().includes(text)
}

function matchesQuery(template: Iot2ProductTemplate, query: IotDeviceLibraryQuery) {
  if (template.status !== 'published') return false
  if (!matchesKeyword(template, query.keyword, query.searchField)) return false
  if (query.industry !== 'all' && template.industry !== query.industry) return false
  if (query.protocol !== 'all' && template.protocol !== query.protocol) return false
  if (query.category !== 'all' && template.category !== query.category) return false
  if (normalizeBrand(query.brand) !== 'all' && template.brand !== query.brand) return false
  return true
}

function sortTemplates(items: Iot2ProductTemplate[]) {
  return [...items].sort((a, b) => {
    if (b.popularity !== a.popularity) return b.popularity - a.popularity
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

function toCard(
  template: Iot2ProductTemplate,
  joinedProducts: IotDeviceLibraryJoinedProduct[],
  tenantId: string,
): IotDeviceLibraryTemplateCard {
  const joined = joinedProducts.find((item) => item.tenantId === tenantId && item.templateId === template.id)
  return {
    id: template.id,
    name: template.name,
    icon: template.icon,
    description: template.description,
    brand: template.brand,
    model: template.model,
    protocol: template.protocol,
    category: template.category,
    industry: template.industry,
    tags: [...template.tags],
    version: template.version,
    maintainer: template.maintainer,
    updatedAt: template.updatedAt,
    usageCount: template.usageCount,
    popularity: template.popularity,
    joined: !!joined,
    joinedProductName: joined?.productName,
  }
}

function toTagOptions(
  result: ReturnType<typeof buildIot2ProductTemplateFilterOptions>,
): Record<IotDeviceLibraryFilterGroup, IotDeviceLibraryTagOption[]> {
  return {
    industry: result.industries.map((item) => ({ ...item, group: 'industry' })),
    protocol: result.protocols.map((item) => ({ ...item, group: 'protocol' })),
    category: result.categories.map((item) => ({ ...item, group: 'category' })),
    brand: result.brands.map((item) => ({ ...item, group: 'brand' })),
  }
}

function toAccessModeLabel(value?: string) {
  if (value === 'read') return '只读'
  if (value === 'write') return '只写'
  if (value === 'readwrite') return '读写'
  return value || '-'
}

function buildVersionHistory(template: Iot2ProductTemplate) {
  return [
    {
      id: `${template.id}:v${template.version}`,
      version: template.version,
      status: 'current' as const,
      releaseDate: template.updatedAt,
      summary: '当前上架版本，作为设备库默认可用模板。',
      changeType: 'release' as const,
      maintainer: template.maintainer,
    },
    {
      id: `${template.id}:v1.1.0`,
      version: '1.1.0',
      status: 'history' as const,
      releaseDate: '2026-02-18T10:20:00.000Z',
      summary: '补充标准模板的故障码映射与健康规则阈值。',
      changeType: 'config' as const,
      maintainer: template.maintainer,
    },
    {
      id: `${template.id}:v1.0.0`,
      version: '1.0.0',
      status: 'history' as const,
      releaseDate: '2025-12-08T09:00:00.000Z',
      summary: '首个正式发布版本，提供标准物模型与协议接入能力。',
      changeType: 'compatible' as const,
      maintainer: template.maintainer,
    },
  ]
}

function buildMarketInfo(template: Iot2ProductTemplate): IotDeviceLibraryMarketInfo {
  return {
    resourceId: `device-template:${template.id}`,
    providerName: template.maintainer,
    providerType: template.provider === 'official' ? '官方维护' : '合作方维护',
    currentVersion: template.version,
    compatibility: `${template.protocol} / ${template.category}`,
    lastPublishedAt: template.updatedAt,
    releaseChannel: '设备库上架版本',
    installHint: '加入项目后会基于标准模板创建产品，同一项目内同一模板仅可加入一次。',
    supportStatement: '设备模板、协议文档、资源文档与维修知识库统一由模板能力维护，设备库侧只提供查看与加入项目能力。',
    versionHistory: buildVersionHistory(template),
  }
}

function buildConnectionHealthConfig(template: Iot2ProductTemplate): IotDeviceLibraryConnectionHealthConfig {
  return {
    noData: {
      enabled: true,
      title: '无数据',
      condition: '连续 10 分钟未收到关键属性上报',
      severity: 'watch',
      description: `适用于 ${template.protocol} 接入设备的静默监测。超过持续时间后，设备健康将判定为连接异常。`,
      suggestion: '优先检查采集周期、网络链路和设备供电状态，确认设备是否仍在正常上报。',
    },
    offline: {
      enabled: true,
      title: '设备离线',
      condition: '离线状态持续 5 分钟',
      severity: 'urgent',
      description: '用于识别设备持续掉线或网关不可达的情况，适合作为设备连接异常的主判断规则。',
      suggestion: '检查设备在线状态、认证配置和现场网络环境，必要时执行重连或现场重启。',
    },
    fluctuation: {
      enabled: true,
      title: '连接波动',
      condition: '30 分钟内离线 3 次及以上',
      severity: 'watch',
      description: '用于识别短时间内反复上下线的连接抖动场景，便于提前发现链路不稳定风险。',
      suggestion: '检查信号质量、供电抖动和边缘网关负载情况，结合历史日志定位波动原因。',
    },
  }
}

function buildThingModelDefinition(template: Iot2ProductTemplate): IotDeviceLibraryThingModelDefinition {
  return {
    description: '物模型由标准模板统一维护，项目中仅支持查看与使用。',
    properties: template.thingModel.properties.map((item, index) => ({
      id: item.id,
      name: item.name,
      identifier: item.identifier,
      dataType: item.dataType,
      accessMode: item.accessMode || 'read',
      source: index % 2 === 0 ? '设备上报' : '平台计算',
      tags: [],
      description: item.description || `${item.name} 用于标准模板中的实时监测与健康判断。`,
      expandedConfig: {
        displayName: item.name,
        valueType: item.dataType,
        reportStrategy: '设备主动上报',
        items: [
          { identifier: 'accessMode', name: '读写类型', dataType: toAccessModeLabel(item.accessMode) },
          { identifier: 'unit', name: '单位', dataType: item.unit || '-' },
        ],
        thresholds: [
          { metric: '阈值范围', operator: 'range', value: '15 至 95', action: '超出范围后触发阈值告警，并进入设备健康观察。' },
        ],
        deviationConfig: {
          normalRange: '15 ~ 85',
          warningRange: '10 ~ 15 或 85 ~ 90',
          alarmRange: '< 10 或 > 90',
          description: '按最近 7 天基线与当前采样值比较，超出正常范围时进入设备健康的数据偏离判断。',
          suggestion: '优先检查传感器精度、采集环境变化和设备安装状态，再结合维修知识库定位原因。',
        },
      },
    })),
    events: template.thingModel.events.map((item) => ({
      id: item.id,
      name: item.name,
      identifier: item.identifier,
      dataType: item.dataType,
      level: item.level || 'info',
      description: item.description || `${item.name} 用于描述设备运行过程中的状态变化。`,
      outputs: (item.params || []).map((param) => ({
        identifier: param.identifier,
        name: param.name,
        dataType: param.dataType,
      })),
      expandedConfig: {
        displayName: item.name,
        valueType: item.dataType,
        reportStrategy: '-',
        items: [
          { identifier: 'level', name: '事件级别', dataType: item.level || 'info' },
        ],
        thresholds: [],
        deviationConfig: {
          normalRange: '-',
          warningRange: '-',
          alarmRange: '-',
          description: '事件不参与数值偏离计算，但会作为设备健康诊断上下文参与关联分析。',
          suggestion: '若事件频繁触发，优先检查触发源属性与现场工况。',
        },
      },
    })),
    functions: template.thingModel.services.map((item) => ({
      id: item.id,
      name: item.name,
      identifier: item.identifier,
      dataType: item.dataType,
      callMode: item.callMode || 'sync',
      description: item.description || `${item.name} 为标准模板内置功能，不支持在项目内调整。`,
      inputs: (item.params || []).map((param) => ({
        identifier: param.identifier,
        name: param.name,
        dataType: param.dataType,
        required: !!param.required,
      })),
      outputs: [
        { identifier: 'result', name: '执行结果', dataType: 'string' },
        { identifier: 'message', name: '返回说明', dataType: 'string' },
      ],
      expandedConfig: {
        displayName: item.name,
        valueType: item.dataType,
        reportStrategy: '平台下发调用',
        items: [
          { identifier: 'callMode', name: '调用方式', dataType: item.callMode || 'sync' },
        ],
        thresholds: [],
        deviationConfig: {
          normalRange: '-',
          warningRange: '-',
          alarmRange: '-',
          description: '功能调用不参与偏离计算，但失败记录会进入设备健康诊断。',
          suggestion: '连续失败时应检查协议链路、设备执行状态和返回报文。',
        },
      },
    })),
    tags: [
      {
        id: `${template.id}:tag:health`,
        name: '健康等级',
        identifier: 'healthLevel',
        dataType: 'enum',
        description: '用于标记设备当前健康等级，支撑设备健康页的筛选与诊断。',
      },
      {
        id: `${template.id}:tag:fault-code`,
        name: '故障码',
        identifier: 'faultCode',
        dataType: 'string',
        description: '记录设备上报或诊断出的故障码，与维修知识库联动检索。',
      },
      {
        id: `${template.id}:tag:deviation`,
        name: '数据偏离状态',
        identifier: 'deviationState',
        dataType: 'enum',
        description: '标记属性是否命中数据偏离阈值，用于设备健康异常判断。',
      },
    ],
  }
}

function buildListResult(query: IotDeviceLibraryQuery): IotDeviceLibraryListResult {
  const tenantId = deriveTenantId(query.projectId)
  const enabledTemplates = IOT2_PRODUCT_TEMPLATE_SEEDS.filter((item) => item.status === 'published')
  const filtered = sortTemplates(enabledTemplates.filter((item) => matchesQuery(item, query)))
  const joinedProducts = readJoinedProducts()
  const page = Math.max(1, query.page || 1)
  const pageSize = Math.max(1, query.pageSize || 12)
  const start = (page - 1) * pageSize
  const pagedItems = filtered.slice(start, start + pageSize)
  return {
    projectId: query.projectId,
    tenantId,
    updatedAt: new Date().toISOString(),
    items: pagedItems.map((item) => toCard(item, joinedProducts, tenantId)),
    total: filtered.length,
    page,
    pageSize,
    filters: toTagOptions(buildIot2ProductTemplateFilterOptions(enabledTemplates)),
  }
}

export function createIotDeviceLibraryMockAdapter(): IotDeviceLibraryAdapter {
  return {
    async listTemplates(query) {
      return ok(buildListResult(query))
    },

    async getTemplate(projectId, templateId) {
      const template = findIot2ProductTemplate(templateId)
      if (!template || template.status !== 'published') {
        return err('NOT_FOUND', '未找到可用的设备模板')
      }
      const tenantId = deriveTenantId(projectId)
      const joinedProducts = readJoinedProducts()
      const joined = joinedProducts.find((item) => item.tenantId === tenantId && item.templateId === templateId)
      const detail: IotDeviceLibraryTemplateDetail = {
        projectId,
        tenantId,
        template,
        joined: !!joined,
        joinedProductName: joined?.productName,
        productCountHint: joined ? '当前项目已基于该模板创建产品' : '当前项目尚未加入该模板',
        marketInfo: buildMarketInfo(template),
        documents: {
          accessGuide: {
            title: '设备接入说明',
            summary: '描述真实设备如何按标准模板接入项目。',
            updatedAt: template.updatedAt,
            body: [
              '# 设备接入说明',
              '## 接入前准备',
              '- 确认设备已开启网络与协议服务',
              '- 核对设备 SN、鉴权信息与模板版本一致',
              '## 接入流程',
              '- 在设备库中加入项目并创建产品',
              '- 按模板参数完成设备注册与鉴权配置',
              '- 设备上线后通过设备健康查看接入结果',
            ].join('\n'),
          },
          protocolDoc: {
            title: '协议文档',
            summary: '展示协议包内置的接入约束、主题与报文说明。',
            updatedAt: template.updatedAt,
            body: [
              '# 协议文档',
              `## 协议类型`,
              `- ${template.protocol}`,
              '## 内置约束',
              `- 默认入口：${template.accessPreset.endpoint}`,
              `- Topic 前缀：${template.accessPreset.topicPrefix}`,
              `- 认证方式：${template.authPreset.mode}`,
              '## 报文说明',
              `- 编解码：${template.codecMode}`,
              `- 数据格式：${template.dataFormat}`,
            ].join('\n'),
          },
          maintenanceLibrary: {
            title: '维修知识库',
            summary: '模板保存时会将维修知识与故障码同步到统一知识库，供设备健康详情检索。',
            updatedAt: template.updatedAt,
            knowledgeBaseRef: `kb:${template.id}`,
            body: [
              '# 维修知识库',
              '## 使用方式',
              '- 模板维护时同步维修知识与故障码到统一知识库服务',
              '- 设备健康详情按设备所属模板检索维修建议与处理步骤',
              '## 检索目标',
              '- 异常波动原因',
              '- 常见故障定位建议',
              '- 对应部件的维修流程与安全提醒',
            ].join('\n'),
            faultCodes: [
              {
                code: 'E201',
                level: 'major',
                title: '温度采集偏离基线',
                symptom: '最近 15 分钟采集值持续偏离历史基线 20% 以上。',
                suggestion: '优先检查传感器探头、接线松动与现场环境突变，再结合知识库检索相似案例。',
              },
              {
                code: 'E315',
                level: 'critical',
                title: '通信异常导致数据中断',
                symptom: '设备连续 10 分钟未上报关键属性且心跳丢失。',
                suggestion: '检查网络链路、网关在线状态与设备鉴权配置，必要时执行现场重启。',
              },
            ],
          },
          marketDoc: {
            title: '资源文档',
            summary: '能力市场侧对该模板的资源描述文档。',
            updatedAt: template.updatedAt,
            body: [
              '# 资源文档',
              '## 模板定位',
              '- 该资源为设备库可直接选用的标准设备模板',
              '- 仅展示 enabled / published 的模板版本',
              '## 使用约束',
              '- 同一项目内同一模板只允许加入一次',
              '- 项目内创建的产品应持续继承该标准模板能力',
            ].join('\n'),
          },
        },
        connectionHealthConfig: buildConnectionHealthConfig(template),
        thingModelDefinition: buildThingModelDefinition(template),
      }
      return ok(detail)
    },

    async joinProject(input: IotDeviceLibraryJoinInput) {
      const template = findIot2ProductTemplate(input.templateId)
      if (!template || template.status !== 'published') {
        return err('NOT_FOUND', '未找到可加入项目的设备模板')
      }
      const productName = input.productName.trim()
      if (!productName) return err('VALIDATION_FAILED', '请输入产品名称')

      const joinedProducts = readJoinedProducts()
      const exists = joinedProducts.find((item) => item.tenantId === input.tenantId && item.templateId === input.templateId)
      if (exists) {
        return err('CONFLICT', '当前项目已加入该模板，请勿重复添加')
      }

      const product: IotDeviceLibraryJoinedProduct = {
        id: `product:${input.tenantId}:${input.templateId}`,
        tenantId: input.tenantId,
        templateId: input.templateId,
        productName,
        createdAt: new Date().toISOString(),
      }
      writeJoinedProducts([product, ...joinedProducts])

      const result: IotDeviceLibraryJoinResult = {
        product,
        nextDeviceTarget: `/project/${input.projectId}/iot-user/device?from=library&templateId=${input.templateId}`,
      }
      return ok(result)
    },

    async listParameterOptions(projectId, templateId, fieldKey, values) {
      void projectId
      return ok(buildIot2TemplateParameterOptions(templateId, fieldKey, values))
    },
  }
}

