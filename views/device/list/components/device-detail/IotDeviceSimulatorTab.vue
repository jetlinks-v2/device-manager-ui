<template>
  <section class="sim-debug" :aria-label="$t('IotDeviceDetail.simulator.aria')">
    <div class="sim-banner" :data-online="session.connection.online">
      <AIcon :type="session.connection.online ? 'CheckCircleOutlined' : 'ExclamationCircleOutlined'" aria-hidden="true" />
      <span>{{ session.connection.online ? $t('IotDeviceDetail.simulator.online') : $t('IotDeviceDetail.simulator.offline') }}</span>
      <a-button type="link" class="sim-banner__link">
        {{ $t('IotDeviceDetail.accessSession.connectionCount', { count: session.connection.connectionCount }) }}
        <template #icon>
          <AIcon type="DownOutlined" aria-hidden="true" />
        </template>
      </a-button>
      <dl>
        <div>
          <dt>{{ $t('IotDeviceDetail.accessSession.field.connectionAddress') }}</dt>
          <dd>{{ session.connection.connectionAddress || '-' }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.accessSession.field.accessMode') }}</dt>
          <dd>{{ session.connection.accessMode }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.accessSession.field.connectTime') }}</dt>
          <dd>{{ formatTime(session.connection.connectedAt) }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.accessSession.field.lastCommTime') }}</dt>
          <dd>{{ formatTime(session.connection.lastCommunicatedAt) }}</dd>
        </div>
        <div>
          <dt>{{ $t('IotDeviceDetail.accessSession.field.pendingMessages') }}</dt>
          <dd>{{ session.connection.pendingMessages }}</dd>
        </div>
      </dl>
    </div>

    <div class="sim-layout">
      <aside class="sim-command">
        <header>
          <AIcon type="LinkOutlined" aria-hidden="true" />
          <div>
            <h3>{{ $t('IotDeviceDetail.simulator.remoteDebug') }}</h3>
            <p>{{ $t('IotDeviceDetail.simulator.remoteDebugDesc') }}</p>
          </div>
        </header>

        <a-segmented
          class="sim-mode-tabs"
          :value="activeMode"
          :options="modeOptions"
          :aria-label="$t('IotDeviceDetail.simulator.modeAria')"
          @change="(value) => emit('select-preset', value as SimulatorActionMode)"
        />

        <p class="sim-mode-desc">{{ activePreset?.description }}</p>

        <label class="sim-field">
          <span>{{ targetLabel }}</span>
          <a-select
            :value="target"
            :options="targetOptions"
            @change="(value) => emit('update:target', String(value ?? ''))"
          />
        </label>

        <label class="sim-field">
          <span>{{ $t('IotDeviceDetail.simulator.payload') }}</span>
          <a-textarea
            :value="payload"
            :rows="10"
            spellcheck="false"
            @update:value="(value) => emit('update:payload', value)"
          />
        </label>

        <a-button class="sim-send" disabled>
          {{ $t('IotDeviceDetail.simulator.viewOnly') }}
        </a-button>

        <div class="sim-result" data-accepted="true">
          <strong class="sim-result__status">{{ $t('IotDeviceDetail.simulator.accepted') }}</strong>
          <span>{{ $t('IotDeviceDetail.simulator.generatedAlarms', { count: generatedAlarms }) }}</span>
        </div>
      </aside>

      <section class="sim-trace-panel">
        <header class="sim-trace-panel__head">
          <div>
            <AIcon type="InfoCircleOutlined" aria-hidden="true" />
            <span>{{ $t('IotDeviceDetail.simulator.traceGuide') }}</span>
          </div>
          <div class="sim-trace-actions">
            <span>{{ $t('IotDeviceDetail.simulator.traceCount', { count: session.traces.length }) }}</span>
            <a-button size="small" @click="emit('reset-payload')">
              <template #icon>
                <AIcon type="RedoOutlined" aria-hidden="true" />
              </template>
              {{ $t('IotDeviceDetail.common.reset') }}
            </a-button>
            <a-button type="primary" size="small" @click="emit('update:paused', !paused)">
              <template #icon>
                <AIcon :type="paused ? 'PlayCircleOutlined' : 'PauseOutlined'" aria-hidden="true" />
              </template>
              {{ paused ? $t('IotDeviceDetail.common.resume') : $t('IotDeviceDetail.common.pause') }}
            </a-button>
          </div>
        </header>

        <div class="sim-trace-list">
          <div
            v-for="trace in session.traces"
            :key="trace.id"
            class="sim-trace-row"
            :class="{ 'is-active': selectedTrace?.id === trace.id }"
            @click="emit('open-trace', trace.traceId)">
            <span class="sim-direction-icon" :data-direction="trace.direction">
              <AIcon :type="trace.direction === 'uplink' ? 'ArrowUpOutlined' : 'ArrowDownOutlined'" aria-hidden="true" />
            </span>
            <strong>{{ trace.title }}</strong>
            <span>{{ trace.summary }}</span>
            <em :data-status="trace.status">{{ statusLabel(trace.status) }}</em>
            <small>{{ trace.duration }}</small>
            <b>
              {{ $t('IotDeviceDetail.common.viewDetail') }}
              <AIcon type="RightOutlined" aria-hidden="true" />
            </b>
          </div>
          <CloudEmpty v-if="!session.traces.length" class="sim-empty" :description="$t('IotDeviceDetail.simulator.noTraces')" />
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="drawerOpen && selectedTrace" class="sim-drawer-mask" @click.self="emit('update:drawerOpen', false)">
        <aside class="sim-drawer" :aria-label="$t('IotDeviceDetail.simulator.traceDetailAria')">
          <header>
            <a-button type="text" :aria-label="$t('IotDeviceDetail.simulator.closeTraceDetail')" @click="emit('update:drawerOpen', false)">
              <template #icon>
                <AIcon type="CloseOutlined" aria-hidden="true" />
              </template>
            </a-button>
            <h3>{{ $t('IotDeviceDetail.simulator.traceDetailTitle') }}</h3>
          </header>

          <section class="sim-trace-meta">
            <span>traceId</span>
            <strong>{{ selectedTrace.traceId }}</strong>
            <em :data-status="selectedTrace.status">{{ statusLabel(selectedTrace.status) }}</em>
            <em>{{ directionLabel(selectedTrace.direction) }}</em>
            <small>{{ $t('IotDeviceDetail.simulator.traceStats', { steps: selectedTrace.stepCount, logs: selectedTrace.logCount }) }}</small>
          </section>

          <ol class="sim-step-list">
            <li v-for="step in selectedTrace.steps" :key="step.id" :data-status="step.status">
              <span />
              <article>
                <header>
                  <strong>{{ step.title }}</strong>
                  <em>{{ step.node }}</em>
                </header>
                <p>{{ step.content }}</p>
                <time>{{ formatTime(step.happenedAt) }}</time>
              </article>
            </li>
          </ol>

          <section class="sim-payload-grid">
            <article>
              <header>{{ $t('IotDeviceDetail.commands.requestPayload') }}</header>
              <pre>{{ selectedTrace.requestPayload }}</pre>
            </article>
            <article>
              <header>{{ $t('IotDeviceDetail.commands.responsePayload') }}</header>
              <pre>{{ selectedTrace.responsePayload }}</pre>
            </article>
          </section>

          <section class="sim-log-drawer-list">
            <header>{{ $t('IotDeviceDetail.simulator.traceLogs') }}</header>
            <article v-for="log in traceLogs" :key="log.id" :data-level="log.level">
              <time>{{ formatTime(log.time) }}</time>
              <strong>{{ log.node || '-' }}</strong>
              <span>{{ log.message }}</span>
            </article>
          </section>
        </aside>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type {

  SimulatorActionMode,
  SimulatorDirection,
  SimulatorLog,
  SimulatorPreset,
  SimulatorSession,
  SimulatorStatus,
  SimulatorTrace,
} from './iotDeviceDetail.types'

const props = defineProps({
  session: {
    type: Object as PropType<SimulatorSession>,
    required: true,
  },
  activeMode: {
    type: String as PropType<SimulatorActionMode>,
    required: true,
  },
  activePreset: {
    type: Object as PropType<SimulatorPreset | undefined>,
    default: undefined,
  },
  target: {
    type: String,
    required: true,
  },
  payload: {
    type: String,
    required: true,
  },
  paused: {
    type: Boolean,
    required: true,
  },
  drawerOpen: {
    type: Boolean,
    required: true,
  },
  selectedTrace: {
    type: Object as PropType<SimulatorTrace | undefined>,
    default: undefined,
  },
  traceLogs: {
    type: Array as PropType<SimulatorLog[]>,
    required: true,
  },
  generatedAlarms: {
    type: Number,
    required: true,
  },
  targetLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits<{
  'update:target': [value: string]
  'update:payload': [value: string]
  'update:paused': [value: boolean]
  'update:drawerOpen': [value: boolean]
  'select-preset': [mode: SimulatorActionMode]
  'reset-payload': []
  'open-trace': [traceId: string]
}>()

const { t: $t } = useI18n()
const modeOptions = computed(() => props.session.presets.map((preset) => ({
  label: preset.label,
  value: preset.mode,
})))

const targetOptions = computed(() => props.activePreset?.targetOptions.map((option) => ({
  label: option.label,
  value: option.key,
})) ?? [])

function formatTime(value: string) {
  return value || '-'
}

function statusLabel(status: SimulatorStatus) {
  const map: Record<SimulatorStatus, string> = {
    success: $t('IotDeviceDetail.common.status.success'),
    running: $t('IotDeviceDetail.common.status.running'),
    failed: $t('IotDeviceDetail.common.status.failed'),
    waiting: $t('IotDeviceDetail.common.status.waiting'),
  }
  return map[status]
}

function directionLabel(direction: SimulatorDirection) {
  return direction === 'uplink' ? $t('IotDeviceDetail.simulator.direction.uplink') : $t('IotDeviceDetail.simulator.direction.downlink')
}
</script>

<style scoped>
.sim-debug {
  display: grid;
  gap: var(--space-3);
}

.sim-banner,
.sim-command,
.sim-trace-panel,
.sim-drawer {
  border: 0.0625rem solid var(--jet-theme-border);
  background: var(--jet-theme-bg-container);
}

.sim-banner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.sim-banner[data-online='true'] {
  border-color: color-mix(in srgb, var(--jet-theme-success) 38%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-success) 8%, var(--jet-theme-bg-container));
}

.sim-banner[data-online='false'] {
  border-color: color-mix(in srgb, var(--jet-theme-warning) 38%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-warning) 8%, var(--jet-theme-bg-container));
}

.sim-banner > :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-success);
}

.sim-banner__link {
  padding: 0;
}

.sim-banner dl {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
}

.sim-banner div,
.sim-trace-meta {
  display: inline-flex;
  gap: 0.3125rem;
  align-items: center;
}

.sim-banner dt,
.sim-trace-meta span {
  color: var(--jet-theme-text-disabled);
}

.sim-banner dd {
  margin: 0;
  color: var(--jet-theme-text-secondary); }

.sim-layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  gap: var(--space-3);
  min-height: 26.25rem;
}

