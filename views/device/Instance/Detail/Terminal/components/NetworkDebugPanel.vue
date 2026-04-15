<template>
  <div class="network-debug-panel">
    <div class="network-debug-panel__header">
      <div class="network-debug-panel__title-row">
        <div class="network-debug-panel__title-main">
          <AIcon type="ApiOutlined" class="network-debug-panel__title-icon" />
          <span class="network-debug-panel__title">{{ $t('Terminal.index.remote-59') }}</span>
          <span class="network-debug-panel__title-hint">{{ $t('Terminal.index.remote-98') }}</span>
        </div>
        <a-tag :color="running ? 'processing' : 'default'">
          {{ running ? $t('Terminal.index.remote-82') : $t('Terminal.index.remote-81') }}
        </a-tag>
      </div>
    </div>

    <a-alert
      v-if="!online"
      class="network-debug-panel__offline"
      type="warning"
      show-icon
      :message="$t('Terminal.index.remote-61')"
    />

    <div class="network-debug-panel__layout">
      <div class="network-debug-panel__config">
        <div class="network-debug-panel__section-title">{{ $t('Terminal.index.remote-62') }}</div>
        <a-form layout="vertical">
          <a-form-item :label="$t('Terminal.index.remote-64')">
            <a-input-number
              v-model:value="formState.byteLength"
              :min="1"
              :step="256"
              :disabled="running"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item :label="$t('Terminal.index.remote-63')">
            <a-input-number
              v-model:value="formState.duration"
              :min="1"
              :step="1"
              :disabled="running"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item :label="$t('Terminal.index.remote-65')">
            <a-input-number
              v-model:value="formState.concurrency"
              :min="1"
              :step="1"
              :disabled="running"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item>
            <template #label>
              <span class="network-debug-panel__form-label">
                <span>{{ $t('Terminal.index.remote-66') }}</span>
                <a-tooltip :title="$t('Terminal.index.remote-83')">
                  <AIcon type="QuestionCircleOutlined" class="network-debug-panel__label-help" />
                </a-tooltip>
              </span>
            </template>
            <a-switch v-model:checked="formState.duplex" :disabled="running" />
          </a-form-item>
          <a-form-item>
            <template #label>
              <span class="network-debug-panel__form-label">
                <span>{{ $t('Terminal.index.remote-67') }}</span>
                <a-tooltip :title="$t('Terminal.index.remote-84')">
                  <AIcon type="QuestionCircleOutlined" class="network-debug-panel__label-help" />
                </a-tooltip>
              </span>
            </template>
            <a-switch v-model:checked="formState.random" :disabled="running" />
          </a-form-item>
          <a-space wrap>
            <a-button type="primary" :disabled="running || !online" @click="startTest">
              {{ $t('Terminal.index.remote-68') }}
            </a-button>
            <a-button :disabled="!running" @click="stopTest()">
              {{ $t('Terminal.index.remote-69') }}
            </a-button>
            <a-button :disabled="running || !samples.length" @click="clearSamples">
              {{ $t('Terminal.index.remote-87') }}
            </a-button>
          </a-space>
        </a-form>
      </div>

      <div class="network-debug-panel__result">
        <div class="network-debug-panel__metrics">
          <div class="network-debug-panel__metric-card">
            <div class="network-debug-panel__metric-label">
              <span>{{ $t('Terminal.index.remote-71') }}</span>
              <a-tooltip :title="$t('Terminal.index.remote-94')">
                <AIcon type="QuestionCircleOutlined" class="network-debug-panel__metric-help" />
              </a-tooltip>
            </div>
            <div class="network-debug-panel__metric-value">{{ currentThroughput }}</div>
          </div>
          <div class="network-debug-panel__metric-card">
            <div class="network-debug-panel__metric-label">
              <span>{{ $t('Terminal.index.remote-72') }}</span>
              <a-tooltip :title="$t('Terminal.index.remote-95')">
                <AIcon type="QuestionCircleOutlined" class="network-debug-panel__metric-help" />
              </a-tooltip>
            </div>
            <div class="network-debug-panel__metric-value">{{ peakThroughput }}</div>
          </div>
          <div class="network-debug-panel__metric-card">
            <div class="network-debug-panel__metric-label">
              <span>{{ $t('Terminal.index.remote-73') }}</span>
              <a-tooltip :title="$t('Terminal.index.remote-96')">
                <AIcon type="QuestionCircleOutlined" class="network-debug-panel__metric-help" />
              </a-tooltip>
            </div>
            <div class="network-debug-panel__metric-value">{{ totalTraffic }}</div>
          </div>
          <div class="network-debug-panel__metric-card">
            <div class="network-debug-panel__metric-label">
              <span>{{ $t('Terminal.index.remote-74') }}</span>
              <a-tooltip :title="$t('Terminal.index.remote-97')">
                <AIcon type="QuestionCircleOutlined" class="network-debug-panel__metric-help" />
              </a-tooltip>
            </div>
            <div class="network-debug-panel__metric-value">{{ totalCount }}</div>
          </div>
        </div>

        <a-alert
          v-if="errorMessage"
          class="network-debug-panel__error"
          type="error"
          show-icon
          :message="$t('Terminal.index.remote-89')"
          :description="errorMessage"
        />

        <div class="network-debug-panel__list">
          <div class="network-debug-panel__list-head">
            <span>{{ $t('Terminal.index.remote-77') }}</span>
            <span class="network-debug-panel__list-tip">{{ $t('Terminal.index.remote-88') }}</span>
          </div>

          <a-empty
            v-if="!displaySamples.length"
            :description="$t('Terminal.index.remote-75')"
          >
            <template #image>
              <AIcon type="AreaChartOutlined" class="network-debug-panel__empty-icon" />
            </template>
            <div class="network-debug-panel__empty-desc">
              {{ $t('Terminal.index.remote-76') }}
            </div>
          </a-empty>

          <div v-else class="network-debug-panel__sample-list">
            <div
              v-for="sample in displaySamples"
              :key="sample.index"
              class="network-debug-panel__sample-item"
            >
              <div class="network-debug-panel__sample-top">
                <span class="network-debug-panel__sample-index">#{{ sample.index }}</span>
                <span>{{ $t('Terminal.index.remote-91') }}: {{ sample.timeText }}</span>
              </div>
              <div class="network-debug-panel__sample-grid">
                <div>
                  <span class="network-debug-panel__sample-label">{{ $t('Terminal.index.remote-74') }}</span>
                  <span>{{ sample.count }}</span>
                </div>
                <div>
                  <span class="network-debug-panel__sample-label">{{ $t('Terminal.index.remote-79') }}</span>
                  <span>{{ sample.bytesText }}</span>
                </div>
                <div>
                  <span class="network-debug-panel__sample-label">{{ $t('Terminal.index.remote-80') }}</span>
                  <span>{{ sample.throughputText }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { speedTestByEdge } from '../../../../../../api/instance'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'

type SpeedSample = {
  index: number
  count: number
  bytes: number
  bytesText: string
  throughput: number
  throughputText: string
  timeText: string
}

const props = defineProps<{
  deviceId: string
  online: boolean
}>()

const { t: $t } = useI18n()

const formState = reactive({
  byteLength: 1024,
  duration: 1,
  concurrency: 1,
  duplex: true,
  random: false,
})

const running = ref(false)
const errorMessage = ref('')
const samples = ref<SpeedSample[]>([])

let sampleIndex = 0
let speedTestSubscription: { unsubscribe: () => void } | null = null

const durationSeconds = computed(() => Math.max(Number(formState.duration) || 1, 1))

const displaySamples = computed(() => samples.value.slice(-20).reverse())

const currentThroughput = computed(() => {
  return samples.value.length ? samples.value[samples.value.length - 1].throughputText : '-'
})

const peakThroughput = computed(() => {
  if (!samples.value.length) return '-'
  const value = Math.max(...samples.value.map((item) => item.throughput))
  return formatThroughput(value)
})

const totalTraffic = computed(() => {
  const value = samples.value.reduce((total, item) => total + item.bytes, 0)
  return samples.value.length ? formatBytes(value) : '-'
})

const totalCount = computed(() => {
  const value = samples.value.reduce((total, item) => total + item.count, 0)
  return samples.value.length ? `${value}` : '-'
})

const formatBytes = (value?: number | string) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return '-'
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatThroughput = (value?: number | string) => {
  const text = formatBytes(value)
  return text === '-' ? text : `${text}/s`
}

const buildErrorMessage = (err: any) => {
  return err?.message || err?.response?.message || err?.error || `${err || ''}` || ''
}

const appendSample = (payload: Record<string, any>) => {
  const bytes = Number(payload?.bytes) || 0
  const count = Number(payload?.count) || 0
  const throughput = bytes / durationSeconds.value

  sampleIndex += 1
  samples.value.push({
    index: sampleIndex,
    count,
    bytes,
    bytesText: payload?.formatBytes || formatBytes(bytes),
    throughput,
    throughputText: formatThroughput(throughput),
    timeText: new Date().toLocaleTimeString(),
  })

  if (samples.value.length > 200) {
    samples.value = samples.value.slice(-200)
  }
}

const stopTest = (showTip = false) => {
  speedTestSubscription?.unsubscribe()
  speedTestSubscription = null
  if (running.value && showTip) {
    onlyMessage($t('Terminal.index.remote-81') as string)
  }
  running.value = false
}

const clearSamples = () => {
  errorMessage.value = ''
  samples.value = []
  sampleIndex = 0
}

const startTest = () => {
  if (!props.deviceId) {
    onlyMessage($t('Terminal.index.remote-90') as string, 'warning')
    return
  }

  stopTest()
  clearSamples()
  running.value = true

  speedTestSubscription = speedTestByEdge(props.deviceId, {
    byteLength: formState.byteLength,
    random: formState.random,
    duration: durationSeconds.value,
    duplex: formState.duplex,
    concurrency: formState.concurrency,
  }).subscribe({
    next: (payload: Record<string, any>) => {
      errorMessage.value = ''
      appendSample(payload)
    },
    error: (err: any) => {
      running.value = false
      speedTestSubscription = null
      errorMessage.value = buildErrorMessage(err)
      onlyMessage($t('Terminal.index.remote-89') as string, 'error')
    },
    complete: () => {
      running.value = false
      speedTestSubscription = null
    },
  })
}

watch(
  () => props.online,
  (value) => {
    if (!value) {
      stopTest()
    }
  },
)

watch(
  () => props.deviceId,
  () => {
    stopTest()
    clearSamples()
  },
)

onBeforeUnmount(() => {
  stopTest()
})
</script>

<style scoped lang="less">
.network-debug-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  background: #fff;
  overflow: hidden;
}

