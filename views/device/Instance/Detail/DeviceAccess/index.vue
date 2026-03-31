<template>
  <div class="instance-device-access">
    <a-alert
      v-if="isOffline || isOnline"
      :type="isOffline ? 'warning' : 'success'"
      show-icon
      class="offline-alert"
    >
      <template #message>
        <template v-if="isOffline">
          {{ $t('InstanceDeviceAccess.952800-0') }}
          <a-button
            type="link"
            size="small"
            class="session-diagnose-btn"
            @click="diagnoseOpen = true"
          >
            {{ $t('InstanceDeviceAccess.952800-1') }}
          </a-button>
        </template>
        <template v-else>
          <div class="session-detail">
            <span>设备当前已在线</span>
            <a-spin :spinning="sessionsLoading" style="margin: 0 4px" />
            <span v-if="connectionCountHint">，{{ connectionCountHint }}</span>
            <a-button
              v-if="showConnectionsDropdown"
              type="text"
              size="small"
              class="session-conn-switch"
              @click="connectionExpanded = !connectionExpanded"
            >
              <AIcon :type="connectionExpanded ? 'UpOutlined' : 'DownOutlined'" />
            </a-button>
            <template v-if="displaySession">
              <a-divider type="vertical" />
              <span>连接地址：{{ displayAddress || '-' }}</span>
              <a-divider type="vertical" />
              <span>接入方式：{{ displaySession.transport || '-' }}</span>
              <a-divider type="vertical" />
              <span>连接时间：{{ formatTime(displayConnectTime) || '-' }}</span>
              <a-divider type="vertical" />
              <span>最后通信时间：{{ formatTime(displayLastCommTime) || '-' }}</span>
              <template v-if="displayPendingMessages != null">
                <a-divider type="vertical" />
                <span>待处理消息：{{ displayPendingMessages }}</span>
              </template>
            </template>
            <a-tooltip title="刷新连接信息">
              <a-button
                type="text"
                size="small"
                class="session-refresh-btn"
                @click="loadSessions(true)"
              >
                <AIcon type="ReloadOutlined" />
              </a-button>
            </a-tooltip>
          </div>
          <div
            v-if="showConnectionsDropdown && connectionExpanded"
            class="session-conn-list"
          >
            <div
              v-for="(conn, idx) in connectionList"
              :key="`${conn.address || 'conn'}-${idx}`"
              class="session-conn-row"
              :class="{ 'session-conn-row--active': idx === selectedConnectionIndex }"
              @click="selectConnection(idx)"
            >
              <span>连接{{ idx + 1 }}</span>
              <span>地址：{{ conn.address || '-' }}</span>
              <span>待处理：{{ conn.pendingMessages ?? conn.metrics?.pendingMessages ?? '-' }}</span>
              <span v-if="conn.metrics">读：{{ formatBytes(conn.metrics.readBytes) }}</span>
              <span v-if="conn.metrics">写：{{ formatBytes(conn.metrics.writeBytes) }}</span>
              <span v-if="conn.metrics">丢弃：{{ conn.metrics.droppedMessages ?? '-' }}</span>
              <span v-if="conn.metrics">连接时间：{{ formatTime(conn.metrics.connectTime) || '-' }}</span>
              <span v-if="conn.metrics">最后通信：{{ formatTime(conn.metrics.lastCommTime) || '-' }}</span>
            </div>
          </div>
        </template>
      </template>
    </a-alert>

    <a-tabs
      v-model:activeKey="innerTab"
      class="device-access-tabs"
      :destroy-inactive-tab-pane="false"
    >
      <template #rightExtra>
        <a-space
          v-if="innerTab === 'trace'"
          size="small"
          class="trace-tab-actions"
        >
          <a-popconfirm
            :title="$t('Metadata.index.838029-0')"
            :disabled="traceGroups.length === 0"
            @confirm="onClearTrace"
          >
            <a-button
              size="small"
              :disabled="traceGroups.length === 0"
            >
              <AIcon type="ReloadOutlined" />
              {{ $t('components.Source.418270-2') }}
            </a-button>
          </a-popconfirm>
          <a-button
            type="primary"
            size="small"
            @click="onToggleSubscribe"
          >
            <AIcon :type="isSubscribed ? 'PauseOutlined' : 'PlayCircleOutlined'" />
            {{
              isSubscribed
                ? $t('Apply.installing.6794613-12')
                : $t('Apply.installing.6794613-13')
            }}
          </a-button>
        </a-space>
      </template>
      <a-tab-pane
        key="access"
        class="device-access-tab-pane device-access-tab-pane--access"
        :tab="$t('InstanceDeviceAccess.952800-33')"
      >
        <div class="tab-pane-inner tab-pane-inner--access">
          <InstanceAccessGuide />
        </div>
      </a-tab-pane>
      <a-tab-pane
        key="trace"
        class="device-access-tab-pane device-access-tab-pane--trace"
        :tab="$t('InstanceDeviceAccess.952800-32')"
      >
        <div class="tab-pane-inner tab-pane-inner--trace">
          <TraceChainList
            :trace-groups="traceGroups"
            :device-id="deviceId"
          />
        </div>
      </a-tab-pane>
    </a-tabs>

    <a-drawer
      v-model:open="diagnoseOpen"
      :width="720"
      :title="$t('InstanceDeviceAccess.952800-2')"
      destroy-on-close
      placement="right"
    >
      <Status
        v-if="diagnoseOpen"
        :provider-type="providerType"
      />
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import Status from '../Diagnose/Status/index'
import InstanceAccessGuide from './InstanceAccessGuide.vue'
import TraceChainList from './TraceChainList.vue'
import { useDeviceTraceLog } from './composables/useDeviceTraceLog'
import { useInstanceStore } from '../../../../../store/instance'
import { getDeviceSessions } from '../../../../../api/instance'
import { onlyMessage } from '@jetlinks-web/utils'

