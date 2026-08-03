import { computed, ref, type Ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { onlyMessage } from '@jetlinks-web/utils'
import { iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'

export type IotDeviceConnectionInfo = {
  address?: string
  pendingMessages?: number | string
  metrics?: {
    readBytes?: number | string
    writeBytes?: number | string
    connectTime?: number | string
    lastCommTime?: number | string
    pendingMessages?: number | string
    droppedMessages?: number | string
  }
}

export type IotDeviceSessionInfo = {
  deviceId?: string
  serverId?: string
  address?: string
  connectTime?: number | string
  lastCommTime?: number | string
  transport?: string
  connections?: IotDeviceConnectionInfo[] | null
  id?: string
}

export type IotMergedConnectionInfo = IotDeviceConnectionInfo & {
  serverId?: string
  session: IotDeviceSessionInfo
}

const SESSION_AUTO_REFRESH_INTERVAL_MS = 1000
const $t = i18n.global.t

export function useIotDeviceAccessSessions(
  deviceId: Ref<string | undefined>,
  isOnline: Ref<boolean>,
) {
  const sessions = ref<IotDeviceSessionInfo[]>([])
  const sessionsLoading = ref(false)
  const sessionsRequesting = ref(false)
  const selectedConnectionIndex = ref(0)
  const connectionExpanded = ref(false)
  let sessionAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null
  let lastSessionAutoRefreshAt = 0

  const activeSession = computed<IotDeviceSessionInfo | null>(() => sessions.value[0] ?? null)
  const connectionList = computed<IotMergedConnectionInfo[]>(() => {
    const list: IotMergedConnectionInfo[] = []
    for (const session of sessions.value) {
      if (!Array.isArray(session.connections) || !session.connections.length) continue
      for (const conn of session.connections) {
        list.push({ ...conn, serverId: session.serverId, session })
      }
    }
    return list
  })
  const showConnectionsDropdown = computed(() => connectionList.value.length > 0)
  const currentConnection = computed<IotMergedConnectionInfo | null>(() => {
    const list = connectionList.value
    if (!list.length) return null
    const idx = Math.min(Math.max(0, selectedConnectionIndex.value), list.length - 1)
    return list[idx] || null
  })
  const displaySession = computed(() => currentConnection.value?.session || activeSession.value)
  const displayAddress = computed(() => currentConnection.value?.address || activeSession.value?.address || '')
  const displayPendingMessages = computed<number | string | null>(() => {
    const fromConn = currentConnection.value?.pendingMessages
    if (fromConn !== undefined && fromConn !== null && fromConn !== '') return fromConn
    const fromMetric = currentConnection.value?.metrics?.pendingMessages
    if (fromMetric !== undefined && fromMetric !== null && fromMetric !== '') return fromMetric
    return null
  })
  const displayConnectTime = computed(() => currentConnection.value?.metrics?.connectTime || activeSession.value?.connectTime)
  const displayLastCommTime = computed(() => currentConnection.value?.metrics?.lastCommTime || activeSession.value?.lastCommTime)
  const connectionCountHint = computed(() => {
    if (!sessions.value.length) return ''
    if (connectionList.value.length > 1) return $t('IotDeviceDetail.accessSession.connectionCount', { count: connectionList.value.length })
    if (sessions.value.length > 1) return $t('IotDeviceDetail.accessSession.sessionCount', { count: sessions.value.length })
    return ''
  })

  function selectConnection(idx: number) {
    selectedConnectionIndex.value = idx
  }

  function clearSessions() {
    sessions.value = []
    selectedConnectionIndex.value = 0
    connectionExpanded.value = false
  }

  async function loadSessions(showTip = false, showLoadingMask = true) {
    if (!deviceId.value || sessionsRequesting.value) return
    const expandedBeforeRefresh = connectionExpanded.value
    sessionsRequesting.value = true
    if (showLoadingMask) sessionsLoading.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.getDeviceSessions(deviceId.value)
      if (resp?.status === 200) {
        sessions.value = resp.result || []
        selectedConnectionIndex.value = 0
        const totalConnections = sessions.value.reduce((sum, session) => {
          return sum + (Array.isArray(session.connections) ? session.connections.length : 0)
        }, 0)
        connectionExpanded.value = expandedBeforeRefresh && totalConnections > 0
        if (showTip) onlyMessage($t('IotDeviceDetail.accessSession.refreshSuccess'))
      } else {
        clearSessions()
        if (showTip) onlyMessage($t('IotDeviceDetail.accessSession.refreshFailed'), 'error')
      }
    } catch (error) {
      if (showTip) onlyMessage($t('IotDeviceDetail.accessSession.refreshFailed'), 'error')
      throw error
    } finally {
      sessionsRequesting.value = false
      if (showLoadingMask) sessionsLoading.value = false
    }
  }

  function stopSessionAutoRefresh() {
    if (sessionAutoRefreshTimer) {
      clearTimeout(sessionAutoRefreshTimer)
      sessionAutoRefreshTimer = null
    }
  }

  function scheduleSessionAutoRefresh() {
    if (!isOnline.value || !deviceId.value) return
    const now = Date.now()
    const remain = SESSION_AUTO_REFRESH_INTERVAL_MS - (now - lastSessionAutoRefreshAt)
    const run = () => {
      if (sessionsRequesting.value) return
      lastSessionAutoRefreshAt = Date.now()
      void loadSessions(false, false)
    }
    if (remain <= 0) {
      run()
      return
    }
    if (!sessionAutoRefreshTimer) {
      sessionAutoRefreshTimer = setTimeout(() => {
        sessionAutoRefreshTimer = null
        run()
      }, remain)
    }
  }

  return {
    sessionsLoading,
    connectionExpanded,
    selectedConnectionIndex,
    connectionList,
    showConnectionsDropdown,
    displaySession,
    displayAddress,
    displayPendingMessages,
    displayConnectTime,
    displayLastCommTime,
    connectionCountHint,
    loadSessions,
    selectConnection,
    scheduleSessionAutoRefresh,
    clearSessions,
    stopSessionAutoRefresh,
  }
}