.network-debug-panel__header {
  margin-bottom: 16px;
}

.network-debug-panel__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.network-debug-panel__title-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.network-debug-panel__title-icon {
  color: @primary-color;
  font-size: 16px;
}

.network-debug-panel__title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.network-debug-panel__title-hint {
  min-width: 0;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.network-debug-panel__offline {
  margin-bottom: 16px;
}

.network-debug-panel__layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.network-debug-panel__config,
.network-debug-panel__result {
  min-height: 0;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  background: #fff;
}

.network-debug-panel__config {
  padding: 16px;
  overflow-y: auto;
}

.network-debug-panel__result {
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.network-debug-panel__section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: rgba(0, 0, 0, 0.88);
}

.network-debug-panel__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.network-debug-panel__metric-card {
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(22, 119, 255, 0.02));
}

.network-debug-panel__metric-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 10px;
}

.network-debug-panel__metric-help {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  cursor: help;
}

.network-debug-panel__form-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.network-debug-panel__label-help {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  cursor: help;
}

.network-debug-panel__metric-value {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-all;
}

.network-debug-panel__error {
  margin-bottom: 16px;
}

.network-debug-panel__list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.network-debug-panel__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.network-debug-panel__list-tip {
  font-size: 12px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}

.network-debug-panel__empty-icon {
  font-size: 40px;
  color: rgba(22, 119, 255, 0.5);
}

.network-debug-panel__empty-desc {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.45);
}

.network-debug-panel__sample-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.network-debug-panel__sample-item {
  padding: 14px 16px;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
}

.network-debug-panel__sample-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.network-debug-panel__sample-index {
  font-weight: 600;
  color: rgba(22, 119, 255, 0.95);
}

.network-debug-panel__sample-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.network-debug-panel__sample-grid > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: rgba(0, 0, 0, 0.88);
}

.network-debug-panel__sample-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

@media (max-width: 1200px) {
  .network-debug-panel__layout {
    grid-template-columns: 1fr;
  }

  .network-debug-panel__metrics,
  .network-debug-panel__sample-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
