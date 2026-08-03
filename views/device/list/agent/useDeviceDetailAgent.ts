import { onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import { useAIStore } from '@jetlinks-web-core/store/ai'
import {
  createAiClientToolRuntime,
  type AiClientToolRuntime,
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getDeviceDetail_api } from '@device-manager-ui/api/device'
import { IOT_DEVICE_DETAIL_AGENT_TABS } from './deviceDetailAgent.constants'
import { createDeviceDetailAgentService } from './deviceDetailAgent.service'
import { createDeviceDetailAgentTools } from './deviceDetailAgent.tools'
import { createDeviceDetailAgentWorkflows } from './deviceDetailAgent.workflows'

export const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(`IotDeviceDetailAgent.${key}`, params || {})
const normalizeText = (value: unknown) => String(value || '').trim()
const isDeviceDetailTab = (value: string): value is typeof IOT_DEVICE_DETAIL_AGENT_TABS[number] => (
  IOT_DEVICE_DETAIL_AGENT_TABS.includes(value as typeof IOT_DEVICE_DETAIL_AGENT_TABS[number])
)

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

export function useDeviceDetailAgent() {
  const route = useRoute()
  const router = useRouter()
  const aiStore = useAIStore()
  let requestVersion = 0
  let activeService: ReturnType<typeof createDeviceDetailAgentService> | undefined
  let activeRuntime: AiClientToolRuntime | undefined
  let unsubscribeRuntime: (() => void) | undefined

  const release = () => {
    unsubscribeRuntime?.()
    unsubscribeRuntime = undefined
    activeRuntime?.dispose()
    activeRuntime = undefined
    activeService?.dispose()
    activeService = undefined
    aiStore.releaseAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID)
  }

  const handleMarkdownLink = ({ href, event }: { href: string; event: MouseEvent }) => {
    const tab = resolveMarkdownTab(href)
    if (!isDeviceDetailTab(tab)) return false
    event.preventDefault()
    void router.replace({
      query: {
        ...route.query,
        tab,
        ...(tab === 'access' ? { sub: 'connection' } : { sub: undefined }),
      },
    })
    return true
  }

  const sync = async (value: unknown) => {
    const version = ++requestVersion
    const deviceId = normalizeText(value)
    release()
    if (!deviceId) return

    // The detail query is the permission boundary; never create a subject or tool closure before it succeeds.
    const device = await getDeviceDetail_api(deviceId).catch(() => null)
    if (version !== requestVersion || !device) return

    const projectId = normalizeText(getProjectIdFromLocation())
    const service = createDeviceDetailAgentService(device)
    activeService = service
    const tools = createDeviceDetailAgentTools(service)
    const runtime = createAiClientToolRuntime(tools, {
      toolsName: t('toolsName'),
      toolsDescription: t('toolsDescription', { device: device.name }),
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
    const tabLinks = IOT_DEVICE_DETAIL_AGENT_TABS
      .map(tab => `[${t(`tabs.${tab}`)}](#tab=${tab})`)
      .join('、')
    const parameters = {
      clientId: DEVICE_DETAIL_AGENT_CLIENT_ID,
      deviceId: device.id,
      deviceName: device.name,
      projectId,
      subjectType: 'device',
      subjectId: device.id,
      subjectName: device.name,
      conversationTitle: t('conversationTitle'),
      clientTools: runtime.clientTools,
      clientToolsVersion: runtime.clientToolsVersion,
      clientToolHandler: runtime.handleClientToolCall,
      clientToolsName: runtime.clientToolsName,
      clientToolsDescription: runtime.clientToolsDescription,
      workflowGuides: createDeviceDetailAgentWorkflows(),
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

    aiStore.prepareAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID, parameters)
    await aiStore.queryAgent(DEVICE_DETAIL_AGENT_CLIENT_ID, parameters)
    // Store-side queryVersion prevents stale requests from overwriting the new device; only dispose this closure here.
    if (version !== requestVersion) service.dispose()
  }

  watch(
    () => route.params.id,
    value => void sync(value),
    { immediate: true },
  )

  onBeforeUnmount(() => {
    requestVersion += 1
    release()
  })
}
