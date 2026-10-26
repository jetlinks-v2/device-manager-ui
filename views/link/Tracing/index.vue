<template>
  <main class="cluster-tracing" :class="{ 'cluster-tracing--search': !workspace.active.value }">
    <a-result v-if="!view.access.value.trace" status="403" :title="t('runtimeDiagnostics.forbidden')" />
    <template v-else>
      <section class="trace-search" :class="{ 'trace-search--landing': !workspace.active.value }">
        <div v-if="!workspace.active.value" class="trace-search-intro">
          <h1>{{ t('Tracing.findTrace') }}</h1>
          <p>{{ t('Tracing.searchHint') }}</p>
        </div>
        <div class="trace-search-control">
          <a-input-search
            v-model:value="view.input.value"
            :size="workspace.active.value ? 'middle' : 'large'"
            :status="workspace.inputError.value ? 'error' : undefined"
            :placeholder="t('Tracing.inputPlaceholder')"
            :enter-button="t('runtimeDiagnostics.query')"
            :aria-label="t('Tracing.inputPlaceholder')"
            allow-clear
            @search="view.search"
          />
          <a-popover v-if="recent.length" :open="recentOpen" trigger="click" placement="bottomRight" @open-change="setRecentOpen">
            <template #content>
              <div class="trace-recent" @keydown.esc.stop.prevent="closeRecent(true)">
                <strong>{{ t('Tracing.recent') }}</strong>
                <a-empty
                  v-if="!recent.length"
                  :description="t('Tracing.noRecent')"
                  :image-style="{ height: '32px' }"
                />
                <div
                  v-for="record in recent"
                  :key="record.key"
                  class="trace-recent-row"
                  :class="{ 'trace-recent-row--current': record.key === workspace.activeKey.value }"
                >
                  <a-button
                    type="text"
                    class="trace-recent-select"
                    :title="traceEntryName(record)"
                    :aria-pressed="record.key === workspace.activeKey.value"
                    @click="selectRecent(record.key)"
                  >
                    <span class="trace-recent-copy">
                      <strong>{{ traceTabLabel(traceEntryName(record)) }}</strong>
                      <small>
                        <code>{{ traceTabId(record.traceId, workspace.tabs.value) }}</code>
                        · {{ t(traceStateKey(record)) }}
                        · {{ traceRecentDuration(record, locale) ?? t('runtimeDiagnostics.unknownTime') }}
                      </small>
                    </span>
                  </a-button>
                  <a-button
                    type="text"
                    :aria-label="t('Tracing.closeNamedTrace', {
                      name: traceTabLabel(traceEntryName(record)),
                      id: traceTabId(record.traceId, workspace.tabs.value),
                    })"
                    @click="closeRecord(record.key)"
                  >
                    <CloseOutlined />
                  </a-button>
                </div>
              </div>
            </template>
            <a-button
              ref="recentTrigger"
              type="text"
              :aria-label="t('Tracing.recent')"
              :aria-expanded="recentOpen"
              @keydown.esc.stop.prevent="closeRecent(true)"
            >
              {{ t('Tracing.recent') }} {{ recent.length }} <DownOutlined />
            </a-button>
          </a-popover>
          <a-tooltip v-if="workspace.active.value" :title="t('runtimeDiagnostics.refresh')">
            <a-button
              type="text"
              :disabled="!view.traceId.value"
              :loading="view.state.value.status === 'loading'"
              :aria-label="t('runtimeDiagnostics.refresh')"
              @click="view.refresh"
            >
              <ReloadOutlined />
            </a-button>
          </a-tooltip>
          <a-popover v-if="workspace.active.value" :open="helpOpen" trigger="click" @open-change="setHelpOpen">
            <template #content>
              <div @keydown.esc.stop.prevent="closeHelp(true)"><TraceInputHelp /></div>
            </template>
            <a-button
              ref="helpTrigger"
              type="text"
              :aria-label="t('Tracing.traceInputHelp')"
              :aria-expanded="helpOpen"
              @keydown.esc.stop.prevent="closeHelp(true)"
            >
              <QuestionCircleOutlined /> {{ t('Tracing.traceInputHelp') }}
            </a-button>
          </a-popover>
        </div>
        <a-alert
          v-if="workspace.capacityReached.value"
          type="info"
          show-icon
          :message="t('Tracing.workspaceLimit', { count: workspace.limit })"
        />
        <p v-if="workspace.inputError.value" class="trace-input-error" role="alert">
          {{ t('Tracing.invalidTraceInput') }}
        </p>
        <TraceInputHelp v-if="!workspace.active.value && canInteract" />
      </section>
      <TraceTabPanel
        v-for="tab in workspace.tabs.value"
        :key="tab.key"
        :tab="tab"
        :nodes="view.directory.data.value ?? []"
        :active="view.active.value && tab.key === workspace.activeKey.value"
        :log-access="view.access.value.logs"
        :node-access="view.access.value.enter"
        @refresh="view.refresh"
        @select="view.select"
        @logs="view.logs"
        @node="view.node"
      />
    </template>
  </main>
