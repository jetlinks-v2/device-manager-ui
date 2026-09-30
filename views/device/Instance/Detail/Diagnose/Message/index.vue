<template>
  <div class="communication-trace">
    <div class="communication-trace__toolbar">
      <div class="communication-trace__title">
        <span>{{ $t('InstanceDeviceAccess.952800-32') }}</span>
        <a-badge
          :count="displayedTraceTotal"
          :overflow-count="999"
          :show-zero="true"
          :number-style="{
            minWidth: '18px',
            height: '18px',
            lineHeight: '18px',
            padding: '0 5px',
            fontSize: '11px',
            borderRadius: '9px',
            boxShadow: 'none',
          }"
        />
      </div>
      <a-space size="small" class="trace-tab-actions">
        <a-popconfirm
          :title="$t('Metadata.index.838029-0')"
          :disabled="traceGroups.length === 0"
          @confirm="onClearTrace"
        >
          <a-button size="small" :disabled="traceGroups.length === 0">
            <AIcon type="ReloadOutlined" />
            {{ $t('components.Source.418270-2') }}
          </a-button>
        </a-popconfirm>
        <a-segmented
          v-if="debugLogSupport"
          v-model:value="traceMode"
          size="small"
          class="trace-mode-switch"
          :options="traceModeOptions"
          @change="handleTraceModeChange"
        />
        <a-button
          v-if="codecSimulateSupport && canSaveDevice"
          size="small"
          @click="codecSimulatorOpen = true"
        >
          <AIcon type="ExperimentOutlined" />
          {{ $t('InstanceDeviceAccess.codecDebug.title') }}
        </a-button>
        <span v-if="debugLogSupport && canSaveDevice" class="trace-save-switch">
          {{ $t('InstanceDeviceAccess.debugLog.save') }}
          <a-tooltip :title="$t('InstanceDeviceAccess.debugLog.saveTip')">
            <AIcon type="QuestionCircleOutlined" class="trace-save-switch__help" />
          </a-tooltip>
          <a-popconfirm
            :title="debugLogConfig.deviceEnabled
              ? $t('InstanceDeviceAccess.debugLog.disableConfirm')
              : $t('InstanceDeviceAccess.debugLog.enableConfirm')"
            :disabled="!debugLogConfig.enabled || debugLogLoading"
            @confirm="toggleDebugLog(!debugLogConfig.deviceEnabled)"
          >
            <a-switch
              size="small"
              :checked="debugLogConfig.deviceEnabled"
              :disabled="!debugLogConfig.enabled"
              :loading="debugLogLoading"
            />
          </a-popconfirm>
        </span>
        <a-button type="primary" size="small" @click="onToggleSubscribe">
          <AIcon :type="isSubscribed ? 'PauseOutlined' : 'PlayCircleOutlined'" />
          {{
            isSubscribed
              ? $t('Apply.installing.6794613-12')
              : $t('Apply.installing.6794613-13')
          }}
        </a-button>
      </a-space>
    </div>

    <TraceChainList
      class="communication-trace__content"
      :trace-groups="traceGroups"
      :device-id="deviceId"
      :received-total="displayedTraceTotal"
      :mode="traceMode"
      :history-loading="debugHistoryLoading"
      :history-has-more="historyHasMore"
      @history-load-more="loadDebugHistory"
    />

    <a-drawer
      v-if="codecSimulateSupport && canSaveDevice"
      v-model:open="codecSimulatorOpen"
      :width="1180"
      :title="$t('InstanceDeviceAccess.codecDebug.title')"
      destroy-on-close
      placement="right"
      :body-style="{ padding: 0, height: '100%' }"
    >
      <CodecSimulatorPanel v-if="codecSimulatorOpen" />
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
import {
  disableDebugLog,
  enableDebugLog,
  existsDeviceCodecSimulateSupport,
  existsDeviceDebugLogSupport,
  getDebugLogConfig,
  queryDebugLogList,
} from '../../../../../../api/instance'
import { useInstanceStore } from '../../../../../../store/instance'
import { useAuthStore } from '@/store'
import { onlyMessage, randomString } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'
import CodecSimulatorPanel from './CodecSimulatorPanel.vue'
import TraceChainList from './TraceChainList.vue'
import { useDeviceTraceLog } from './composables/useDeviceTraceLog'
import { useTraceReceivedTotal } from './composables/useTraceReceivedTotal'

