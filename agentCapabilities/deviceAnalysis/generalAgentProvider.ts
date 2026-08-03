import i18n from '@jetlinks-web-core/locales'
import type {
  GeneralAgentCapabilityProvider,
  GeneralAgentContext,
} from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import {
  IOT_DEVICE_ANALYSIS_CATEGORY,
  IOT_DEVICE_ANALYSIS_PROVIDER_ID,
  IOT_DEVICE_MENU_ANCHORS,
} from './constants'
import { createDeviceAnalysisTools } from './tools'

const findMenu = (context: GeneralAgentContext, anchors: readonly string[]) => (
  anchors.map(anchor => context.findMenu(anchor)).find(Boolean)
)

export const iotDeviceAnalysisGeneralAgentProvider: GeneralAgentCapabilityProvider = {
  id: IOT_DEVICE_ANALYSIS_PROVIDER_ID,
  order: 10,
  getCapabilities: (context) => {
    const listMenu = findMenu(context, IOT_DEVICE_MENU_ANCHORS.list)
    if (!listMenu) return []
    const healthMenu = findMenu(context, IOT_DEVICE_MENU_ANCHORS.health)
    const overviewMenu = findMenu(context, IOT_DEVICE_MENU_ANCHORS.overview)
    return [
      {
        id: 'device:analysis',
        name: i18n.global.t('IotGeneralAgent.capabilities.analysis.name'),
        description: i18n.global.t('IotGeneralAgent.capabilities.analysis.description'),
        kind: 'tool',
        category: IOT_DEVICE_ANALYSIS_CATEGORY,
        menuCode: listMenu.code,
        keywords: ['设备', '物联', '在线率', '消息量', '上报量', '属性', '物模型', 'device', 'iot', 'uplink'],
        metadata: { promptExamples: [i18n.global.t('IotGeneralAgent.prompts.overview')] },
      },
      {
        id: 'device:instance-detail',
        name: i18n.global.t('IotGeneralAgent.capabilities.detail.name'),
        description: i18n.global.t('IotGeneralAgent.capabilities.detail.description'),
        kind: 'feature',
        category: IOT_DEVICE_ANALYSIS_CATEGORY,
        menuCode: listMenu.code,
        keywords: ['设备详情', '设备状态', '设备日志', '属性数据', 'device detail'],
        metadata: {
          promptExamples: [i18n.global.t('IotGeneralAgent.prompts.openDetail')],
          navigationMode: 'resolve-subject-first',
          continuation: {
            targetName: i18n.global.t('IotGeneralAgent.capabilities.detail.name'),
            targetClientId: 'deviceDetailChat',
            targetMenuCode: listMenu.code,
            promptPolicy: 'prefill-only',
            blockingFacts: ['deviceId'],
          },
        },
      },
      ...(overviewMenu ? [{
        id: 'device:overview',
        name: overviewMenu.title,
        description: i18n.global.t('IotGeneralAgent.capabilities.overview.description'),
        kind: 'feature' as const,
        category: IOT_DEVICE_ANALYSIS_CATEGORY,
        menuCode: overviewMenu.code,
        keywords: ['设备总览', '在线率', '设备数量'],
      }] : []),
      ...(healthMenu ? [{
        id: 'device:health',
        name: healthMenu.title,
        description: i18n.global.t('IotGeneralAgent.capabilities.health.description'),
        kind: 'feature' as const,
        category: IOT_DEVICE_ANALYSIS_CATEGORY,
        menuCode: healthMenu.code,
        keywords: ['设备健康', '离线频繁', '数据偏离'],
      }] : []),
    ]
  },
  getClientTools: context => findMenu(context, IOT_DEVICE_MENU_ANCHORS.list) ? createDeviceAnalysisTools() : [],
  getWorkflowGuides: context => findMenu(context, IOT_DEVICE_MENU_ANCHORS.list) ? [
    {
      id: 'device-runtime-analysis',
      title: i18n.global.t('IotGeneralAgent.workflows.overview.title'),
      when: i18n.global.t('IotGeneralAgent.workflows.overview.when'),
      steps: [
        { capability: 'asset.device.state.aggregate', evidence: 'device-state-summary', required: true },
        { capability: 'asset.device.online-rate.aggregate', evidence: 'device-online-rate-series', required: false },
        { capability: 'asset.device.message.aggregate', evidence: 'device-message-series', required: false },
      ],
      output: i18n.global.t('IotGeneralAgent.workflows.output'),
      notes: [i18n.global.t('IotGeneralAgent.workflows.overview.note')],
    },
    {
      id: 'device-property-analysis',
      title: i18n.global.t('IotGeneralAgent.workflows.property.title'),
      when: i18n.global.t('IotGeneralAgent.workflows.property.when'),
      steps: [
        { capability: 'asset.device.search', evidence: 'device-id', required: true },
        { capability: 'subject.schema.read', evidence: 'subject-property-id', required: true },
        { capability: 'subject.property.aggregate', evidence: 'property-aggregate', required: true },
        { capability: 'subject.property.history.read', evidence: 'property-history-records', required: false },
      ],
      output: i18n.global.t('IotGeneralAgent.workflows.output'),
    },
    {
      id: 'device-detail-handoff',
      title: i18n.global.t('IotGeneralAgent.workflows.handoff.title'),
      when: i18n.global.t('IotGeneralAgent.workflows.handoff.when'),
      steps: [{ capability: 'asset.device.search', evidence: 'device-id', required: true }],
      notes: [i18n.global.t('IotGeneralAgent.workflows.handoff.note')],
    },
  ] : [],
  getPromptExamples: context => findMenu(context, IOT_DEVICE_MENU_ANCHORS.list) ? [
    i18n.global.t('IotGeneralAgent.prompts.overview'),
    i18n.global.t('IotGeneralAgent.prompts.offline'),
    i18n.global.t('IotGeneralAgent.prompts.property'),
  ] : [],
}

export default iotDeviceAnalysisGeneralAgentProvider
