import { computed, nextTick, onMounted, onUnmounted, ref, useSlots, watch, type UnwrapRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeviceDetailTabs } from '../../list/hooks/useDeviceDetailTabs'
import { useInstanceStore } from '../../../../store/instance'
import { _deploy, _disconnect, modifyByDeviceId, detail as queryDeviceDetail } from '../../../../api/instance'
import { getBase64ByImg, onlyMessage } from '@jetlinks-web/utils'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import { openEdgeUrl, isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { wsClient } from '@jetlinks-web/core'
import { useRouterParams } from '@jetlinks-web/hooks'
import { EventEmitter } from '@jetlinks-web/utils'
import { useSystemStore, useMenuStore, useAuthStore, useAIStore, useUserStore } from '@jetlinks-web-core/store'
import { device } from '../../../../assets'
import { useI18n } from 'vue-i18n'
import { tabs } from './asyncComponent'
import { useRegistryOptions } from '@jetlinks-web-core/hooks'
import { deviceStateList } from '@device-manager-ui/views/device/data'
import { isApplyDashboard } from '@device-manager-ui/utils/dashboardProject'
import { createDeviceDetailClientToolRuntime } from './clientTools'
import { useDeviceMetadataReferences } from './useDeviceMetadataReferences'
import {
  createEdgeDiagnosisWorkflowGuides,
  buildEdgeDiagnosisClientToolsDescription,
  isEdgeDiagnosisToolId
} from './agentDiagnosisManual'
import { isEdgeDiagnosisAccessProvider } from './edgeDiagnosisTool'
import type {
  AgentConversationMarkdownLinkHandler,
  AgentConversationWorkflowGuide,
} from '@jetlinks-ai-agent-ui/components/AgentConversation/types'

export interface DeviceInstanceDetailOptions { deviceId?: string; contentOnly?: boolean }

/** 旧版设备详情的设备加载、页签导航、订阅及 AI 生命周期，独立于完整页或嵌入视图。 */
export function useDeviceInstanceDetail(options: Readonly<DeviceInstanceDetailOptions>, onChanged?: (deviceId: string) => void) {
  const { t: $t } = useI18n()
  const menuStory = useMenuStore()
  const userStore = useUserStore()
  const { showThreshold } = useSystemStore()
  const route = useRoute()
  const router = useRouter()
  const resolvedDeviceId = computed(() => String(options.deviceId || route.params.id || route.params.deviceId || ''))
  const routerParams = useRouterParams()
  const instanceStore = useInstanceStore()
  const extensionDevice = computed(() => instanceStore.current.id === resolvedDeviceId.value ? instanceStore.current : null)
  const registeredTabs = useDeviceDetailTabs(extensionDevice)
  const extensionTabs = computed(() => registeredTabs.value.filter(tab => !Object.prototype.hasOwnProperty.call(tabs, tab.key)))
  const activeExtension = computed(() => extensionTabs.value.find(tab => tab.key === instanceStore.tabActiveKey))
  const activeBuiltinComponent = computed(() => tabs[instanceStore.tabActiveKey as keyof typeof tabs])
  let requestVersion = 0
  let pageLoadVersion = 0
  let disposed = false
  const detailError = ref('')
  const slots = useSlots()

  const statusMap = new Map()

  statusMap.set('online', 'success')
  statusMap.set('offline', 'error')
  statusMap.set('notActive', 'warning')

  const statusTextMap = new Map()
  statusTextMap.set('online', $t('DashBoard.index.954313-11'))
  statusTextMap.set('offline', $t('DashBoard.index.954313-12'))
  statusTextMap.set('notActive', $t('DashBoard.index.954313-10'))

  const statusRef = ref()
  const componentRef = ref<{ handleRefresh?: () => void | Promise<void> } | null>(null)
  const isEditingName = ref(false)
  const savingName = ref(false)
  const editableName = ref('')
  const nameEditorRef = ref<HTMLElement>()
  const photoPanelVisible = ref(false)
  const photoTempSrc = ref<string | undefined>(undefined)
  const photoFileInputRef = ref<HTMLInputElement | null>(null)
  const avatarError = ref(false)

  const TAG_PREVIEW_COUNT = 3
  const tagsPopoverOpen = ref(false)
  const tagsPanelVisible = ref(false)
  /** 首屏详情未返回前展示鱼骨骨架屏 */
  const detailPageLoading = ref(true)

  /** 详情加载完成前 Tab 项未知：用占位 key + 鱼骨样式代替真实标签 */
  const SKELETON_TAB_COUNT = 12
  const SKELETON_TAB_FIRST_KEY = '__deviceDetailSkTab0'
  const skeletonTabList = Array.from({ length: SKELETON_TAB_COUNT }, (_, i) => ({
    key: `__deviceDetailSkTab${i}`,
    /** 占位，实际由 CSS 显示为闪烁条 */
    tab: '\u00A0'
  }))

  const deviceTags = computed(() => {
    const t = instanceStore.current?.tags
    return Array.isArray(t) && t.length ? t : []
  })

  const avatarSrc = computed(() => {
    if (avatarError.value) return device.deviceCard
    const raw = instanceStore.current?.photoUrl || (instanceStore.current as any)?.devicePhotoUrl
    if (!raw) return device.deviceCard

    // photoUrl 通常保存的是 fileId；当它不是可访问URL/数据串时，转换为可访问地址
    if (typeof raw === 'string' && (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/'))) {
      return raw
    }
    return getFileUrlById(String(raw))
  })

  const visibleTags = computed(() => {
    return deviceTags.value.slice(0, TAG_PREVIEW_COUNT)
  })

  const moreTags = computed(() => {
    if (deviceTags.value.length <= TAG_PREVIEW_COUNT) return []
    return deviceTags.value.slice(TAG_PREVIEW_COUNT)
  })

  const hiddenTagCount = computed(() =>
    Math.max(0, deviceTags.value.length - TAG_PREVIEW_COUNT)
  )

  /** 与实例信息 Tab 中标签展示逻辑一致，便于用户对照 */
  const formatTagValue = (item: Record<string, any>) => {
    let name: string | undefined
    if (item.dataType) {
      let arr = item.dataType?.elements || []
      if (item.dataType?.type === 'boolean') {
        arr = [
          { text: item.dataType.trueText, value: item.dataType.trueValue },
          { text: item.dataType.falseText, value: item.dataType.falseValue }
        ]
      }
      const el = arr?.find((a: any) => a.value === item.value)
      name = el?.text
    }
    return name ?? item.formatValue ?? item.value
  }

  const isTagValueEmpty = (item: Record<string, any>) => {
    const v = formatTagValue(item)
    if (v === undefined || v === null) return true
    if (typeof v === 'string' && v.trim() === '') return true
    return false
  }

  const formatTagLine = (item: Record<string, any>) => {
    const label = item.name || item.key || ''
    if (isTagValueEmpty(item)) {
      return `${label}（${$t('Detail.index.957187-39')}）`
    }
    return `${label}：${formatTagValue(item)}`
  }

  /** hover：仅展示值（空时展示「未设置」），不含标签标识 */
  const formatTagTooltipValueOnly = (item: Record<string, any>) => {
    if (isTagValueEmpty(item)) return $t('Detail.index.957187-39')
    const v = formatTagValue(item)
    if (v !== null && typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const copyClipboardText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onlyMessage($t('Detail.index.957187-36'))
    } catch (e) {
      const input = document.createElement('textarea')
      input.value = text
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.focus()
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      onlyMessage($t('Detail.index.957187-36'))
    }
  }

  const handleCopyTagValue = (item: Record<string, any>) => {
    void copyClipboardText(formatTagTooltipValueOnly(item))
  }

  const handleEditInstance = () => {
    tagsPopoverOpen.value = false
    tagsPanelVisible.value = false
    photoTempSrc.value = undefined
    // 先触发文件选择；真正打开编辑弹窗由选择完成后触发
    photoFileInputRef.value?.click()
  }

  const handlePhotoPanelSaved = async () => {
    photoPanelVisible.value = false
    photoTempSrc.value = undefined
    if (instanceStore.current?.id) {
      avatarError.value = false
      await refreshAfterWrite(instanceStore.current.id)
    }
  }

  const handlePhotoFileSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    // 清空 input，确保同一文件可以重复触发 change
    input.value = ''
    if (!file) return

    getBase64ByImg(file, (base64Url: string) => {
      avatarError.value = false
      photoTempSrc.value = base64Url
      photoPanelVisible.value = true
    })
  }

  const handleTagsPanelSave = async () => {
    tagsPanelVisible.value = false
    if (instanceStore.current?.id) {
      await refreshAfterWrite(instanceStore.current.id)
    }
  }

  const initList = [
    {
      key: 'Info',
      tab: $t('Detail.index.957187-11')
    },
    {
      key: 'Running',
      tab: $t('Detail.index.957187-12')
    },
    {
      key: 'Metadata',
      tab: $t('Detail.index.957187-13')
    },
    {
      key: 'Function',
      tab: $t('Detail.index.957187-14')
    },
    {
      key: 'Log',
      tab: $t('Detail.index.957187-15')
    },
    {
      key: 'DeviceRelationship',
      tab: $t('Detail.index.957187-31')
    },
    {
      key: 'DeviceDocument',
      tab: $t('Detail.index.957187-43')
    }
  ]

  const list = ref([...initList])
  const isRefresh = ref(false)
  const aiStore = useAIStore()
  const permissionStore = useAuthStore()
  const { mergedOptions } = useRegistryOptions({ baseOptions: list, code: 'detail-tabs' })
  const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'
  const DEVICE_AGENT_SUBJECT_TYPE = 'device'
  const DEVICE_DETAIL_AGENT_SYSTEM_PROMPT_LINES = [
    $t('DeviceDetail.agent.systemPrompt.0'),
    $t('DeviceDetail.agent.systemPrompt.1'),
    $t('DeviceDetail.agent.systemPrompt.2'),
    $t('DeviceDetail.agent.systemPrompt.3'),
    $t('DeviceDetail.agent.systemPrompt.4')
  ]
  const deviceDetailClientToolRuntime = createDeviceDetailClientToolRuntime(() => instanceStore.current || {}, $t)
  const deviceDetailClientToolsVersion = ref(deviceDetailClientToolRuntime.clientToolsVersion)
  let unsubscribeDeviceDetailClientTools: () => void = () => undefined
  const deviceMetadataReferences = useDeviceMetadataReferences({
    device: computed(() => instanceStore.current || {}),
    t: $t,
  })

  const DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES: AgentConversationWorkflowGuide[] = [
    {
      id: 'device-today-operation',
      name: $t('DeviceDetail.agentGuides.today.name'),
      description: $t('DeviceDetail.agentGuides.today.description'),
      scenarios: [$t('DeviceDetail.agentGuides.today.scenarios.0'), $t('DeviceDetail.agentGuides.today.scenarios.1'), $t('DeviceDetail.agentGuides.today.scenarios.2'), $t('DeviceDetail.agentGuides.today.scenarios.3'), $t('DeviceDetail.agentGuides.today.scenarios.4')],
      keywords: [$t('DeviceDetail.agentGuides.today.keywords.0'), $t('DeviceDetail.agentGuides.today.keywords.1'), $t('DeviceDetail.agentGuides.today.keywords.2'), $t('DeviceDetail.agentGuides.today.keywords.3'), $t('DeviceDetail.agentGuides.today.keywords.4'), $t('DeviceDetail.agentGuides.today.keywords.5'), $t('DeviceDetail.agentGuides.today.keywords.6')],
      priority: 100,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.today.steps.identify.title'),
          description: $t('DeviceDetail.agentGuides.today.steps.identify.description'),
          capability: 'subject.schema.search',
          evidence: 'subject-property-id',
        },
        {
          title: $t('DeviceDetail.agentGuides.today.steps.alarmRecords.title'),
          tools: ['device_alarm_records_query'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.today') },
        },
        {
          title: $t('DeviceDetail.agentGuides.today.steps.alarmHistory.title'),
          tools: ['device_alarm_history_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.today') },
        },
        {
          title: $t('DeviceDetail.agentGuides.today.steps.onlineOffline.title'),
          tools: ['device_online_offline_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.today'), type: 'both' },
        },
        {
          title: $t('DeviceDetail.agentGuides.today.steps.latestProperties.title'),
          description: $t('DeviceDetail.agentGuides.today.steps.latestProperties.description'),
          capability: 'subject.property.latest',
          evidence: 'property-snapshot',
        },
        {
          title: $t('DeviceDetail.agentGuides.today.steps.trend.title'),
          description: $t('DeviceDetail.agentGuides.today.steps.trend.description'),
          capability: 'subject.property.aggregate',
          evidence: 'property-aggregate',
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.today'), interval: '1h' },
          required: true,
        },
      ],
      output: [$t('DeviceDetail.agentGuides.today.output.0'), $t('DeviceDetail.agentGuides.today.output.1'), $t('DeviceDetail.agentGuides.today.output.2'), $t('DeviceDetail.agentGuides.today.output.3')],
      notes: [$t('DeviceDetail.agentGuides.today.notes.0')],
    },
    {
      id: 'device-offline-diagnosis',
      name: $t('DeviceDetail.agentGuides.offline.name'),
      description: $t('DeviceDetail.agentGuides.offline.description'),
      scenarios: [$t('DeviceDetail.agentGuides.offline.scenarios.0'), $t('DeviceDetail.agentGuides.offline.scenarios.1'), $t('DeviceDetail.agentGuides.offline.scenarios.2'), $t('DeviceDetail.agentGuides.offline.scenarios.3'), $t('DeviceDetail.agentGuides.offline.scenarios.4')],
      keywords: [$t('DeviceDetail.agentGuides.offline.keywords.0'), $t('DeviceDetail.agentGuides.offline.keywords.1'), $t('DeviceDetail.agentGuides.offline.keywords.2'), $t('DeviceDetail.agentGuides.offline.keywords.3'), $t('DeviceDetail.agentGuides.offline.keywords.4'), $t('DeviceDetail.agentGuides.offline.keywords.5')],
      priority: 90,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.offline.steps.access.title'),
          tools: ['device_access_summary'],
        },
        {
          title: $t('DeviceDetail.agentGuides.offline.steps.onlineOffline.title'),
          tools: ['device_online_offline_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.recent24h'), type: 'both' },
        },
        {
          title: $t('DeviceDetail.agentGuides.offline.steps.logs.title'),
          tools: ['device_logs_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.recent24h') },
        },
        {
          title: $t('DeviceDetail.agentGuides.offline.steps.alarms.title'),
          tools: ['device_alarm_records_query', 'device_alarm_history_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.recent24h') },
        },
        {
          title: $t('DeviceDetail.agentGuides.offline.steps.trace.title'),
          tools: ['device_trace_capture'],
          inputs: { action: 'start', seconds: $t('DeviceDetail.agentGuides.inputs.secondsByScenario') },
          tips: [$t('DeviceDetail.agentGuides.offline.steps.trace.tips.0')],
        },
      ],
      output: [$t('DeviceDetail.agentGuides.offline.output.0'), $t('DeviceDetail.agentGuides.offline.output.1'), $t('DeviceDetail.agentGuides.offline.output.2'), $t('DeviceDetail.agentGuides.offline.output.3')],
    },
    {
      id: 'device-trace-diagnosis',
      name: $t('DeviceDetail.agentGuides.trace.name'),
      description: $t('DeviceDetail.agentGuides.trace.description'),
      scenarios: [$t('DeviceDetail.agentGuides.trace.scenarios.0'), $t('DeviceDetail.agentGuides.trace.scenarios.1'), $t('DeviceDetail.agentGuides.trace.scenarios.2'), $t('DeviceDetail.agentGuides.trace.scenarios.3'), $t('DeviceDetail.agentGuides.trace.scenarios.4'), $t('DeviceDetail.agentGuides.trace.scenarios.5'), $t('DeviceDetail.agentGuides.trace.scenarios.6')],
      keywords: [$t('DeviceDetail.agentGuides.trace.keywords.0'), $t('DeviceDetail.agentGuides.trace.keywords.1'), $t('DeviceDetail.agentGuides.trace.keywords.2'), $t('DeviceDetail.agentGuides.trace.keywords.3'), $t('DeviceDetail.agentGuides.trace.keywords.4'), $t('DeviceDetail.agentGuides.trace.keywords.5'), $t('DeviceDetail.agentGuides.trace.keywords.6'), $t('DeviceDetail.agentGuides.trace.keywords.7'), 'trace'],
      priority: 95,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.trace.steps.start.title'),
          description: $t('DeviceDetail.agentGuides.trace.steps.start.description'),
          tools: ['device_trace_capture'],
          inputs: { action: 'start', seconds: $t('DeviceDetail.agentGuides.inputs.secondsByUserScenario'), maxEvents: $t('DeviceDetail.agentGuides.inputs.maxEventsHighFrequency') },
        },
        {
          title: $t('DeviceDetail.agentGuides.trace.steps.feedback.title'),
          description: $t('DeviceDetail.agentGuides.trace.steps.feedback.description'),
          tools: ['device_function_invoke', 'device_access_summary'],
        },
        {
          title: $t('DeviceDetail.agentGuides.trace.steps.summary.title'),
          description: $t('DeviceDetail.agentGuides.trace.steps.summary.description'),
          tools: ['device_trace_capture'],
          inputs: { action: 'stop', taskId: $t('DeviceDetail.agentGuides.inputs.startTaskId') },
        },
      ],
      output: [$t('DeviceDetail.agentGuides.trace.output.0'), $t('DeviceDetail.agentGuides.trace.output.1'), $t('DeviceDetail.agentGuides.trace.output.2'), $t('DeviceDetail.agentGuides.trace.output.3'), $t('DeviceDetail.agentGuides.trace.output.4')],
      notes: [$t('DeviceDetail.agentGuides.trace.notes.0'), $t('DeviceDetail.agentGuides.trace.notes.1')],
    },
    {
      id: 'device-bring-online',
      name: $t('DeviceDetail.agentGuides.bringOnline.name'),
      description: $t('DeviceDetail.agentGuides.bringOnline.description'),
      scenarios: [$t('DeviceDetail.agentGuides.bringOnline.scenarios.0'), $t('DeviceDetail.agentGuides.bringOnline.scenarios.1'), $t('DeviceDetail.agentGuides.bringOnline.scenarios.2'), $t('DeviceDetail.agentGuides.bringOnline.scenarios.3'), $t('DeviceDetail.agentGuides.bringOnline.scenarios.4')],
      keywords: [$t('DeviceDetail.agentGuides.bringOnline.keywords.0'), $t('DeviceDetail.agentGuides.bringOnline.keywords.1'), $t('DeviceDetail.agentGuides.bringOnline.keywords.2'), $t('DeviceDetail.agentGuides.bringOnline.keywords.3'), $t('DeviceDetail.agentGuides.bringOnline.keywords.4'), $t('DeviceDetail.agentGuides.bringOnline.keywords.5')],
      priority: 80,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.bringOnline.steps.access.title'),
          tools: ['device_access_summary'],
        },
        {
          title: $t('DeviceDetail.agentGuides.bringOnline.steps.docs.title'),
          tools: ['device_documents_query', 'device_document_reference'],
        },
        {
          title: $t('DeviceDetail.agentGuides.bringOnline.steps.evidence.title'),
          tools: ['device_online_offline_summary', 'device_logs_summary'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.recent24h') },
        },
      ],
      output: [$t('DeviceDetail.agentGuides.bringOnline.output.0'), $t('DeviceDetail.agentGuides.bringOnline.output.1'), $t('DeviceDetail.agentGuides.bringOnline.output.2')],
    },
    {
      id: 'device-property-trend',
      name: $t('DeviceDetail.agentGuides.propertyTrend.name'),
      description: $t('DeviceDetail.agentGuides.propertyTrend.description'),
      scenarios: [$t('DeviceDetail.agentGuides.propertyTrend.scenarios.0'), $t('DeviceDetail.agentGuides.propertyTrend.scenarios.1'), $t('DeviceDetail.agentGuides.propertyTrend.scenarios.2'), $t('DeviceDetail.agentGuides.propertyTrend.scenarios.3')],
      keywords: [$t('DeviceDetail.agentGuides.propertyTrend.keywords.0'), $t('DeviceDetail.agentGuides.propertyTrend.keywords.1'), $t('DeviceDetail.agentGuides.propertyTrend.keywords.2'), $t('DeviceDetail.agentGuides.propertyTrend.keywords.3'), $t('DeviceDetail.agentGuides.propertyTrend.keywords.4'), $t('DeviceDetail.agentGuides.propertyTrend.keywords.5')],
      priority: 70,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.propertyTrend.steps.identify.title'),
          capability: 'subject.schema.search',
          evidence: 'subject-property-id',
        },
        {
          title: $t('DeviceDetail.agentGuides.propertyTrend.steps.latest.title'),
          capability: 'subject.property.latest',
          evidence: 'property-snapshot',
        },
        {
          title: $t('DeviceDetail.agentGuides.propertyTrend.steps.aggregate.title'),
          description: $t('DeviceDetail.agentGuides.propertyTrend.steps.aggregate.description'),
          capability: 'subject.property.aggregate',
          evidence: 'property-aggregate',
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.userTimeRangeOrToday') },
          required: true,
        },
      ],
      output: [$t('DeviceDetail.agentGuides.propertyTrend.output.0'), $t('DeviceDetail.agentGuides.propertyTrend.output.1'), $t('DeviceDetail.agentGuides.propertyTrend.output.2'), $t('DeviceDetail.agentGuides.propertyTrend.output.3')],
    },
    {
      id: 'device-alarm-diagnosis',
      name: $t('DeviceDetail.agentGuides.alarm.name'),
      description: $t('DeviceDetail.agentGuides.alarm.description'),
      scenarios: [$t('DeviceDetail.agentGuides.alarm.scenarios.0'), $t('DeviceDetail.agentGuides.alarm.scenarios.1'), $t('DeviceDetail.agentGuides.alarm.scenarios.2'), $t('DeviceDetail.agentGuides.alarm.scenarios.3'), $t('DeviceDetail.agentGuides.alarm.scenarios.4'), $t('DeviceDetail.agentGuides.alarm.scenarios.5'), $t('DeviceDetail.agentGuides.alarm.scenarios.6')],
      keywords: [$t('DeviceDetail.agentGuides.alarm.keywords.0'), $t('DeviceDetail.agentGuides.alarm.keywords.1'), $t('DeviceDetail.agentGuides.alarm.keywords.2'), $t('DeviceDetail.agentGuides.alarm.keywords.3'), 'warning'],
      priority: 75,
      steps: [
        {
          title: $t('DeviceDetail.agentGuides.alarm.steps.records.title'),
          tools: ['device_alarm_records_query'],
          inputs: { timeRange: $t('DeviceDetail.agentGuides.inputs.userTimeRangeOrToday') },
        },
        {
          title: $t('DeviceDetail.agentGuides.alarm.steps.history.title'),
          tools: ['device_alarm_history_summary'],
          inputs: { timeRange: 'same-as-alarm-query' },
        },
        {
          title: $t('DeviceDetail.agentGuides.alarm.steps.evidence.title'),
          tools: ['device_logs_summary', 'device_online_offline_summary'],
          inputs: { timeRange: 'same-as-alarm-query' },
        },
        {
          title: $t('DeviceDetail.agentGuides.alarm.steps.properties.title'),
          tools: ['device_metadata_search', 'device_property_history_summary', 'device_event_history_query'],
        },
      ],
      output: [$t('DeviceDetail.agentGuides.alarm.output.0'), $t('DeviceDetail.agentGuides.alarm.output.1'), $t('DeviceDetail.agentGuides.alarm.output.2'), $t('DeviceDetail.agentGuides.alarm.output.3'), $t('DeviceDetail.agentGuides.alarm.output.4')],
      notes: [$t('DeviceDetail.agentGuides.alarm.notes.0')],
    },
  ]

  const normalizeDeviceAgentTabAliasKey = (value?: string) => (
    String(value || '').trim().replace(/[\s_-]+/g, '').toLowerCase()
  )
  const DEVICE_AGENT_TAB_ALIASES: Record<string, string> = {
    info: 'Info',
    instanceinfo: 'Info',
    detail: 'Info',
    详情: 'Info',
    实例信息: 'Info',
    running: 'Running',
    status: 'Running',
    property: 'Running',
    properties: 'Running',
    运行状态: 'Running',
    属性: 'Running',
    metadata: 'Metadata',
    thingmodel: 'Metadata',
    物模型: 'Metadata',
    function: 'Function',
    functions: 'Function',
    devicefunction: 'Function',
    设备功能: 'Function',
    log: 'Log',
    logs: 'Log',
    日志: 'Log',
    日志管理: 'Log',
    alarm: 'AlarmRecord',
    alarms: 'AlarmRecord',
    alarmrecord: 'AlarmRecord',
    告警: 'AlarmRecord',
    告警记录: 'AlarmRecord',
    deviceaccess: 'Diagnose',
    access: 'Diagnose',
    diagnose: 'Diagnose',
    设备接入: 'Diagnose',
    device_document: 'DeviceDocument',
    devicedocument: 'DeviceDocument',
    document: 'DeviceDocument',
    documents: 'DeviceDocument',
    设备文档: 'DeviceDocument',
    文档: 'DeviceDocument',
    devicerelationship: 'DeviceRelationship',
    relationship: 'DeviceRelationship',
    relation: 'DeviceRelationship',
    设备关系: 'DeviceRelationship',
    invalid: 'Invalid',
    invaliddata: 'Invalid',
    无效数据: 'Invalid',
    threshold: 'Threshold',
    thresholdconfig: 'Threshold',
    阈值配置: 'Threshold',
    dashboard: 'Dashboard',
    仪表盘: 'Dashboard',
    child: 'Child',
    childdevice: 'ChildDevice',
    子设备: 'ChildDevice',
    parsing: 'Parsing',
    数据解析: 'Parsing',
    metadatamap: 'MetadataMap',
    物模型映射: 'MetadataMap',
    terminal: 'Terminal',
    远程调试: 'Terminal',
    visionmodel: 'VisionModel',
    visionmodels: 'VisionModel',
    cvmodel: 'VisionModel',
    cvmodels: 'VisionModel',
    视觉模型: 'VisionModel',
    shadow: 'Shadow',
    设备影子: 'Shadow',
    firmware: 'Firmware',
    远程升级: 'Firmware',
  }
  const DEVICE_AGENT_KNOWN_TABS = new Set(Object.values(DEVICE_AGENT_TAB_ALIASES))

  const isDeviceRemoteFileSupported = () => (
    isEdgeDiagnosisAccessProvider(instanceStore.current?.accessProvider)
  )

  const getDeviceAgentVisibleTabs = () => {
    const source = (orderedOptions as any)?.value || []
    return (Array.isArray(source) ? source : [])
      .filter((item: any) => item?.key && item.key !== 'Info' && (tabs[item.key as keyof typeof tabs] || extensionTabs.value.some(tab => tab.key === item.key)))
      .map((item: any) => ({
        key: String(item.key),
        label: String(item.tab || item.label || item.title || item.key),
      }))
  }

  const isDeviceAgentExistingTab = (tabKey?: string) => {
    if (!tabKey) return false
    return getDeviceAgentVisibleTabs().some((item) => item.key === tabKey)
  }

  const resolveDeviceAgentCurrentTabByLabel = (value?: string) => {
    const normalized = normalizeDeviceAgentTabAliasKey(value)
    if (!normalized) return ''
    return getDeviceAgentVisibleTabs().find((item) => (
      normalizeDeviceAgentTabAliasKey(item.key) === normalized
      || normalizeDeviceAgentTabAliasKey(item.label) === normalized
    ))?.key || ''
  }

  const normalizeDeviceAgentTabKey = (value?: string) => {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const normalized = normalizeDeviceAgentTabAliasKey(raw)
    return DEVICE_AGENT_TAB_ALIASES[normalized] || resolveDeviceAgentCurrentTabByLabel(raw) || raw
  }

  const buildDeviceDetailAgentTabPrompt = () => {
    const visibleTabs = getDeviceAgentVisibleTabs()
    const links = visibleTabs
      .map((item) => `[${item.label}](#tab=${encodeURIComponent(item.key)})`)
      .join('、')

    return links
      ? $t('DeviceDetail.agent.tabPrompt.visible', { links })
      : $t('DeviceDetail.agent.tabPrompt.empty')
  }

  const buildDeviceDetailAgentSystemPrompt = () => {
    const lines = [...DEVICE_DETAIL_AGENT_SYSTEM_PROMPT_LINES]
    if (isDeviceRemoteFileSupported()) {
      lines.splice(lines.length - 1, 0, $t('DeviceDetail.agent.systemPrompt.edgeSupported'))
    } else {
      lines.splice(lines.length - 1, 0, $t('DeviceDetail.agent.systemPrompt.edgeUnsupported'))
    }
    lines.splice(lines.length - 1, 0, buildDeviceDetailAgentTabPrompt())
    return lines.join('\n')
  }

  const getDeviceDetailClientTools = () => {
    const tools = deviceDetailClientToolRuntime.clientTools || []
    const withoutLegacyEdgeRemoteFileTools = tools.filter((tool: any) => {
      const toolId = String(tool?.id || tool?.name || '')
      return !toolId.startsWith('edge_remote_file_')
    })
    if (isDeviceRemoteFileSupported()) return withoutLegacyEdgeRemoteFileTools
    return withoutLegacyEdgeRemoteFileTools.filter((tool: any) => {
      const toolId = String(tool?.id || tool?.name || '')
      return !isEdgeDiagnosisToolId(toolId)
    })
  }

  const getDeviceDetailWorkflowGuides = () => {
    return isDeviceRemoteFileSupported()
      ? [...DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES, ...createEdgeDiagnosisWorkflowGuides($t)]
      : DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES
  }

  const buildDeviceDetailClientToolsDescription = () => {
    const remoteText = isDeviceRemoteFileSupported()
      ? buildEdgeDiagnosisClientToolsDescription(true, $t)
      : buildEdgeDiagnosisClientToolsDescription(false, $t)
    return [
      $t('DeviceDetail.agentTools.description.0'),
      remoteText,
      $t('DeviceDetail.agentTools.description.1'),
      $t('DeviceDetail.agentTools.description.2'),
      $t('DeviceDetail.agentTools.description.3')
    ].join('\n')
  }

  const deviceDetailAgentPromptConfigs = {
    edgeOnline: {
      opening: 'DeviceDetail.agent.opening.edgeOnline',
      prompts: [
        'DeviceDetail.agent.prompt.edge.online.health',
        'DeviceDetail.agent.prompt.edge.online.connection',
        'DeviceDetail.agent.prompt.edge.online.logs'
      ]
    },
    edgeOffline: {
      opening: 'DeviceDetail.agent.opening.edgeOffline',
      prompts: [
        'DeviceDetail.agent.prompt.edge.offline.reason',
        'DeviceDetail.agent.prompt.edge.offline.connection',
        'DeviceDetail.agent.prompt.edge.offline.logs'
      ]
    },
    edgeDefault: {
      opening: 'DeviceDetail.agent.opening.edgeDefault',
      prompts: [
        'DeviceDetail.agent.prompt.edge.default.health',
        'DeviceDetail.agent.prompt.edge.default.backlog',
        'DeviceDetail.agent.prompt.edge.default.logs'
      ]
    },
    online: {
      opening: 'DeviceDetail.agent.opening.online',
      prompts: [
        'DeviceDetail.agent.prompt.online.todayStatus',
        'DeviceDetail.agent.prompt.online.alarm',
        'DeviceDetail.agent.prompt.online.propertyTrend'
      ]
    },
    offline: {
      opening: 'DeviceDetail.agent.opening.offline',
      prompts: [
        'DeviceDetail.agent.prompt.offline.bringOnline',
        'DeviceDetail.agent.prompt.offline.reason',
        'DeviceDetail.agent.prompt.offline.history'
      ]
    },
    notActive: {
      opening: 'DeviceDetail.agent.opening.notActive',
      prompts: [
        'DeviceDetail.agent.prompt.notActive.activate',
        'DeviceDetail.agent.prompt.notActive.accessConfig',
        'DeviceDetail.agent.prompt.notActive.firstOnline'
      ]
    },
    default: {
      opening: 'DeviceDetail.agent.opening.default',
      prompts: [
        'DeviceDetail.agent.prompt.default.status',
        'DeviceDetail.agent.prompt.default.alarm',
        'DeviceDetail.agent.prompt.default.accessConfig'
      ]
    }
  } as const

  const getDeviceDetailAgentPromptConfig = () => {
    const state = String(instanceStore.current?.state?.value || '')
    if (isDeviceRemoteFileSupported()) {
      if (state === 'online') return deviceDetailAgentPromptConfigs.edgeOnline
      if (state === 'offline') return deviceDetailAgentPromptConfigs.edgeOffline
      return deviceDetailAgentPromptConfigs.edgeDefault
    }
    if (state === 'online' || state === 'offline' || state === 'notActive') {
      return deviceDetailAgentPromptConfigs[state]
    }
    return deviceDetailAgentPromptConfigs.default
  }

  const buildDeviceDetailAgentOpeningStatement = () => {
    return $t(getDeviceDetailAgentPromptConfig().opening)
  }

  const buildDeviceDetailAgentPromptExamples = () => {
    return getDeviceDetailAgentPromptConfig().prompts.map((key) => $t(key))
  }

  const buildDeviceDetailAgentParameters = () => {
    const deviceId = instanceStore.current?.id
    if (!deviceId) return undefined

    const deviceName = instanceStore.current?.name
    return {
      deviceId,
      subjectType: DEVICE_AGENT_SUBJECT_TYPE,
      subjectId: deviceId,
      clientTools: getDeviceDetailClientTools(),
      clientToolsVersion: deviceDetailClientToolsVersion.value,
      clientToolHandler: deviceDetailClientToolRuntime.handleClientToolCall,
      clientToolsName: deviceDetailClientToolRuntime.clientToolsName,
      clientToolsDescription: buildDeviceDetailClientToolsDescription(),
      workflowGuides: getDeviceDetailWorkflowGuides(),
      referenceProviders: deviceMetadataReferences.referenceProviders.value,
      composerAddActions: deviceMetadataReferences.composerAddActions.value,
      markdownLinkHandler: handleDeviceAgentMarkdownLink,
      systemPrompt: buildDeviceDetailAgentSystemPrompt(),
      openingStatement: buildDeviceDetailAgentOpeningStatement(),
      promptExamples: buildDeviceDetailAgentPromptExamples(),
      conversationTitle: $t('DeviceDetail.agent.conversationTitle'),
      bubbleIcon: 'HddOutlined',
      bubbleIconBadge: 'MessageOutlined',
      bubbleClassName: 'ai-float-btn-wrapper--device-agent',
      bubbleTooltip: $t('DeviceDetail.agent.bubbleTooltip'),
      ...(deviceName ? { deviceName, subjectName: deviceName } : {})
    }
  }

  const prepareDeviceDetailAgent = (deviceId?: unknown) => {
    const id = String(deviceId || '').trim()
    aiStore.prepareAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID, id
      ? {
          deviceId: id,
          subjectType: DEVICE_AGENT_SUBJECT_TYPE,
          subjectId: id
        }
      : {})
  }

  prepareDeviceDetailAgent(resolvedDeviceId.value)

  const resolveDeviceAgentLinkTab = (href: string) => {
    const raw = String(href || '').trim()
    if (!raw) return ''

    if (raw.startsWith('#')) {
      const fragment = raw.slice(1)
      const params = new URLSearchParams(fragment.includes('=') ? fragment : `tab=${fragment}`)
      return normalizeDeviceAgentTabKey(params.get('tab') || params.get('deviceTab') || fragment)
    }

    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw)
        if (url.origin === window.location.origin && url.hash) {
          return resolveDeviceAgentLinkTab(url.hash)
        }
      } catch {
        return ''
      }
    }

    if (/^tab:\/\//i.test(raw)) {
      return normalizeDeviceAgentTabKey(raw.replace(/^tab:\/\//i, '').split(/[?#]/)[0])
    }

    const match = raw.match(/^jetlinks:\/\/device-detail\/tab\/([^?#]+)/i)
    if (match?.[1]) {
      try {
        return normalizeDeviceAgentTabKey(decodeURIComponent(match[1]))
      } catch {
        return normalizeDeviceAgentTabKey(match[1])
      }
    }

    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      const tabKey = normalizeDeviceAgentTabKey(raw)
      if (isDeviceAgentExistingTab(tabKey) || DEVICE_AGENT_KNOWN_TABS.has(tabKey)) {
        return tabKey
      }
    }

    return ''
  }

  const isDeviceAgentTabLink = (href: string) => {
    const raw = String(href || '').trim()
    if (/^tab:\/\//i.test(raw) || /^jetlinks:\/\/device-detail\/tab\//i.test(raw)) {
      return true
    }
    if (!raw.startsWith('#')) {
      const tabKey = normalizeDeviceAgentTabKey(raw)
      return isDeviceAgentExistingTab(tabKey)
    }
    const fragment = raw.slice(1)
    if (fragment.includes('=')) {
      const params = new URLSearchParams(fragment)
      const tabKey = normalizeDeviceAgentTabKey(params.get('tab') || params.get('deviceTab') || '')
      return !!tabKey && isDeviceAgentExistingTab(tabKey)
    }
    const tabKey = normalizeDeviceAgentTabKey(fragment)
    return isDeviceAgentExistingTab(tabKey)
  }

  const handleDeviceAgentMarkdownLink: AgentConversationMarkdownLinkHandler = ({ href, event }) => {
    const targetTab = resolveDeviceAgentLinkTab(href)
    if (!targetTab) return false

    const exists = pageContainerTabList.value.some((item: any) => item?.key === targetTab)
    if (!exists) {
      return isDeviceAgentTabLink(href)
    }

    event.preventDefault()
    if (exists) {
      onTabChange(targetTab)
    }
    return true
  }

  const syncDeviceDetailAgent = () => {
    const parameters = buildDeviceDetailAgentParameters()
    if (!parameters) return
    void aiStore.queryAgent(DEVICE_DETAIL_AGENT_CLIENT_ID, parameters)
      .then(refreshDeviceDetailAgentParameters)
  }

  const refreshDeviceDetailAgentParameters = () => {
    const parameters = buildDeviceDetailAgentParameters()
    if (!parameters || !aiStore.agentList.length) return
    if (aiStore.parameters?.deviceId !== parameters.deviceId) return
    aiStore.parameters = {
      ...aiStore.parameters,
      ...parameters
    }
  }

  unsubscribeDeviceDetailClientTools = deviceDetailClientToolRuntime.subscribeClientTools((version) => {
    deviceDetailClientToolsVersion.value = version
    refreshDeviceDetailAgentParameters()
  })

  const builtinOrderedOptions = computed(() => {
    const source = (mergedOptions as any)?.value || []
    if (!Array.isArray(source) || !source.length) return source

    const infoIdx = source.findIndex((item: any) => item?.key === 'Info')
    if (infoIdx < 0) return source.filter((item: any) => item?.key !== 'Info')

    const preferredOrder = ['DeviceDetail', 'Diagnose', 'DeviceAccess']
    const movableSet = new Set(preferredOrder)
    const movable = source.filter((item: any) => movableSet.has(item?.key))
    if (!movable.length) return source.filter((item: any) => item?.key !== 'Info')

    // 保留原有顺序，同时确保可识别项按优先级插入「实例详情」后
    movable.sort((a: any, b: any) => preferredOrder.indexOf(a?.key) - preferredOrder.indexOf(b?.key))
    const rest = source.filter((item: any) => !movableSet.has(item?.key))
    const nextInfoIdx = rest.findIndex((item: any) => item?.key === 'Info')
    if (nextInfoIdx < 0) return source.filter((item: any) => item?.key !== 'Info')

    const result = [...rest.slice(0, nextInfoIdx + 1), ...movable, ...rest.slice(nextInfoIdx + 1)]

    // 进一步微调：按「运行状态 -> 设备接入 -> 物模型」调整顺序，其余保持相对不变
    const priorityKeys = ['Running', 'Diagnose', 'Metadata']
    const prioritySet = new Set(priorityKeys)

    const map = new Map(result.map((item: any) => [item?.key, item]))
    const priorityItems = priorityKeys
      .map((key) => map.get(key))
      .filter((v) => !!v) as any[]

    if (priorityItems.length <= 1) return result.filter((item: any) => item?.key !== 'Info')

    const anchorIdx = result.findIndex((item: any) => prioritySet.has(item?.key))
    if (anchorIdx < 0) return result.filter((item: any) => item?.key !== 'Info')

    const restWithoutPriority = result.filter((item: any) => !prioritySet.has(item?.key))
    const nextNonPriority = result.slice(anchorIdx + 1).find((item: any) => !prioritySet.has(item?.key))
    const insertIndex = nextNonPriority
      ? restWithoutPriority.findIndex((item: any) => item?.key === nextNonPriority?.key)
      : restWithoutPriority.length

    return [
      ...restWithoutPriority.slice(0, insertIndex),
      ...priorityItems,
      ...restWithoutPriority.slice(insertIndex)
    ].filter((item: any) => item?.key !== 'Info')
  })

  const orderedOptions = computed(() => [
    ...builtinOrderedOptions.value,
    ...extensionTabs.value.map(tab => ({ key: tab.key, tab: tab.label() })),
  ])

  const pageContainerTabList = computed(() =>
    detailPageLoading.value ? skeletonTabList : orderedOptions.value
  )

  const pageContainerTabActiveKey = computed(() =>
    detailPageLoading.value ? SKELETON_TAB_FIRST_KEY : instanceStore.tabActiveKey
  )

  const resolveDefaultTabKey = (requestedTab?: string) => {
    const keys = (orderedOptions.value || [])
      .map((i: any) => i?.key)
      .filter((k: any) => !!k && k !== 'Info')

    if (!keys.length) return 'Running'

    const stateValue = instanceStore.current?.state?.value
    const preferred = stateValue === 'online' ? 'Running' : 'Diagnose'

    const requested = requestedTab && requestedTab !== 'Info' ? normalizeDeviceAgentTabKey(requestedTab) : undefined
    if (requested && keys.includes(requested)) return requested

    if (keys.includes(preferred)) return preferred
    if (keys.includes('Running')) return 'Running'
    return keys[0]
  }

  const _arr = ['agent-device-gateway', 'agent-media-device-gateway']

  const contentStyle = computed(() => {
    // 扩展内容采用自然高度；宿主承担滚动，保证通道表格的末行和分页可达。
    if (activeExtension.value) return { height: '100%', minHeight: '0', padding: '0', overflow: 'auto' } as const
    if (instanceStore.tabActiveKey === 'Dashboard') {
      return {
        height: '100%',
        padding: '0',
        overflow: 'hidden'
      } as any
    }
    return {
      height: '100%',
      padding: '24px',
      overflowY: 'auto'
    } as any
  })

  const getStatus = (id: string) => {
    if (statusRef.value) {
      statusRef.value.unsubscribe()
    }
    statusRef.value = wsClient
      .getWebSocket(`instance-editor-info-status-${id}`, `/dashboard/device/status/change/realTime`, {
        deviceId: id
      })
      .subscribe((message: any) => {
        if (disposed || id !== resolvedDeviceId.value || id !== instanceStore.current?.id) return
        if (message.payload?.value?.type !== instanceStore.current?.state.value) {
          // refreshDevice(id);
          // 调用detail接口无法实时更新状态，所以这里手动更新
          instanceStore.setState({
            value: message.payload?.value?.type,
            text: statusTextMap.get(message.payload?.value?.type) || ''
          })
        }
      })
  }

  const getDetail = () => {
    list.value = [...initList];
    const keys = list.value.map((i) => i.key)
    if (permissionStore.hasPermission('rule-engine/Alarm/Log:view') && showThreshold) {
      list.value.push({
        key: 'AlarmRecord',
        tab: $t('Detail.index.957187-16')
      })
      if (isNoCommunity) {
        list.value.push({
          key: 'Invalid',
          tab: $t('Detail.index.957187-29')
        })
        list.value.push({
          key: 'Threshold',
          tab: $t('Detail.index.957187-42')
        })
      }
    }
    if (permissionStore.hasPermission('iot-card/CardManagement:view') && isNoCommunity) {
      list.value.push({
        key: 'CardManagement',
        tab: $t('Detail.index.957187-17')
      })
    }

    if (instanceStore.current?.features?.some((item) => item.id === 'deviceShadow-manager') && isNoCommunity) {
      list.value.push({
        key: 'Shadow',
        tab: $t('Detail.index.957187-18')
      })
    }
    if (
      permissionStore.hasPermission('device/Firmware:view') &&
      instanceStore.current?.features?.find((item: any) => item?.id === 'supportFirmware') &&
      isNoCommunity
    ) {
      list.value.push({
        key: 'Firmware',
        tab: $t('Detail.index.957187-19')
      })
    }
    if (
      instanceStore.current?.protocol &&
      !['modbus-tcp', 'opc-ua'].includes(instanceStore.current?.protocol) &&
      !keys.includes('Diagnose')
    ) {
      list.value.push({
        key: 'Diagnose',
        tab: $t('Detail.index.957187-20')
      })
    }
    if (
      instanceStore.current?.features?.find((item: any) => item?.id === 'transparentCodec') &&
      !keys.includes('Parsing')
    ) {
      list.value.push({
        key: 'Parsing',
        tab: $t('Detail.index.957187-21')
      })
    }
    if (instanceStore.current?.protocol === 'modbus-tcp' && !keys.includes('Modbus')) {
      list.value.push({
        key: 'Modbus',
        tab: $t('Detail.index.957187-22')
      })
    }
    if (instanceStore.current?.protocol === 'opc-ua' && !keys.includes('OPCUA')) {
      list.value.push({
        key: 'OPCUA',
        tab: $t('Detail.index.957187-22')
      })
    }
    if (instanceStore.current?.protocol === 'collector-gateway' && !keys.includes('GateWay')) {
      list.value.push({
        key: 'GateWay',
        tab: $t('Detail.index.957187-22')
      })
    }
    if (
      instanceStore.current?.deviceType?.value === 'gateway' &&
      !keys.includes('ChildDevice') &&
      !keys.includes('Child')
    ) {
      const providers = ['agent-device-gateway', 'agent-media-device-gateway']
      if (providers.includes(instanceStore.current?.accessProvider!)) {
        list.value.push({
          key: 'Child',
          tab: $t('Detail.index.957187-23')
        })
      } else {
        // 产品类型为网关的情况下才显示此模块
        list.value.push({
          key: 'ChildDevice',
          tab: $t('Detail.index.957187-23')
        })
      }
    }
    if (
      instanceStore.current?.accessProvider === 'edge-child-device' &&
      instanceStore.current?.parentId &&
      !keys.includes('EdgeMap')
    ) {
      list.value.push({
        key: 'EdgeMap',
        tab: $t('Detail.index.957187-24')
      })
    }

    if (
      instanceStore.current?.features?.find((item: any) => item?.id === 'diffMetadataSameProduct') &&
      !keys.includes('MetadataMap')
    ) {
      list.value.push({ key: 'MetadataMap', tab: $t('Detail.index.957187-25') })
    }

    if (_arr.includes(instanceStore.current?.accessProvider || '') && !keys.includes('Terminal')) {
      list.value.push({ key: 'Terminal', tab: $t('Detail.index.957187-26') })
    }
    if (
      _arr.includes(instanceStore.current?.accessProvider || '') &&
      userStore.isAdmin &&
      !keys.includes('VisionModel')
    ) {
      list.value.push({ key: 'VisionModel', tab: $t('Detail.index.957187-44') })
    }

    // 仪表盘

    if (isApplyDashboard() && !list.value.some((i) => i.key === 'Dashboard')) {
      list.value.push({ key: 'Dashboard', tab: $t('Detail.index.957187-32') })
    }
  }

  /** 只允许当前设备的最新请求写入共享实例 store，切设备或卸载时忽略迟到响应。 */
  const refreshDevice = async (id: string): Promise<boolean> => {
    if (!id || disposed || id !== resolvedDeviceId.value) return false
    const version = ++requestVersion
    try {
      const response = await queryDeviceDetail(id)
      if (disposed || version !== requestVersion || id !== resolvedDeviceId.value) return false
      if (response.status !== 200 || !response.result) throw new Error($t('DeviceInstanceDataCapability.error.loadFailed'))
      instanceStore.setCurrent(response.result)
      return true
    } catch (reason) {
      if (disposed || version !== requestVersion || id !== resolvedDeviceId.value) return false
      throw reason
    }
  }

  /** 显式写入后才通知外层摘要刷新；初始化和外部 refresh 不回传，防止循环刷新。 */
  const refreshAfterWrite = async (id: string): Promise<void> => {
    if (await refreshDevice(id)) onChanged?.(id)
  }

  const getDetailFn = async () => {
    const id = resolvedDeviceId.value
    const version = ++pageLoadVersion
    detailPageLoading.value = true
    detailError.value = ''
    statusRef.value?.unsubscribe()
    instanceStore.$reset()
    instanceStore.current.id = id
    prepareDeviceDetailAgent(id)
    try {
      if (!id) throw new Error($t('IotGeneralAgent.errors.deviceNotFound', { deviceId: id }))
      if (!await refreshDevice(id)) return
      getStatus(id)
      getDetail()
      const requestedTab = typeof route.query.tab === 'string' ? route.query.tab : routerParams.params.value.tab
      instanceStore.tabActiveKey = resolveDefaultTabKey(requestedTab)
      editableName.value = instanceStore.current?.name || ''
      syncDeviceDetailAgent()
    } catch (reason) {
      if (!disposed && version === pageLoadVersion && id === resolvedDeviceId.value) {
        detailError.value = reason instanceof Error ? reason.message : $t('DeviceInstanceDataCapability.error.loadFailed')
      }
    } finally {
      if (!disposed && version === pageLoadVersion && id === resolvedDeviceId.value) detailPageLoading.value = false
    }
  }

  /** 保存原 Metadata/Child 离开确认；确认完成后再写 URL，列表范围参数保持不变。 */
  const onTabChange = (key: string, writeQuery = true) => {
    if (detailPageLoading.value || !orderedOptions.value.some(item => item.key === key)) return
    const deviceId = resolvedDeviceId.value
    const applyTab = () => {
      if (disposed || deviceId !== resolvedDeviceId.value || !orderedOptions.value.some(item => item.key === key)) return
      instanceStore.tabActiveKey = key
      if (writeQuery && route.query.tab !== key) void router.replace({ query: { ...route.query, tab: key } })
    }
    if (instanceStore.tabActiveKey === 'Metadata') EventEmitter.emit('MetadataTabs', applyTab)
    else if (instanceStore.tabActiveKey === 'Child') EventEmitter.emit('ChildTabs', applyTab)
    else applyTab()
  }

  const handleAction = async () => {
    const id = instanceStore.current?.id
    if (!id) return
    const response = await _deploy(id)
    if (response.status === 200) {
      onlyMessage($t('Detail.index.957187-27'))
      await refreshAfterWrite(id)
    }
    return response
  }

  const handleDisconnect = async () => {
    const id = instanceStore.current?.id
    if (!id) return
    const response = await _disconnect(id)
    if (response.status === 200) {
      onlyMessage($t('Detail.index.957187-27'))
      await refreshAfterWrite(id)
    }
    return response
  }

  const handleRefresh = async () => {
    if (detailPageLoading.value || detailError.value) { await getDetailFn(); return }
    if (!await refreshDevice(resolvedDeviceId.value)) return
    getDetail()
    if (activeExtension.value || instanceStore.tabActiveKey === 'Child') await componentRef.value?.handleRefresh?.()
    onlyMessage($t('Detail.index.957187-28'))
  }

  const jumpProduct = () => {
    menuStory.jumpPage('device/Product/Detail', {
      params: {
        id: instanceStore.current?.productId
      }
    })
  }

  const handleEditName = () => {
    editableName.value = instanceStore.current?.name || ''
    isEditingName.value = true
    nextTick(() => {
      if (nameEditorRef.value) {
        nameEditorRef.value.innerText = editableName.value
        nameEditorRef.value.focus()
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(nameEditorRef.value)
        range.collapse(false)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    })
  }

  const onNameInput = (e: Event) => {
    editableName.value = ((e.target as HTMLElement)?.innerText || '').replace(/\n/g, '')
  }

  const handleCopyId = async () => {
    const id = instanceStore.current?.id
    if (!id) return
    await copyClipboardText(id)
  }

  const handleSaveName = async () => {
    const id = instanceStore.current?.id
    if (!id) return
    const nextName = (editableName.value || '').trim()
    if (!nextName) {
      onlyMessage($t('Save.index.902471-7'), 'error')
      return
    }
    if (nextName.length > 64) {
      onlyMessage($t('Save.index.902471-3'), 'error')
      return
    }
    if (nextName === instanceStore.current?.name) {
      isEditingName.value = false
      return
    }

    savingName.value = true
    const resp = await modifyByDeviceId(id, {
      name: nextName
    }).finally(() => {
      savingName.value = false
    })

    if (resp.success) {
      isEditingName.value = false
      onlyMessage($t('Save.index.902471-16'))
      await refreshAfterWrite(id)
    }
  }

  const onClick = async () => {
    await openEdgeUrl(instanceStore.current.id)
  }

  onMounted(() => { void getDetailFn() })

  watch(resolvedDeviceId, (id, previous) => { if (id !== previous) void getDetailFn() })

  // URL 深链在设备和异步扩展就绪后恢复；普通设备会过滤不适用的通道页签。
  watch([() => route.query.tab, orderedOptions, detailPageLoading], () => {
    if (detailPageLoading.value || detailError.value) return
    const requested = typeof route.query.tab === 'string' ? route.query.tab : routerParams.params.value.tab
    const next = resolveDefaultTabKey(requested)
    if (next !== instanceStore.tabActiveKey) onTabChange(next, false)
  })

  watch(
    () => instanceStore.current?.id,
    () => {
      isEditingName.value = false
      editableName.value = instanceStore.current?.name || ''
      tagsPopoverOpen.value = false
      tagsPanelVisible.value = false
      avatarError.value = false
    }
  )

  watch(
    () => [
      instanceStore.current?.id,
      instanceStore.current?.name,
      instanceStore.current?.state?.value,
      instanceStore.current?.accessProvider,
      getDeviceAgentVisibleTabs().map((item) => `${item.key}:${item.label}`).join('|')
    ],
    () => {
      refreshDeviceDetailAgentParameters()
    },
    { flush: 'post' }
  )

  onUnmounted(() => {
    disposed = true
    requestVersion += 1
    pageLoadVersion += 1
    unsubscribeDeviceDetailClientTools()
    deviceDetailClientToolRuntime.dispose()
    instanceStore.current = {} as any
    statusRef.value && statusRef.value.unsubscribe()
    aiStore.releaseAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID)
  })

  return {
    $t,
    userStore,
    instanceStore,
    slots,
    statusMap,
    componentRef,
    isEditingName,
    savingName,
    nameEditorRef,
    photoPanelVisible,
    photoTempSrc,
    photoFileInputRef,
    avatarError,
    TAG_PREVIEW_COUNT,
    tagsPopoverOpen,
    tagsPanelVisible,
    detailPageLoading,
    deviceTags,
    avatarSrc,
    visibleTags,
    moreTags,
    isTagValueEmpty,
    formatTagLine,
    formatTagTooltipValueOnly,
    handleCopyTagValue,
    handleEditInstance,
    handlePhotoPanelSaved,
    handlePhotoFileSelected,
    handleTagsPanelSave,
    isRefresh,
    permissionStore,
    pageContainerTabList,
    pageContainerTabActiveKey,
    _arr,
    contentStyle,
    onTabChange,
    handleAction,
    handleDisconnect,
    handleRefresh,
    jumpProduct,
    handleEditName,
    onNameInput,
    handleCopyId,
    handleSaveName,
    onClick,
    detailError,
    activeExtension,
    activeBuiltinComponent,
    resolvedDeviceId,
  }
}

export type DeviceInstanceDetailState = UnwrapRef<ReturnType<typeof useDeviceInstanceDetail>>