const instanceStore = useInstanceStore()

const deviceId = computed(() => instanceStore.current?.id)

const { traceGroups, subscribe, unsubscribe, clear } = useDeviceTraceLog(deviceId)

const isSubscribed = ref(true)
const diagnoseOpen = ref(false)

const isOnline = computed(
  () => instanceStore.current?.state?.value === 'online',
)

const isOffline = computed(
  () => instanceStore.current?.state?.value === 'offline',
)

const innerTab = ref<'access' | 'trace'>(isOnline.value ? 'trace' : 'access')

/** 与后端 DeviceSessionInfo / DeviceConnectionInfo 对齐 */
type DeviceConnectionInfo = {
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

type DeviceSessionInfo = {
  deviceId?: string
  serverId?: string
  address?: string
  connectTime?: number
  lastCommTime?: number
  transport?: string
  connections?: DeviceConnectionInfo[] | null
  id?: string
}

type MergedConnectionInfo = DeviceConnectionInfo & {
  serverId?: string
  session: DeviceSessionInfo
}

const sessions = ref<DeviceSessionInfo[]>([])
/** 仅用于界面提示（手动刷新/显式刷新） */
const sessionsLoading = ref(false)
/** 实际请求中的状态：用于并发保护 */
const sessionsRequesting = ref(false)
/** 当前会话下 connections 多路连接时的选中下标 */
const selectedConnectionIndex = ref(0)
const connectionExpanded = ref(false)

const activeSession = computed<DeviceSessionInfo | null>(() => {
  const list = sessions.value
  if (!list.length) return null
  // 无 connections 时按会话主连接展示；有 connections 时在当前会话内切换。
  return list[0] ?? null
})

const connectionList = computed<MergedConnectionInfo[]>(() => {
  const list: MergedConnectionInfo[] = []
  for (const session of sessions.value) {
    if (Array.isArray(session.connections) && session.connections.length) {
      for (const conn of session.connections) {
        list.push({
          ...conn,
          serverId: session.serverId,
          session,
        })
      }
    }
  }
  return list
})

const hasConnectionsField = computed(() => connectionList.value.length > 0)

const showConnectionsDropdown = computed(
  () => hasConnectionsField.value && connectionList.value.length > 0,
)

const currentConnection = computed<MergedConnectionInfo | null>(() => {
  if (!hasConnectionsField.value) return null
  const list = connectionList.value
  const idx = Math.min(Math.max(0, selectedConnectionIndex.value), list.length - 1)
  return list[idx] || null
})

const selectConnection = (idx: number) => {
  selectedConnectionIndex.value = idx
}

/** 有 connections 时按子连接展示地址；否则用会话级 address */
const displaySession = computed(() => currentConnection.value?.session || activeSession.value)

const displayAddress = computed(() => {
  const s = activeSession.value
  if (!s) return ''
  if (currentConnection.value) return currentConnection.value.address || s.address || ''
  return s.address || ''
})

const displayPendingMessages = computed<number | string | null>(() => {
  if (!currentConnection.value) return null
  const fromConn = currentConnection.value.pendingMessages
  if (fromConn !== undefined && fromConn !== null && fromConn !== '') return fromConn
  const fromMetric = currentConnection.value.metrics?.pendingMessages
  if (fromMetric !== undefined && fromMetric !== null && fromMetric !== '') return fromMetric
  return null
})

const displayConnectTime = computed<number | string | undefined>(() => {
  if (currentConnection.value?.metrics?.connectTime) {
    return currentConnection.value.metrics.connectTime
  }
  return activeSession.value?.connectTime
})

const displayLastCommTime = computed<number | string | undefined>(() => {
  if (currentConnection.value?.metrics?.lastCommTime) {
    return currentConnection.value.metrics.lastCommTime
  }
  return activeSession.value?.lastCommTime
})

const connectionCountHint = computed(() => {
  if (!sessions.value.length) return ''
  if (hasConnectionsField.value) {
    const n = connectionList.value.length
    if (n > 1) return `共 ${n} 个连接`
    return ''
  }
  if (sessions.value.length > 1) {
    return `共 ${sessions.value.length} 个会话`
  }
  return ''
})

const formatTime = (time?: string | number) => {
  if (time === undefined || time === null || time === '') return ''
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const formatBytes = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return String(value)
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const loadSessions = async (showTip = false, showLoadingMask = true) => {
  if (!deviceId.value) return
  // 上一次请求未结束时，直接跳过新的刷新请求
  if (sessionsRequesting.value) return
  const expandedBeforeRefresh = connectionExpanded.value
  sessionsRequesting.value = true
  if (showLoadingMask) {
    sessionsLoading.value = true
  }
  try {
    const resp: any = await getDeviceSessions(deviceId.value)
    if (resp?.status === 200) {
      sessions.value = resp.result || []
      selectedConnectionIndex.value = 0
      const totalConnections = (sessions.value || []).reduce((sum: number, session: DeviceSessionInfo) => {
        const size = Array.isArray(session.connections) ? session.connections.length : 0
        return sum + size
      }, 0)
      connectionExpanded.value = expandedBeforeRefresh && totalConnections > 0
      if (showTip) {
        onlyMessage('连接信息已刷新')
      }
    } else {
      sessions.value = []
      connectionExpanded.value = false
      if (showTip) {
        onlyMessage('连接信息刷新失败', 'error')
      }
    }
  } catch (error) {
    if (showTip) {
      onlyMessage('连接信息刷新失败', 'error')
    }
    throw error
  } finally {
    sessionsRequesting.value = false
    if (showLoadingMask) {
      sessionsLoading.value = false
    }
  }
}

const providerType = computed(() => {
  const provider = instanceStore.current?.accessProvider
  if (provider === 'fixed-media' || provider === 'gb28181-2016') {
    return 'media'
  }
  if (provider === 'OneNet' || provider === 'Ctwing') {
    return 'cloud'
  }
  if (provider === 'modbus-tcp' || provider === 'opc-ua') {
    return 'channel'
  }
  if (provider === 'child-device') {
    return 'child-device'
  }
  return 'network'
})

const onClearTrace = () => {
  clear()
}

const onToggleSubscribe = () => {
  if (isSubscribed.value) {
    unsubscribe()
  } else {
    subscribe()
  }
  isSubscribed.value = !isSubscribed.value
}

const SESSION_AUTO_REFRESH_INTERVAL_MS = 1000
let lastSessionAutoRefreshAt = 0
let sessionAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null

const scheduleSessionAutoRefresh = () => {
  if (!isOnline.value || !deviceId.value) return
  const now = Date.now()
  const remain = SESSION_AUTO_REFRESH_INTERVAL_MS - (now - lastSessionAutoRefreshAt)

  const run = () => {
    // 上一次请求未结束时，不发新的刷新请求
    if (sessionsRequesting.value) return
    lastSessionAutoRefreshAt = Date.now()
    loadSessions(false, false)
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

onMounted(() => {
  if (isOnline.value) {
    innerTab.value = 'trace'
    loadSessions()
  }
  subscribe()
})

watch(
  () => instanceStore.current?.state?.value,
  (val, oldVal) => {
    if (val === oldVal) return
    if (val === 'online') {
      innerTab.value = 'trace'
      loadSessions()
    }
    if (val !== 'online') {
      sessions.value = []
      connectionExpanded.value = false
      if (sessionAutoRefreshTimer) {
        clearTimeout(sessionAutoRefreshTimer)
        sessionAutoRefreshTimer = null
      }
    }
  },
)

watch(
  () => traceGroups.value,
  (groups) => {
    if (!groups?.length) return
    // 通信链路收到数据后，节流刷新 sessions（最大间隔 1 秒）
    scheduleSessionAutoRefresh()
  },
  { deep: true },
)

watch(deviceId, (id, prev) => {
  if (prev === undefined) return
  if (id && id !== prev) {
    clear()
    if (isSubscribed.value) {
      subscribe()
    }
  }
})

onUnmounted(() => {
  if (sessionAutoRefreshTimer) {
    clearTimeout(sessionAutoRefreshTimer)
    sessionAutoRefreshTimer = null
  }
  unsubscribe()
})
</script>

<style lang="less" scoped>
.instance-device-access {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  gap: 12px;
}

.offline-alert {
  flex-shrink: 0;
  :deep(.ant-alert) {
    padding: 6px 10px;
  }

  :deep(.ant-alert-icon) {
    font-size: 13px;
    margin-inline-end: 6px;
  }

  :deep(.ant-alert-message) {
    width: 100%;
    font-size: 12px;
    line-height: 1.45;
  }
}

.device-access-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;

  :deep(.ant-tabs-nav) {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  :deep(.ant-tabs-extra-content) {
    display: flex;
    align-items: center;
  }

  :deep(.ant-tabs-content-holder) {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  :deep(.device-access-tab-pane--access.ant-tabs-tabpane) {
    height: auto;
  }

  :deep(.device-access-tab-pane--trace.ant-tabs-tabpane) {
    height: 100%;
    min-height: 0;
  }
}

.trace-tab-actions {
  flex-shrink: 0;
}

.tab-pane-inner {
  min-height: 360px;
  min-width: 0;
  max-width: 100%;

  &--trace {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &--access {
    overflow-x: hidden;
    overflow-y: visible;
    height: auto;
  }
}

.session-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.65);
}

.session-diagnose-btn {
  padding: 0 4px !important;
  height: 18px !important;
  font-size: 11px !important;
  line-height: 18px !important;
}

.session-conn-switch {
  margin-left: 6px;
  color: rgba(0, 0, 0, 0.55);
  width: 20px;
  min-width: 20px;
  height: 20px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;

  :deep(.anticon) {
    font-size: 11px;
    line-height: 1;
  }
}

.session-refresh-btn {
  margin-left: 4px;
  color: rgba(0, 0, 0, 0.55);
  width: 20px;
  min-width: 20px;
  height: 20px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;

  :deep(.anticon) {
    font-size: 11px;
    line-height: 1;
  }
}


.session-conn-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.session-conn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.72);
  font-size: 12px;
  line-height: 1.5;
}

.session-conn-row--active {
  border-color: #1677ff;
  background: #f0f7ff;
  color: #1677ff;
}
</style>
