import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import { useAIStore } from '@jetlinks-web-core/store/ai'
import {
  createAiClientToolRuntime,
  type AiClientToolRuntime,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import {
  IOT_DEVICE_DETAIL_AGENT_TABS,
} from './deviceDetailAgent.constants'
import { createDeviceDetailAgentService } from './deviceDetailAgent.service'
import { createDeviceDetailAgentTools } from './deviceDetailAgent.tools'
import { createDeviceDetailAgentWorkflows } from './deviceDetailAgent.workflows'
import { DEVICE_DETAIL_AGENT_BUILTIN_PARAMETERS } from './deviceDetailAgent.parameters'
import { isEdgeDiagnosisAccessProvider } from './deviceDetailEdge.shared'
import { resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import { iotDeviceService } from '../services/iotDevice.service'
import type { IotDevice } from '../types'

export const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'
export const DEVICE_AGENT_SUBJECT_TYPE = 'device'

export type DeviceDetailAgentDeviceSource = MaybeRefOrGetter<IotDevice | null | undefined>

export interface UseDeviceDetailAgentOptions {
  device?: DeviceDetailAgentDeviceSource
  deviceId?: MaybeRefOrGetter<string | undefined | null>
  enabled?: MaybeRefOrGetter<boolean>
  tabs?: MaybeRefOrGetter<readonly string[] | undefined>
  defaultTab?: MaybeRefOrGetter<string | undefined>
}

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(`IotDeviceDetailAgent.${key}`, params || {})
const normalizeText = (value: unknown) => String(value || '').trim()

const promptKeysByStatus = {
  online: ['prompts.today', 'prompts.messages', 'prompts.alarm'],
  offline: ['prompts.offline', 'prompts.access', 'prompts.offlineHistory'],
  notActive: ['prompts.activate', 'prompts.access', 'prompts.firstOnline'],
  default: ['prompts.today', 'prompts.traffic', 'prompts.property'],
} as const

const resolvePromptStatus = (value: unknown): keyof typeof promptKeysByStatus => {
  const status = normalizeText(value)
  if (status === 'online' || status === 'offline') return status
  if (status === 'notActive' || status === 'disabled') return 'notActive'
  return 'default'
}

const resolveMarkdownTab = (href: unknown) => {
  const value = normalizeText(href)
  if (value.startsWith('#')) {
    const fragment = value.slice(1)
    const params = new URLSearchParams(fragment.includes('=') ? fragment : `tab=${fragment}`)
    return normalizeText(params.get('tab'))
  }
  if (/^tab:\/\//i.test(value)) return value.replace(/^tab:\/\//i, '').split(/[?#]/)[0]
  return ''
}

export function useDeviceDetailAgent(options?: UseDeviceDetailAgentOptions) {
  const route = useRoute()
  const router = useRouter()
  const aiStore = useAIStore()
  let requestVersion = 0
  let activeDeviceId = ''
  let activeTabsKey = ''
  let activeService: ReturnType<typeof createDeviceDetailAgentService> | undefined
  let activeRuntime: AiClientToolRuntime | undefined
  let unsubscribeRuntime: (() => void) | undefined

  const disposeLocal = () => {
    unsubscribeRuntime?.()
    unsubscribeRuntime = undefined
    activeRuntime?.dispose()
    activeRuntime = undefined
    activeService?.dispose()
    activeService = undefined
    activeDeviceId = ''
    activeTabsKey = ''
  }

  const release = () => {
    disposeLocal()
    aiStore.releaseAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID)
  }

  const prepare = (deviceId: string) => {
    aiStore.prepareAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID, deviceId
      ? {
          deviceId,
          subjectType: DEVICE_AGENT_SUBJECT_TYPE,
          subjectId: deviceId,
        }
      : {})
  }

  const isEnabled = () => {
    if (!options || !('enabled' in options) || options.enabled === undefined) return true
    return toValue(options.enabled) !== false
  }

  const resolveDeviceId = () => {
    const fromOption = options && 'deviceId' in options
      ? normalizeText(toValue(options.deviceId))
      : ''
    if (fromOption) return fromOption
    return normalizeText(route.params.deviceId ?? route.params.id ?? route.params.gatewayId)
  }

  const resolvePageDevice = () => {
    if (!options || !('device' in options)) return undefined
    return toValue(options.device)
  }

  // The embedding page owns its tab surface; route names are not a capability contract.
  const resolveTabs = () => toValue(options?.tabs) ?? IOT_DEVICE_DETAIL_AGENT_TABS
  const resolveDefaultTab = () => normalizeText(toValue(options?.defaultTab)) || resolveTabs()[0] || 'overview'
  const tabsKey = () => JSON.stringify([resolveTabs(), resolveDefaultTab()])

  const handleMarkdownLink = ({ href, event }: { href: string; event: MouseEvent }) => {
    const tab = resolveMarkdownTab(href)
    if (!resolveTabs().includes(tab)) return false
    event.preventDefault()
    void router.replace({
      query: { ...route.query, tab },
    })
    return true
  }

  const queryWithDevice = async (projectId: string, device: IotDevice, version: number) => {
    if (activeDeviceId === device.id && activeTabsKey === tabsKey() && activeRuntime) return

    disposeLocal()
    const tabs = [...resolveTabs()]
    const includeEdge = isEdgeDiagnosisAccessProvider(device.accessProvider)
    const service = createDeviceDetailAgentService(device, {
      tabSurface: {
        tabs,
        defaultTab: resolveDefaultTab(),
        navigate: async (tab) => {
          await router.replace({ query: { ...route.query, tab } })
        },
      },
    })
    activeService = service
    activeDeviceId = device.id
    activeTabsKey = tabsKey()
    const tools = createDeviceDetailAgentTools(service, {
      accessProvider: device.accessProvider,
      tabs,
    })
    const toolsDescription = includeEdge
      ? [
        t('toolsDescription', { device: device.name }),
        i18n.global.t('DeviceDetail.edgeTools.description.supported.0'),
        i18n.global.t('DeviceDetail.edgeTools.description.supported.1'),
        i18n.global.t('DeviceDetail.edgeTools.description.supported.2'),
      ].join('\n')
      : t('toolsDescription', { device: device.name })
    const runtime = createAiClientToolRuntime(tools, {
      toolsName: t('toolsName'),
      toolsDescription,
      getContext: () => ({}),
      resultGuard: {
        maxJsonLength: 64 * 1024,
        maxArrayLength: 100,
        maxObjectKeys: 64,
      },
      riskDefaults: {
        readOnly: true,
        parallelSafe: true,
        needsApproval: false,
      },
    })
    activeRuntime = runtime
    const status = resolvePromptStatus(device.connectionStatus || device.status)
    const tabLinks = tabs
      .map(tab => `[${t(`tabs.${tab}`)}](#tab=${tab})`)
      .join('、')
    const parameters = {
      ...DEVICE_DETAIL_AGENT_BUILTIN_PARAMETERS,
      clientId: DEVICE_DETAIL_AGENT_CLIENT_ID,
      deviceId: device.id,
      deviceName: device.name,
      projectId,
      subjectType: DEVICE_AGENT_SUBJECT_TYPE,
      subjectId: device.id,
      subjectName: device.name,
      conversationTitle: t('conversationTitle'),
      clientTools: runtime.clientTools,
      clientToolsVersion: runtime.clientToolsVersion,
      clientToolHandler: runtime.handleClientToolCall,
      clientToolsName: runtime.clientToolsName,
      clientToolsDescription: runtime.clientToolsDescription,
      workflowGuides: createDeviceDetailAgentWorkflows(includeEdge),
      markdownLinkHandler: handleMarkdownLink,
      systemPrompt: [
        t('systemPrompt.subject', { device: device.name }),
        t('systemPrompt.readonly'),
        t('systemPrompt.evidence'),
        t('systemPrompt.delivery'),
        t('systemPrompt.internal'),
        t('systemPrompt.navigation'),
        t('systemPrompt.tabs', { links: tabLinks }),
      ].join('\n'),
      openingStatement: t(`opening.${status}`, { device: device.name }),
      promptExamples: promptKeysByStatus[status].map(key => t(key)),
      bubbleIcon: 'HddOutlined',
      bubbleIconBadge: 'MessageOutlined',
      bubbleClassName: 'ai-float-btn-wrapper--device-agent',
      bubbleTooltip: t('bubbleTooltip', { device: device.name }),
    }

    // Late registry updates refresh the active page-agent snapshot without rebuilding its business service.
    unsubscribeRuntime = runtime.subscribeClientTools(() => {
      if (runtime !== activeRuntime) return
      const active = aiStore.activeClientId === DEVICE_DETAIL_AGENT_CLIENT_ID
        || aiStore.pendingClientId === DEVICE_DETAIL_AGENT_CLIENT_ID
      if (!active) return
      aiStore.parameters = {
        ...aiStore.parameters,
        clientTools: runtime.clientTools,
        clientToolsVersion: runtime.clientToolsVersion,
      }
    })

    await aiStore.queryAgent(DEVICE_DETAIL_AGENT_CLIENT_ID, parameters)
    // Store-side queryVersion prevents stale requests from overwriting the new device; only dispose this closure here.
    if (version !== requestVersion) {
      if (activeService === service) disposeLocal()
      else service.dispose()
    }
  }

  const sync = async () => {
    if (!isEnabled()) {
      requestVersion += 1
      disposeLocal()
      return
    }

    const projectId = normalizeText(resolveIotProjectId(route))
    const deviceId = resolveDeviceId()
    if (!deviceId) {
      requestVersion += 1
      release()
      return
    }

    if (activeDeviceId === deviceId && activeTabsKey === tabsKey() && activeRuntime) return

    const version = ++requestVersion
    prepare(deviceId)
    if (!projectId) return

    const pageDevice = resolvePageDevice()
    if (pageDevice && normalizeText(pageDevice.id) === deviceId) {
      await queryWithDevice(projectId, pageDevice, version)
      return
    }

    if (options && 'device' in options) return

    const result = await iotDeviceService.getDevice(projectId, deviceId).catch(() => null)
    if (version !== requestVersion || !result?.ok || !result.data) return
    await queryWithDevice(projectId, result.data, version)
  }

  watch(
    () => [
      isEnabled(),
      resolveIotProjectId(route),
      resolveDeviceId(),
      normalizeText(resolvePageDevice()?.id),
      tabsKey(),
    ] as const,
    () => void sync(),
    { immediate: true },
  )

  onBeforeUnmount(() => {
    requestVersion += 1
    // Embedded hosts skip store release so a page-level owner can keep deviceDetailChat.
    if (!isEnabled()) {
      disposeLocal()
      return
    }
    release()
  })
}
