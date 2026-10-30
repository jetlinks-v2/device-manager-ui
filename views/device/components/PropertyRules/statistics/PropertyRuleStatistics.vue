<template>
  <a-popover :open="open" trigger="click" placement="bottomRight" :destroy-tooltip-on-hide="true" @open-change="emit('toggle', $event)">
    <template #content>
      <section class="rule-statistics" role="dialog" :aria-label="$t('PropertyRules.statistics.title')" @keydown.esc.stop.prevent="dismiss">
        <header><strong>{{ $t('PropertyRules.statistics.title') }}</strong><a-button type="text" size="small" :disabled="entry.loading || !target.permitted || target.source === 'disabled'" :aria-label="$t('PropertyRules.statistics.refresh')" @click="emit('refresh')"><AIcon type="ReloadOutlined" :spin="entry.loading" /></a-button></header>
        <div class="statistics-scope"><span>{{ $t(`PropertyRules.statistics.scope.${target.source}`) }}</span><span v-if="snapshot">{{ $t('PropertyRules.statistics.singleNode') }}<a-tooltip :title="snapshot.nodeId"><AIcon type="InfoCircleOutlined" /></a-tooltip></span></div>
        <p v-if="inherited" class="statistics-hint">{{ $t(target.permitted ? 'PropertyRules.statistics.inherited' : 'PropertyRules.statistics.productPermission') }}</p>
        <p class="statistics-state" :class="statusClass"><AIcon :type="statusIcon" :spin="status === 'loading'" />{{ $t(`PropertyRules.statistics.state.${status}`) }}</p>
        <dl v-if="target.permitted && target.source !== 'disabled' && snapshot" class="statistics-counts">
          <template v-for="key in counterKeys" :key="key"><dt>{{ $t(`PropertyRules.statistics.counter.${key}`) }}</dt><dd>{{ format(snapshot[key]) }}</dd></template>
        </dl>
        <div v-if="snapshot" class="statistics-rate"><span>{{ $t('PropertyRules.statistics.rate') }}</span><strong>{{ entry.failure ? '—' : format(entry.rate, 1) }} <small>{{ $t('PropertyRules.statistics.perSecond') }}</small></strong></div>
        <footer>
          <span v-if="snapshot">{{ $t(entry.failure ? 'PropertyRules.statistics.lastRead' : 'PropertyRules.statistics.asOf', { time: time(snapshot.sampledAt) }) }}</span>
          <span v-if="snapshot?.loaded">{{ $t('PropertyRules.statistics.since', { time: time(snapshot.startedAt) }) }}</span>
          <span v-if="entry.restarted">{{ $t('PropertyRules.statistics.restarted') }}</span>
          <span v-if="dirty" class="statistics-draft"><AIcon type="SaveOutlined" />{{ $t('PropertyRules.statistics.savedRule') }}</span>
          <RuleNotice kind="info" :label="$t('PropertyRules.statistics.helpTitle')" :message="$t('PropertyRules.statistics.help')" />
        </footer>
      </section>
    </template>
    <a-tooltip :title="tooltip" :open="open ? false : undefined">
      <a-button ref="trigger" type="text" size="small" class="rule-statistics-trigger" :class="statusClass" :aria-label="tooltip" :aria-expanded="open" aria-haspopup="dialog" @keydown.esc.stop.prevent="dismiss"><AIcon :type="status === 'loading' ? 'LoadingOutlined' : 'DashboardOutlined'" :spin="status === 'loading'" /></a-button>
    </a-tooltip>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RuleNotice from '../RuleNotice.vue'
import { statisticsStatus, type StatisticsEntry, type StatisticsTarget } from './model'
const props = defineProps<{ target: StatisticsTarget; entry: StatisticsEntry; open: boolean; dirty?: boolean; inherited?: boolean }>()
const emit = defineEmits<{ toggle: [open: boolean]; refresh: [] }>()
const { t: $t, locale } = useI18n()
const trigger = ref<{ $el: HTMLElement }>()
const snapshot = computed(() => props.entry.snapshot)
const status = computed(() => statisticsStatus(props.target, props.entry))
const statusClass = computed(() => ({ 'statistics-warning': status.value === 'bypassed', 'statistics-error': status.value === 'errors' }))
const statusIcon = computed(() => status.value === 'loading' ? 'LoadingOutlined' : ['bypassed', 'errors', 'failed'].includes(status.value) ? 'ExclamationCircleOutlined' : 'InfoCircleOutlined')
const tooltip = computed(() => `${$t('PropertyRules.statistics.title')} · ${$t(`PropertyRules.statistics.state.${status.value}`)}${snapshot.value ? ` · ${time(snapshot.value.sampledAt)}` : ''}`)
const counterKeys = ['input', 'output', 'cleaned', 'sampled', 'bypassed', 'errors'] as const
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const timeFormat = computed(() => new Intl.DateTimeFormat(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
function format(value: number | null | undefined, fraction = 0) {
  return value == null || !Number.isFinite(value) ? '—' : numberFormat.value.format(fraction ? value : Math.trunc(value))
}
function time(value: number) { return value > 0 ? timeFormat.value.format(value) : '—' }
function dismiss() { emit('toggle', false); trigger.value?.$el.focus() }
</script>
<style scoped>
.rule-statistics-trigger { width: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--jet-theme-text-secondary); }
.rule-statistics-trigger:not(:disabled):hover { color: var(--jet-theme-primary); background: var(--bg-sunken); }
.rule-statistics-trigger:focus-visible { outline: 1px solid var(--jet-theme-primary); outline-offset: 1px; }
.rule-statistics { width: min(320px, calc(100vw - 56px)); color: var(--jet-theme-text); font-size: var(--fs-12); line-height: 1.6; }
.rule-statistics header, .statistics-scope, .statistics-rate { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.rule-statistics header strong { font-size: var(--fs-14); }
.rule-statistics header :deep(.ant-btn) { color: var(--jet-theme-text-secondary); }
.statistics-scope, .statistics-hint, .rule-statistics footer { color: var(--jet-theme-text-secondary); }
.statistics-scope > span, .statistics-state, .statistics-draft { display: inline-flex; align-items: center; gap: var(--space-1); }
.statistics-hint { margin: var(--space-1) 0; }
.statistics-state { margin: var(--space-2) 0; }
.statistics-counts { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: var(--space-2) var(--space-3); padding-block: var(--space-3); margin: 0; border-block: 1px solid var(--line); }
.statistics-counts dt { color: var(--jet-theme-text-secondary); font-weight: normal; }
.statistics-counts dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.statistics-rate { padding-block: var(--space-2); }
.statistics-rate strong { font-weight: 500; font-variant-numeric: tabular-nums; }
.statistics-rate small { color: var(--jet-theme-text-secondary); font-size: inherit; font-weight: normal; }
.rule-statistics footer { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); border-top: 1px solid var(--line); padding-top: var(--space-2); }
.rule-statistics footer > span:first-child { width: 100%; }
.rule-statistics footer :deep(.rule-notice) { margin-inline-start: auto; }
.statistics-warning { color: var(--jet-theme-warning); }
.statistics-error { color: var(--jet-theme-error); }
</style>
