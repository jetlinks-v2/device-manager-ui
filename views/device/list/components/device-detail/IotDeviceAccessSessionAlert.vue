<template>
  <a-alert
    v-if="isOffline || isOnline"
    :type="isOffline ? 'warning' : 'success'"
    show-icon
    class="offline-alert"
  >
    <template #message>
      <template v-if="isOffline">
        {{ $t('IotDeviceDetail.accessSession.offlineMessage') }}
        <a-button
          type="link"
          size="small"
          class="session-diagnose-btn"
          @click="diagnoseOpen = true"
        >
          {{ $t('IotDeviceDetail.accessSession.viewInfo') }}
        </a-button>
      </template>
      <template v-else>
        <div class="session-detail">
          <span>{{ $t('IotDeviceDetail.accessSession.online') }}</span>
          <a-spin :spinning="sessionsLoading" class="session-spin" />
          <span v-if="connectionCountHint">，{{ connectionCountHint }}</span>
          <a-button
            v-if="showConnectionsDropdown"
            type="text"
            size="small"
            class="session-conn-switch"
            @click="$emit('toggleConnections')"
          >
            <AIcon :type="connectionExpanded ? 'UpOutlined' : 'DownOutlined'" />
          </a-button>
          <template v-if="displaySession">
            <a-divider type="vertical" />
            <span>{{ $t('IotDeviceDetail.accessSession.connectionAddress') }}{{ displayAddress || '-' }}</span>
            <a-divider type="vertical" />
            <span>{{ $t('IotDeviceDetail.accessSession.transport') }}{{ displaySession.transport || '-' }}</span>
            <a-divider type="vertical" />
            <span>{{ $t('IotDeviceDetail.accessSession.connectTime') }}{{ formatTime(displayConnectTime) || '-' }}</span>
            <a-divider type="vertical" />
            <span>{{ $t('IotDeviceDetail.accessSession.lastCommTime') }}{{ formatTime(displayLastCommTime) || '-' }}</span>
            <template v-if="displayPendingMessages != null">
              <a-divider type="vertical" />
              <span>{{ $t('IotDeviceDetail.accessSession.pendingMessages') }}{{ displayPendingMessages }}</span>
            </template>
          </template>
          <a-tooltip :title="$t('IotDeviceDetail.accessSession.refreshConnection')">
            <a-button
              type="text"
              size="small"
              class="session-refresh-btn"
              @click="$emit('refresh')"
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
            @click="$emit('selectConnection', idx)"
          >
            <span>{{ $t('IotDeviceDetail.trace.connectionIndex', { index: idx + 1 }) }}</span>
            <span>{{ $t('IotDeviceDetail.trace.address', { address: conn.address || '-' }) }}</span>
            <span>{{ $t('IotDeviceDetail.trace.pending', { count: conn.pendingMessages ?? conn.metrics?.pendingMessages ?? '-' }) }}</span>
            <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.readBytes', { value: formatBytes(conn.metrics.readBytes) }) }}</span>
            <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.writeBytes', { value: formatBytes(conn.metrics.writeBytes) }) }}</span>
            <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.droppedMessages', { count: conn.metrics.droppedMessages ?? '-' }) }}</span>
            <span v-if="conn.metrics">{{ $t('IotDeviceDetail.accessSession.connectTime') }}{{ formatTime(conn.metrics.connectTime) || '-' }}</span>
            <span v-if="conn.metrics">{{ $t('IotDeviceDetail.accessSession.lastCommTime') }}{{ formatTime(conn.metrics.lastCommTime) || '-' }}</span>
          </div>
        </div>
      </template>
    </template>
  </a-alert>

  <a-drawer
    v-model:open="diagnoseOpen"
    :width="560"
    :title="$t('IotDeviceDetail.accessSession.connectionDetail')"
    destroy-on-close
    placement="right"
  >
    <a-descriptions
      bordered
      size="small"
      :column="1"
    >
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.deviceId')">{{ device.id }}</a-descriptions-item>
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.deviceName')">{{ device.name || '-' }}</a-descriptions-item>
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.onlineStatus')">{{ isOnline ? $t('IotDeviceDetail.connection.status.online') : $t('IotDeviceDetail.connection.status.offline') }}</a-descriptions-item>
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.accessMode')">{{ accessDetail?.name || device.accessMode || '-' }}</a-descriptions-item>
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.transport')">{{ device.transport || accessDetail?.transport || '-' }}</a-descriptions-item>
      <a-descriptions-item :label="$t('IotDeviceDetail.accessSession.field.protocol')">{{ device.protocol || accessDetail?.protocol || '-' }}</a-descriptions-item>
    </a-descriptions>
  </a-drawer>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { PropType } from 'vue'