.sim-command {
  display: grid;
  align-self: start;
  border-radius: var(--jet-theme-radius-lg);
  overflow: hidden;
}

.sim-command > header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  padding: var(--space-3);
}

.sim-command h3,
.sim-command p,
.sim-mode-desc,
.sim-trace-panel__head span,
.sim-trace-row strong,
.sim-trace-row span,
.sim-trace-row em,
.sim-trace-row small,
.sim-drawer h3,
.sim-step-list p {
  margin: 0;
}

.sim-command h3 {
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.sim-command p,
.sim-mode-desc {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.55;
}

.sim-command :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-primary);
}

.sim-mode-tabs {
  margin: 0 0.75rem;
}

.sim-mode-desc {
  padding: var(--space-2) var(--space-3) 0;
}

.sim-field {
  display: grid;
  gap: 0.375rem;
  padding: var(--space-2) var(--space-3) 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-weight: 600;
}

.sim-field :deep(.ant-select),
.sim-field :deep(.ant-input) {
  width: 100%;
}

.sim-field :deep(textarea.ant-input) { font-size: var(--fs-14);
}

.sim-send {
  margin: var(--space-3);
  width: calc(100% - 1.5rem);
}

.sim-result {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding: var(--space-2) var(--space-3);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.sim-result[data-accepted='true'] .sim-result__status {
  color: var(--jet-theme-success);
}

.sim-result[data-accepted='false'] .sim-result__status {
  color: var(--jet-theme-error);
}

.sim-trace-panel {
  min-width: 0;
  border-radius: var(--jet-theme-radius-lg);
  overflow: hidden;
}

.sim-trace-panel__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
  min-height: 2.125rem;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.625rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.sim-trace-panel__head div {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.sim-trace-actions {
  margin-left: auto;
}

.sim-trace-panel__head :deep(svg) {
  width: 0.8125rem;
  height: 0.8125rem;
  color: var(--jet-theme-primary);
}

.sim-trace-actions :deep(svg) {
  color: currentColor;
}

.sim-trace-list {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
}

.sim-trace-row {
  display: grid;
  grid-template-columns: 1.875rem 8.75rem minmax(11.25rem, 1fr) 3.625rem 4.375rem 5.5rem;
  gap: var(--space-2);
  align-items: center;
  min-height: 2.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  padding: 0.375rem 0.5rem;
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sim-trace-row.is-active,
.sim-trace-row:hover {
  border-color: var(--jet-theme-primary);
  box-shadow: 0 0 0 0.125rem var(--jet-theme-primary-soft);
}

.sim-direction-icon {
  display: inline-grid;
  place-items: center;
  width: 1.625rem;
  height: 1.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-primary);
}

.sim-direction-icon[data-direction='downlink'] {
  color: var(--jet-theme-primary);
}

.sim-trace-row span,
.sim-trace-row small {
  overflow: hidden;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sim-trace-row strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sim-trace-row em,
.sim-trace-meta em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.25rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius-sm);
  padding: 0 0.375rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.sim-trace-row em[data-status='success'],
.sim-trace-meta em[data-status='success'] {
  border-color: color-mix(in srgb, var(--jet-theme-success) 44%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-success) 10%, transparent);
  color: var(--jet-theme-success);
}

.sim-trace-row em[data-status='failed'],
.sim-trace-meta em[data-status='failed'] {
  border-color: color-mix(in srgb, var(--jet-theme-error) 44%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-error) 10%, transparent);
  color: var(--jet-theme-error);
}