const instanceStore = useInstanceStore()
const authStore = useAuthStore()
const { t: $t } = useI18n()
const deviceId = computed(() => instanceStore.current?.id)
// 保存链路和执行报文模拟都对应设备实例的写权限；历史查询仍按读取权限保留。
const canSaveDevice = computed(() => authStore.hasPermission('device/Instance:update'))

const realtimeTrace = useDeviceTraceLog(deviceId)
const historyTrace = useDeviceTraceLog(deviceId)
const traceMode = ref<'realtime' | 'history'>('realtime')
const traceGroups = computed(() =>
  traceMode.value === 'history'
    ? historyTrace.traceGroups.value
    : realtimeTrace.traceGroups.value,
)
const traceModeOptions = computed(() => [
  { label: $t('InstanceDeviceAccess.debugLog.realtimeMode'), value: 'realtime' },
  { label: $t('InstanceDeviceAccess.debugLog.historyMode'), value: 'history' },
])

const { traceReceivedTotal, resetTraceReceivedTotal } = useTraceReceivedTotal(
  realtimeTrace.traceGroups,
  deviceId,
)
const displayedTraceTotal = computed(() =>
  traceMode.value === 'history'
    ? historyTrace.traceGroups.value.length
    : traceReceivedTotal.value,
)

const isSubscribed = ref(true)
const codecSimulatorOpen = ref(false)
const debugLogSupport = ref(false)
const codecSimulateSupport = ref(false)
const debugLogLoading = ref(false)
const debugHistoryLoading = ref(false)
const historyPageIndex = ref(0)
const historyHasMore = ref(true)
const historySnapshotTime = ref<number | null>(null)
const debugLogConfig = reactive({
  enabled: false,
  deviceEnabled: false,
})

/** 清理当前视图的实时或历史链路，历史清理仅重置前端查询游标。 */
function onClearTrace() {
  if (traceMode.value === 'history') {
    resetHistoryTrace()
    return
  }
  resetTraceReceivedTotal()
  realtimeTrace.clear()
}

/** 探测已迁移的后端能力；未装配时不暴露相应入口。 */
async function loadDeviceDebugSupport() {
  const expectedDeviceId = deviceId.value
  try {
    const [debugLogResp, codecSimulateResp]: any[] = await Promise.all([
      existsDeviceDebugLogSupport(),
      existsDeviceCodecSimulateSupport(),
    ])
    if (expectedDeviceId !== deviceId.value) return
    debugLogSupport.value = debugLogResp?.status === 200 && !!debugLogResp.result
    codecSimulateSupport.value = codecSimulateResp?.status === 200 && !!codecSimulateResp.result
  } catch {
    if (expectedDeviceId !== deviceId.value) return
    debugLogSupport.value = false
    codecSimulateSupport.value = false
  }

  if (!debugLogSupport.value) {
    traceMode.value = 'realtime'
    debugLogConfig.enabled = false
    debugLogConfig.deviceEnabled = false
  }
  if (!codecSimulateSupport.value || !canSaveDevice.value) codecSimulatorOpen.value = false
}

async function loadDebugLogConfig() {
  const expectedDeviceId = deviceId.value
  if (!expectedDeviceId || !debugLogSupport.value) return
  try {
    const response: any = await getDebugLogConfig(expectedDeviceId)
    if (expectedDeviceId !== deviceId.value) return
    const result = response?.result || {}
    debugLogConfig.enabled = !!result.enabled
    debugLogConfig.deviceEnabled = !!result.deviceEnabled
  } catch {
    if (expectedDeviceId !== deviceId.value) return
    debugLogConfig.enabled = false
    debugLogConfig.deviceEnabled = false
  }
}

