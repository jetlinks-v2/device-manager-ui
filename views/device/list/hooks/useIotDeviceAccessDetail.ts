import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import useClipboard from 'vue-clipboard3'
import { marked } from 'marked'
import { onlyMessage } from '@jetlinks-web/utils'

import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'
import { useIotDeviceAccessGuideDocument } from './useIotDeviceAccessGuideDocument'

type AccessAddress = {
  address: string
  health?: number
}

type ConfigProperty = {
  property: string
  name: string
  description?: string
  type?: {
    type?: string
    elements?: Array<{ text: string; value: any }>
    trueText?: string
    trueValue?: any
    falseText?: string
    falseValue?: any
  }
}

type ConfigGroup = {
  name: string
  properties: ConfigProperty[]
}

type PrincipalRecord = {
  id: string
  metadata?: { name?: string; description?: string; type?: string }
  identity?: { type?: string; identifier?: string }
  credential?: {
    type?: string
    content?: {
      token?: string
      username?: string
      password?: string
    }
  }
}

export type IotDeviceAccessDetailProps = {
  device: IotDevice
}

export function useIotDeviceAccessDetail(props: Readonly<IotDeviceAccessDetailProps>) {
  const { t: $t } = useI18n()
  const { toClipboard } = useClipboard()
  const accessDetail = ref<Record<string, any>>({})
  const configView = ref<Record<string, any>>({})
  const deviceConfiguration = ref<Record<string, any>>({})
  const deviceConfigGroups = ref<ConfigGroup[]>([])
  const principalList = ref<PrincipalRecord[]>([])
  const configEditorOpen = ref(false)
  const savingConfig = ref(false)
  const resettingPrincipal = ref(false)
  const configDraft = ref<Record<string, any>>({})
  const {
    accessGuideDocument,
    accessGuideLoadFailed,
    accessGuideLoading,
    loadAccessGuideDocument,
    resetAccessGuideDocument,
  } = useIotDeviceAccessGuideDocument(props)

  const providerDescription = computed(() => accessDetail.value?.providerDetail?.description || '')
  const configGroups = computed<ConfigGroup[]>(() =>
    deviceConfigGroups.value.length ? deviceConfigGroups.value : configView.value?.allConfig || [],
  )
  const addressRows = computed<AccessAddress[]>(() => accessDetail.value?.channelInfo?.addresses || [])

  const principalRows = computed(() => principalList.value.map((item, index) => {
    const credentialType = String(item.credential?.type || '').toLowerCase()
    const fields = [
      {
        label: $t('IotDeviceDetail.connection.field.identifier'),
        value: item.identity?.identifier || '--',
        copyValue: item.identity?.identifier,
        mono: true,
      },
    ]

    if (credentialType === 'token') {
      fields.push({
        label: 'Token',
        value: item.credential?.content?.token || '--',
        copyValue: item.credential?.content?.token,
        sensitive: true,
        mono: true,
      })
    } else if (credentialType === 'password') {
      fields.push({
        label: $t('IotDeviceDetail.accessDetail.username'),
        value: item.credential?.content?.username || '--',
        copyValue: item.credential?.content?.username,
        sensitive: true,
        mono: true,
      })
      fields.push({
        label: $t('IotDeviceDetail.accessDetail.password'),
        value: item.credential?.content?.password || '--',
        copyValue: item.credential?.content?.password,
        sensitive: true,
        mono: true,
      })
    }

    return {
      id: item.id || `${index}`,
      name: item.metadata?.name || $t('IotDeviceDetail.accessDetail.deviceAuth'),
      description: item.metadata?.description || '',
      type: item.credential?.type || item.identity?.type || $t('IotDeviceDetail.accessDetail.defaultAuth'),
      fields,
    }
  }))

  const protocolDocument = computed(() => {
    const raw = configView.value?.document
    if (!raw) return ''
    return marked.parse(String(raw)) as string
  })

  const connectionRows = computed(() => {
    const session = accessDetail.value?.sessionInfo || {}
    const addresses = addressRows.value.map((item) => item.address).join(' / ')
    return [
      { label: $t('IotDeviceDetail.connection.field.address'), value: addresses || accessDetail.value?.channelInfo?.address || '--' },
      { label: $t('IotHealthPage.detail.field.protocol'), value: accessDetail.value?.protocol || '--' },
      { label: $t('IotDeviceDetail.accessDetail.transport'), value: accessDetail.value?.transport || '--' },
      { label: $t('IotDeviceDetail.connection.field.gateway'), value: accessDetail.value?.name || '--' },
      { label: $t('IotDeviceDetail.connection.field.lastCommunication'), value: session.lastPingTime || props.device.lastSeen || '--' },
    ]
  })

  function renderConfigValue(item: ConfigProperty) {
    const value = getConfigValue(item)
    if (item.type?.type === 'enum') {
      return item.type.elements?.find((element) => `${element.value}` === `${value}`)?.text || value || '--'
    }
    if (item.type?.type === 'boolean') {
      if (`${value}` === `${item.type.trueValue}`) return item.type.trueText || $t('IotDeviceDetail.common.yes')
      if (`${value}` === `${item.type.falseValue}`) return item.type.falseText || $t('IotDeviceDetail.common.no')
    }
    if (item.type?.type === 'password') {
      return value ? '******' : '--'
    }
    return value || '--'
  }

  function getConfigValue(item: ConfigProperty) {
    return props.device ? deviceConfiguration.value?.[item.property] ?? '' : ''
  }

  function openConfigEditor() {
    configDraft.value = { ...deviceConfiguration.value }
    configEditorOpen.value = true
  }

  async function saveConfig() {
    savingConfig.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.saveDeviceConfig(props.device.id, {
        id: props.device.id,
        configuration: { ...configDraft.value },
      })
      if (resp?.status === 200) {
        onlyMessage($t('IotDeviceDetail.detail.saveSuccess'))
        deviceConfiguration.value = {
          ...configDraft.value,
          ...(resp.result?.configuration || {}),
        }
        configEditorOpen.value = false
        await loadAll()
      }
    } finally {
      savingConfig.value = false
    }
  }

  async function copyText(value?: string) {
    if (!value) return
    await toClipboard(value)
    onlyMessage($t('IotDeviceDetail.accessDetail.copied'))
  }

  function onProtocolDocClick(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof Element)) return
    const el = target.closest('[data-copy], [copy-content]')
    if (!el) return
    event.preventDefault()
    const value = el.getAttribute('data-copy') || el.getAttribute('copy-content') || el.textContent || ''
    void copyText(value.trim())
  }

  async function loadAccessDetail() {
    const productId = props.device.productId || props.device.productKey
    if (!productId) return
    const productResp: any = await iotDeviceDetailRealApi.getProductDetail(productId)
    const accessId = productResp?.result?.accessId
    if (!accessId) return

    const accessResp: any = await iotDeviceDetailRealApi.queryGatewayDetail(accessId)
    const queryAccessResp: any = accessResp?.status === 200 && accessResp.result
      ? accessResp
      : await iotDeviceDetailRealApi.getGatewayDetail(accessId)
    const access = queryAccessResp?.result?.data?.[0] || queryAccessResp?.result
    accessDetail.value = access || {}

    const protocolId = props.device.messageProtocol || access?.protocol || props.device.accessMode
    const transport = props.device.transportProtocol || access?.transport
    if (protocolId && transport) {
      const protocolResp: any = await iotDeviceDetailRealApi.queryProtocolDetail(protocolId, transport)
      configView.value = protocolResp?.result || {}
    } else {
      configView.value = {}
    }
  }

  async function loadDeviceConfiguration() {
    if (!props.device.id) return
    const [detailResp, configResp]: any[] = await Promise.all([
      iotDeviceDetailRealApi.getDeviceDetail(props.device.id),
      iotDeviceDetailRealApi.queryDeviceConfig(props.device.id).catch(() => undefined),
    ])
    deviceConfiguration.value = detailResp?.result?.configuration || {}
    deviceConfigGroups.value = Array.isArray(configResp?.result) ? configResp.result : []
  }

  async function loadPrincipal() {
    if (!props.device.id) return
    const supportResp: any = await iotDeviceDetailRealApi.existsDevicePrincipalSupport()
    if (supportResp?.status === 200 && supportResp?.result) {
      const principalResp: any = await iotDeviceDetailRealApi.getDevicePrincipal(props.device.id)
      principalList.value = principalResp?.result || []
    } else {
      principalList.value = []
    }
  }

  async function resetPrincipal() {
    if (!props.device.id) return
    resettingPrincipal.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.resetDevicePrincipal(props.device.id)
      if (resp?.status === 200) {
        onlyMessage($t('IotDeviceDetail.accessDetail.resetSuccess'))
        await loadPrincipal()
      }
    } finally {
      resettingPrincipal.value = false
    }
  }

  async function loadAll() {
    await Promise.allSettled([
      loadAccessDetail(),
      loadDeviceConfiguration(),
      loadPrincipal(),
      loadAccessGuideDocument(),
    ])
  }

  function resetAccessState() {
    accessDetail.value = {}
    configView.value = {}
    deviceConfiguration.value = {}
    deviceConfigGroups.value = []
    principalList.value = []
    resetAccessGuideDocument()
  }

  return {
    accessDetail,
    accessGuideDocument,
    accessGuideLoadFailed,
    accessGuideLoading,
    addressRows,
    configDraft,
    configEditorOpen,
    configGroups,
    connectionRows,
    copyText,
    loadAll,
    onProtocolDocClick,
    openConfigEditor,
    principalRows,
    protocolDocument,
    providerDescription,
    getConfigValue,
    renderConfigValue,
    resetAccessState,
    resetPrincipal,
    resettingPrincipal,
    saveConfig,
    savingConfig,
  }
}