</template>

<script setup lang="ts" name="ClusterTracingPage">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined, DownOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useClusterTrace } from './useClusterTrace'
import { traceEntryName, traceTabLabel, traceTabId } from './useTraceWorkspace'
import { traceRecentDuration, traceStateKey } from './traceRecentPresentation'
import TraceTabPanel from './TraceTabPanel.vue'
import TraceInputHelp from './TraceInputHelp.vue'

const props = defineProps({ active: { type: Boolean, default: true } })
const { t, locale } = useI18n()
const view = useClusterTrace(toRef(props, 'active')), workspace = view.workspace
const recent = computed(() => [...workspace.tabs.value].sort((left, right) => right.accessedAt - left.accessedAt))
const canInteract = computed(() => view.active.value && view.access.value.trace)
const recentOpen = ref(false), helpOpen = ref(false)
const recentTrigger = ref<{ focus?: () => void }>(), helpTrigger = ref<{ focus?: () => void }>()

function setRecentOpen(open: boolean) {
  recentOpen.value = open && canInteract.value
  if (recentOpen.value) helpOpen.value = false
}
function setHelpOpen(open: boolean) {
  helpOpen.value = open && canInteract.value
  if (helpOpen.value) recentOpen.value = false
}
// Overlay actions restore focus only while this page owns the interaction; hidden views must not steal focus.
async function closeRecent(restoreFocus = false) {
  recentOpen.value = false
  await nextTick()
  if (restoreFocus && canInteract.value) recentTrigger.value?.focus?.()
}
async function closeHelp(restoreFocus = false) {
  helpOpen.value = false
  await nextTick()
  if (restoreFocus && canInteract.value) helpTrigger.value?.focus?.()
}
function selectRecent(key: string) { view.activate(key); void closeRecent(true) }
function closeRecord(key: string) { view.close(key); void closeRecent(true) }
watch(canInteract, active => {
  if (!active) { recentOpen.value = false; helpOpen.value = false }
}, { flush: 'sync' })
</script>

<style scoped>
.cluster-tracing {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.cluster-tracing--search {
  justify-content: center;
  padding-block: clamp(32px, 6vh, 64px) clamp(64px, 14vh, 144px);
}
.trace-search--landing {
  width: min(100%, 760px);
  margin-inline: auto;
}
.trace-search-intro {
  margin-bottom: var(--space-6, 24px);
  text-align: center;
}
.trace-search-intro h1 {
  margin: 0;
  color: var(--ink-1);
  font-size:var(--fs-display,24px);
  font-weight: 600;
}
.trace-search-intro p {
  margin: var(--space-2, 8px) 0 0;
  color: var(--ink-3);
  font-size: var(--fs-14, 14px);
}
.trace-search--landing .trace-search-control :deep(.ant-input-search) {
  max-width: none;
}
.trace-search--landing :deep(.trace-input-help) {
  justify-content: center;
  margin-top: var(--space-4, 16px);
}
.trace-search {
  margin-bottom: var(--space-2, 8px);
}
.trace-search-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1, 4px);
}
.trace-search-control :deep(.ant-input-search) {
  flex: 1 1 360px;
  min-width: min(100%, 180px);
  max-width: 680px;
}
.trace-search > .ant-alert {
  margin-top: var(--space-2, 8px);
}
.trace-input-error {
  margin: 4px 0 0;
  color: var(--danger);
  font-size: var(--fs-12, 12px);
}
.trace-recent {
  display: grid;
  gap: var(--space-1, 4px);
  width: min(420px, calc(100vw - 40px));
  max-height: min(420px, calc(100vh - 96px));
  overflow-y: auto;
}
.trace-recent-row {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  border-radius: var(--r-1, 4px);
}
.trace-recent-row--current {
  background: var(--accent-soft);
}
.trace-recent-select {
  flex: 1;
  min-width: 0;
  height: auto;
  padding-block: 6px;
  text-align: left;
}
.trace-recent-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
  text-align: left;
}
.trace-recent-select strong,
.trace-recent-select small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trace-recent-select strong {
  font-size: var(--fs-sm, 13px);
  font-weight: 500;
}
.trace-recent-select small {
  color: var(--ink-2);
  font-size: var(--fs-12, 12px);
}
</style>