async function toggleDebugLog(checked: boolean) {
  const expectedDeviceId = deviceId.value
  if (!expectedDeviceId || !debugLogSupport.value || !canSaveDevice.value || debugLogLoading.value) return
  debugLogLoading.value = true
  try {
    const response: any = checked
      ? await enableDebugLog(expectedDeviceId)
      : await disableDebugLog(expectedDeviceId)
    if (expectedDeviceId === deviceId.value && response?.status === 200) {
      debugLogConfig.deviceEnabled = checked
      onlyMessage(checked
        ? $t('InstanceDeviceAccess.debugLog.enabled')
        : $t('InstanceDeviceAccess.debugLog.disabled'))
    }
  } finally {
    debugLogLoading.value = false
  }
}

function resetHistoryTrace() {
  historyTrace.clear()
  historyPageIndex.value = 0
  historyHasMore.value = true
  historySnapshotTime.value = null
}

function appendHistoryRecords(records: any[]) {
  records.reverse().forEach((item: any) => {
    historyTrace.appendTracePayload({ key: randomString(), ...item })
  })
}

/** 使用固定快照翻页，避免新写入的链路挤入正在浏览的历史结果。 */
async function loadDebugHistory() {
  const expectedDeviceId = deviceId.value
  if (!expectedDeviceId || !debugLogSupport.value || debugHistoryLoading.value || !historyHasMore.value) return
  if (!historySnapshotTime.value) historySnapshotTime.value = Date.now()

  debugHistoryLoading.value = true
  try {
    const pageIndex = historyPageIndex.value
    const response: any = await queryDebugLogList(expectedDeviceId, {
      pageIndex,
      pageSize: 50,
      terms: [{ column: 'startTime', termType: 'lte', value: historySnapshotTime.value }],
      sorts: [
        { name: 'startTime', order: 'desc' },
        { name: 'endTime', order: 'desc' },
      ],
    })
    if (expectedDeviceId !== deviceId.value) return
    const result = response?.result || {}
    const records = Array.isArray(result.data) ? result.data : []
    appendHistoryRecords(records)
    const total = Number(result.total)
    historyHasMore.value = Number.isFinite(total)
      ? (pageIndex + 1) * 50 < total
      : records.length >= 50
    historyPageIndex.value = pageIndex + 1
  } finally {
    debugHistoryLoading.value = false
  }
}

function handleTraceModeChange(mode: 'realtime' | 'history') {
  if (mode === 'history' && historyPageIndex.value === 0) {
    void loadDebugHistory()
  }
}

function ensureTraceSubscription() {
  if (isSubscribed.value && deviceId.value) realtimeTrace.subscribe()
}

function onToggleSubscribe() {
  if (isSubscribed.value) {
    realtimeTrace.unsubscribe()
    isSubscribed.value = false
  } else {
    isSubscribed.value = true
    ensureTraceSubscription()
  }
}

onMounted(async () => {
  await loadDeviceDebugSupport()
  await loadDebugLogConfig()
  ensureTraceSubscription()
})

watch(deviceId, async (id, previousId) => {
  if (!id || id === previousId) return
  realtimeTrace.clear()
  resetTraceReceivedTotal()
  resetHistoryTrace()
  traceMode.value = 'realtime'
  await loadDeviceDebugSupport()
  await loadDebugLogConfig()
  ensureTraceSubscription()
})

onUnmounted(() => realtimeTrace.unsubscribe())
</script>

<style lang="less" scoped>
.communication-trace {
  display: flex;
  flex-direction: column;
  min-height: 560px;
  height: calc(100vh - 360px);
  min-height: 560px;
}

.communication-trace__toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.communication-trace__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.communication-trace__content {
  flex: 1;
  min-height: 0;
  padding-top: 12px;
}

.trace-tab-actions {
  flex-shrink: 0;
}

.trace-mode-switch {
  padding: 2px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
}

.trace-save-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.trace-save-switch__help {
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
}

@media screen and (max-width: 1024px) {
  .communication-trace {
    height: auto;
  }

  .communication-trace__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
