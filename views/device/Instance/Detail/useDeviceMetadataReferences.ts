import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  AgentConversationComposerAction,
  AgentConversationReferenceCandidate,
  AgentConversationReferenceProvider,
} from '@jetlinks-ai-agent-ui/components/AgentConversation/types'
import {
  dataTypeText,
  metadataSectionItems,
  METADATA_SECTIONS,
  parseJsonObject,
  propertyAccessText,
} from './clientTools'

type DeviceDetailRecord = Record<string, any>
type MetadataSection = typeof METADATA_SECTIONS[number]

interface Options {
  device: Ref<DeviceDetailRecord | undefined> | ComputedRef<DeviceDetailRecord | undefined>
  t: (key: string, args?: unknown[]) => string
}

const SECTION_ICON_MAP: Record<MetadataSection, string> = {
  properties: 'ProfileOutlined',
  functions: 'ThunderboltOutlined',
  events: 'AlertOutlined',
  tags: 'TagsOutlined',
}

const SECTION_CATEGORY_LABEL_KEY_MAP: Record<MetadataSection, string> = {
  properties: 'DeviceDetail.agent.references.category.properties',
  functions: 'DeviceDetail.agent.references.category.functions',
  events: 'DeviceDetail.agent.references.category.events',
  tags: 'DeviceDetail.agent.references.category.tags',
}

const SECTION_INSERT_KEY_MAP: Record<MetadataSection, string> = {
  properties: 'DeviceDetail.agent.references.propertyInsert',
  functions: 'DeviceDetail.agent.references.functionInsert',
  events: 'DeviceDetail.agent.references.eventInsert',
  tags: 'DeviceDetail.agent.references.tagInsert',
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])

const compactParts = (parts: Array<string | undefined>) => parts.filter((item): item is string => !!item).join(' · ')

const getItemId = (item: Record<string, any>) => normalizeText(item.id || item.key)

const getItemLabel = (item: Record<string, any>) => {
  const id = getItemId(item)
  const name = normalizeText(item.name)
  if (name && id && name !== id) {
    return `${name}(${id})`
  }
  return name || id
}

const getValueTypeText = (valueType: unknown) => (
  valueType === undefined || valueType === null ? '' : dataTypeText(valueType)
)

const formatMetadataFields = (items: unknown) => asArray<Record<string, any>>(items)
  .map((item) => {
    const label = getItemLabel(item)
    const type = getValueTypeText(item.valueType || item.dataType)
    if (!label) return ''
    return type ? `${label}:${type}` : label
  })
  .filter(Boolean)
  .join(', ')

const buildCandidateDescription = (
  section: MetadataSection,
  item: Record<string, any>,
  t: Options['t'],
) => {
  if (section === 'properties') {
    return compactParts([
      getValueTypeText(item.valueType || item.dataType),
      propertyAccessText(item),
      normalizeText(item.description),
    ])
  }

  if (section === 'functions') {
    const inputs = formatMetadataFields(item.inputs)
    const output = getValueTypeText(item.output)
    return compactParts([
      inputs ? t('DeviceDetail.agent.references.inputDescription', [inputs]) : undefined,
      output ? t('DeviceDetail.agent.references.outputDescription', [output]) : undefined,
      normalizeText(item.description),
    ])
  }

  if (section === 'events') {
    const outputs = formatMetadataFields(item.properties)
    return compactParts([
      normalizeText(item.type)
        ? t('DeviceDetail.agent.references.eventTypeDescription', [normalizeText(item.type)])
        : undefined,
      outputs ? t('DeviceDetail.agent.references.outputDescription', [outputs]) : undefined,
      normalizeText(item.description),
    ])
  }

  return compactParts([
    getValueTypeText(item.valueType || item.dataType),
    normalizeText(item.description),
  ])
}

const uniqueCandidates = (items: AgentConversationReferenceCandidate[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}:${item.value}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const createMetadataCandidate = (
  section: MetadataSection,
  item: Record<string, any>,
  t: Options['t'],
): AgentConversationReferenceCandidate | undefined => {
  const label = getItemLabel(item)
  if (!label) {
    return undefined
  }

  const value = getItemId(item) || label
  return {
    type: `device-metadata-${section}`,
    value: `${section}:${value}`,
    label,
    insertText: t(SECTION_INSERT_KEY_MAP[section], [label]),
    description: buildCandidateDescription(section, item, t),
    icon: SECTION_ICON_MAP[section],
    category: section,
    categoryLabel: t(SECTION_CATEGORY_LABEL_KEY_MAP[section]),
  }
}

// 复用设备详情客户端工具的物模型解析与类型展示，避免 @ 引用和工具查询出现两套口径。
export const useDeviceMetadataReferences = (options: Options) => {
  const metadata = computed(() => parseJsonObject(options.device.value?.metadata))

  const metadataCandidates = computed<AgentConversationReferenceCandidate[]>(() => uniqueCandidates(
    METADATA_SECTIONS
      .flatMap((section) => metadataSectionItems(metadata.value, section)
        .map((item: Record<string, any>) => createMetadataCandidate(section, item, options.t))
        .filter((item): item is AgentConversationReferenceCandidate => !!item))
      .slice(0, 120),
  ))

  const referenceProviders = computed<AgentConversationReferenceProvider[]>(() => [
    {
      key: 'device-metadata',
      trigger: '@',
      marker: '@',
      type: 'device-metadata',
      label: options.t('DeviceDetail.agent.references.category.metadata'),
      emptyText: options.t('DeviceDetail.agent.references.emptyMetadata'),
      candidates: metadataCandidates.value,
    },
  ])

  const composerAddActions = computed<AgentConversationComposerAction[]>(() => [
    {
      key: 'device-detail-reference-metadata',
      icon: 'ProfileOutlined',
      label: options.t('DeviceDetail.agent.actions.referenceMetadata'),
      description: options.t('DeviceDetail.agent.actions.referenceMetadataDesc'),
      category: 'page',
      categoryLabel: options.t('DeviceDetail.agent.actions.category.page'),
      referenceTrigger: '@',
      referenceProviderKey: 'device-metadata',
      visible: metadataCandidates.value.length > 0,
    },
  ])

  return {
    referenceProviders,
    composerAddActions,
  }
}