.sim-trace-row b {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  justify-content: end;
  color: var(--jet-theme-primary);
  font-size: var(--fs-14);
  font-weight: 600;
}

.sim-empty {
  display: grid;
  min-height: 11.25rem;
  place-items: center;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-body);
}

.sim-drawer-mask {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: color-mix(in srgb, var(--jet-theme-text) 42%, transparent);
}

.sim-drawer {
  width: min(45rem, 48vw);
  height: 100%;
  overflow: auto;
  border-width: 0 0 0 0.0625rem;
  box-shadow: var(--jet-theme-shadow);
}

.sim-drawer > header {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: 3.25rem;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.875rem;
}

.sim-drawer h3 {
  color: var(--jet-theme-text);
  font-size: var(--fs-h4);
  font-weight: 600;
}

.sim-trace-meta {
  flex-wrap: wrap;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  padding: 0.875rem;
  font-size: var(--fs-14);
}

.sim-trace-meta strong {
  color: var(--jet-theme-text); }

.sim-trace-meta small {
  color: var(--jet-theme-text-disabled);
}

.sim-step-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0.875rem 1.125rem;
  list-style: none;
}

.sim-step-list li {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: var(--space-2);
  min-height: 4.5rem;
  position: relative;
}

.sim-step-list li::before {
  content: '';
  position: absolute;
  top: 0.875rem;
  bottom: -0.25rem;
  left: 0.3125rem;
  width: 0.0625rem;
  background: var(--jet-theme-border);
}