import { computed, ref } from 'vue'
import type { IotDevice } from '../../types'
import type { IotDeviceSessionInfo, IotMergedConnectionInfo } from './useIotDeviceAccessSessions'

defineEmits<{
  (e: 'toggleConnections'): void
  (e: 'selectConnection', index: number): void
  (e: 'refresh'): void
}>()

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  accessDetail: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
  sessionsLoading: { type: Boolean, default: false },
  connectionCountHint: { type: String, default: '' },
  showConnectionsDropdown: { type: Boolean, default: false },
  connectionExpanded: { type: Boolean, default: false },
  displaySession: { type: Object as PropType<IotDeviceSessionInfo | null>, default: null },
  displayAddress: { type: String, default: '' },
  displayPendingMessages: { type: [String, Number] as PropType<string | number | null>, default: null },
  displayConnectTime: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
  displayLastCommTime: { type: [String, Number] as PropType<string | number | undefined>, default: undefined },
  connectionList: { type: Array as PropType<IotMergedConnectionInfo[]>, default: () => [] },
  selectedConnectionIndex: { type: Number, default: 0 },
})

const diagnoseOpen = ref(false)
const isOnline = computed(() => props.device.status === 'online')
const isOffline = computed(() => props.device.status !== 'online')

function formatTime(time?: string | number) {
  if (time === undefined || time === null || time === '') return ''
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function formatBytes(value?: string | number) {
  if (value === undefined || value === null || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return String(value)
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
</script>

<style lang="less" scoped>
.offline-alert {
  flex-shrink: 0;

  &.ant-alert-success {
    border-color: var(--ok-line);
    background: color-mix(in srgb, var(--ok-bg) 34%, var(--jet-theme-bg-container));
  }

  &.ant-alert-warning {
    border-color: var(--warn-line);
    background: color-mix(in srgb, var(--warn-bg) 42%, var(--jet-theme-bg-container));
  }

  :deep(.ant-alert) {
    padding: var(--space-1) var(--space-2);
  }

  :deep(.ant-alert-icon) {
    font-size: var(--fs-14);
    margin-inline-end: var(--space-1);
  }

  &.ant-alert-success :deep(.ant-alert-icon) {
    color: var(--ok);
  }

  :deep(.ant-alert-message) {
    width: 100%;
    font-size: var(--fs-14);
    line-height: var(--lh-normal);
    color: var(--jet-theme-text-secondary);
  }
}

.session-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: var(--fs-14);
  line-height: var(--lh-normal);
  color: var(--jet-theme-text-secondary);
}

.session-spin {
  margin: 0 var(--space-1);
}

.session-detail :deep(.ant-divider) {
  border-color: var(--jet-theme-border-secondary);
}

.session-diagnose-btn {
  padding: 0 var(--space-1) !important;
  height: var(--row-h) !important;
  font-size: var(--fs-14) !important;
  line-height: var(--row-h) !important;
}

.session-conn-switch,
.session-refresh-btn {
  margin-left: var(--space-1);
  color: var(--jet-theme-text-secondary);
  width: var(--space-5);
  min-width: var(--space-5);
  height: var(--space-5);
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--space-5);
}

.session-conn-list {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 20rem;
  overflow-y: auto;
  padding-right: var(--space-1);
}

.session-conn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 0.0625rem solid var(--jet-theme-border-secondary);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  cursor: pointer;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  line-height: var(--lh-normal);
}

.session-conn-row--active {
  border-color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}
</style>