.sim-step-list li:last-child::before {
  display: none;
}

.sim-step-list li > span {
  z-index: 1;
  width: 0.625rem;
  height: 0.625rem;
  border: 0.125rem solid var(--jet-theme-primary);
  border-radius: 50%;
  margin-top: 0.5625rem;
  background: var(--jet-theme-bg-container);
}

.sim-step-list li[data-status='failed'] > span {
  border-color: var(--jet-theme-error);
}

.sim-step-list article {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  padding: 0.625rem;
  background: var(--jet-theme-bg-container);
}

.sim-step-list header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.sim-step-list strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
}

.sim-step-list em,
.sim-step-list time {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.sim-step-list p {
  margin-top: 0.375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
}

.sim-payload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 0.875rem 0.875rem;
}

.sim-payload-grid article,
.sim-log-drawer-list {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
  background: var(--jet-theme-bg-container);
}

.sim-payload-grid header,
.sim-log-drawer-list > header {
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  padding: 0.5rem 0.625rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  font-weight: 600;
}

.sim-payload-grid pre {
  max-height: 11.25rem;
  overflow: auto;
  margin: 0;
  padding: 0.625rem;
  color: var(--jet-theme-text-secondary); font-size: var(--fs-14);
  white-space: pre-wrap;
}

.sim-log-drawer-list {
  margin: 0 0.875rem 1.125rem;
}

.sim-log-drawer-list article {
  display: grid;
  grid-template-columns: 8.625rem 5.625rem minmax(0, 1fr);
  gap: var(--space-2);
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  padding: 0.5rem 0.625rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.sim-log-drawer-list article:last-child {
  border-bottom: 0;
}

.sim-log-drawer-list time,
.sim-log-drawer-list strong {
  color: var(--jet-theme-text-disabled); font-weight: 500;
}

.sim-log-drawer-list article[data-level='error'] span {
  color: var(--jet-theme-error);
}

.sim-log-drawer-list article[data-level='warning'] span {
  color: var(--jet-theme-warning);
}

.sim-log-drawer-list article[data-level='success'] span {
  color: var(--jet-theme-success);
}

@media (max-width: 68.75rem) {
  .sim-layout {
    grid-template-columns: 1fr;
  }

  .sim-drawer {
    width: min(47.5rem, 72vw);
  }
}

@media (max-width: 45rem) {
  .sim-trace-row {
    grid-template-columns: 1.875rem minmax(6.25rem, 1fr) 4.375rem;
  }

  .sim-trace-row > span:not(.sim-direction-icon),
  .sim-trace-row small,
  .sim-trace-row b {
    display: none;
  }

  .sim-drawer {
    width: 100vw;
  }

  .sim-payload-grid {
    grid-template-columns: 1fr;
  }
}</style>
