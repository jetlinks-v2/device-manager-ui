<template>
  <div class="trace-input-help">
    <span>{{ t('Tracing.traceInputHelp') }}</span>
    <a-popover
      v-for="source in sources"
      :key="source"
      :open="activeSource === source"
      trigger="click"
      placement="bottomLeft"
      @open-change="open => setOpen(source, open)"
    >
      <template #title>
        <div class="trace-help-title">
          <span>{{ t(`Tracing.help${source}`) }}</span>
          <a-button type="text" size="small" :aria-label="t('Tracing.helpClose')" @click="close(source)"><CloseOutlined /></a-button>
        </div>
      </template>
      <template #content>
        <div class="trace-help-content" @keydown.esc.stop.prevent="close(source)">
          <ol class="trace-help-steps">
            <li>{{ t(`Tracing.help${source}Step1`) }}</li>
            <li>{{ t(`Tracing.help${source}Step2`) }}</li>
            <li>{{ t('Tracing.helpPasteActual') }}</li>
          </ol>
          <figure class="trace-help-example">
            <div v-if="source === 'Browser'" class="trace-devtools" aria-hidden="true">
              <div class="trace-devtools-tabs"><span>Elements</span><span>Console</span><span>Sources</span><strong>Network</strong><span class="trace-devtools-more">»</span></div>
              <div class="trace-devtools-toolbar"><span class="trace-devtools-record">●</span><span>⊘</span><span class="trace-devtools-filter">Filter</span><span class="trace-devtools-xhr">Fetch/XHR</span></div>
              <div class="trace-devtools-body">
                <div class="trace-devtools-requests">
                  <div class="trace-devtools-column">Name</div>
                  <div class="trace-devtools-request"><b class="trace-step-marker">1</b><span>example</span></div>
                  <div class="trace-devtools-muted">config</div>
                </div>
                <div class="trace-devtools-detail">
                  <div class="trace-devtools-detail-tabs"><strong><b class="trace-step-marker">2</b>Headers</strong><span>Preview</span><span>Response</span></div>
                  <div class="trace-devtools-section trace-devtools-muted">› General</div>
                  <div class="trace-devtools-section">⌄ Response Headers</div>
                  <div class="trace-devtools-header"><b class="trace-step-marker">3</b><div><strong>traceparent:</strong><code>00-<mark>{{ traceId }}</mark>-{{ spanId }}-01</code></div></div>
                </div>
              </div>
            </div>
            <pre v-else-if="source === 'Device'" class="trace-help-raw"><code>{
  "headers": {
    "traceparent": "00-<mark>{{ traceId }}</mark>-{{ spanId }}-01"
  }
}</code></pre>
            <div v-else class="trace-help-log">
              <div class="trace-help-log-title">{{ t('Tracing.helpLogs') }}<span>POST /api/example</span></div>
              <dl><dt>Trace ID</dt><dd><mark>{{ traceId }}</mark></dd><dt>Span ID</dt><dd><code>{{ spanId }}</code></dd></dl>
            </div>
            <figcaption>{{ t(source === 'Browser' ? 'Tracing.helpChromeExample' : 'Tracing.helpSyntheticExample') }}</figcaption>
          </figure>
          <p class="trace-help-key"><span class="trace-help-key-dot" />{{ t(source === 'Logs' ? 'Tracing.helpTraceIdKey' : 'Tracing.helpTraceparentKey') }}</p>
          <details class="trace-help-more">
            <summary>{{ t('Tracing.helpMore') }}</summary>
            <p v-if="source !== 'Logs'">{{ t('Tracing.helpTraceparentHint') }}</p>
            <p>{{ t('Tracing.helpSpanHint') }}</p>
            <p>{{ t('Tracing.helpMissingContext') }}</p>
          </details>
        </div>
      </template>
      <a-button :ref="element => setTrigger(source, element)" type="link" size="small">{{ t(`Tracing.help${source}`) }}</a-button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sources = ['Browser', 'Device', 'Logs'] as const
type HelpSource = typeof sources[number]
const activeSource = ref<HelpSource>()
const triggers = new Map<HelpSource, HTMLElement>()
// 图示只说明真实数据的获取位置；合成 ID 不提供查询或复制动作。
const traceId = '11111111111111111111111111111111'
const spanId = '2222222222222222'

function setOpen(source: HelpSource, open: boolean) {
  if (open) activeSource.value = source
  else if (activeSource.value === source) close(source)
}
function setTrigger(source: HelpSource, value: unknown) {
  const element = value instanceof HTMLElement ? value : (value as { $el?: unknown } | null)?.$el
  if (element instanceof HTMLElement) triggers.set(source, element)
  else triggers.delete(source)
}
function close(source: HelpSource | undefined = activeSource.value) {
  if (!source || activeSource.value !== source) return
  activeSource.value = undefined
  void nextTick(() => triggers.get(source)?.focus())
}
</script>
<style scoped>
.trace-input-help { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-1,4px); margin-top:var(--space-1,4px); font-size:var(--fs-12,12px); color:var(--ink-3); }
.trace-input-help > :deep(.ant-btn) { font-size:var(--fs-12,12px); padding-inline:4px; }
.trace-help-title { display:flex; justify-content:space-between; align-items:center; gap:var(--space-3,12px); }
.trace-help-title :deep(.ant-btn) { color:var(--ink-3); }
.trace-help-content { width:min(620px,calc(100vw - 56px)); max-width:100%; max-height:calc(100dvh - 160px); overflow:auto; font-size:var(--fs-12,12px); line-height:1.6; overflow-wrap:anywhere; }
.trace-help-steps { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-4,16px); margin:0 0 var(--space-3,12px); padding:0; list-style:none; counter-reset:trace-step; }
.trace-help-steps li { display:flex; gap:6px; align-items:baseline; counter-increment:trace-step; }
.trace-help-steps li::before,.trace-step-marker { display:inline-block; flex-shrink:0; width:18px; line-height:18px; border-radius:50%; text-align:center; font-size:var(--fs-caption,12px); font-weight:500; color:var(--accent); background:var(--accent-soft); }
.trace-help-steps li::before { content:counter(trace-step); }
.trace-help-example { margin:0; }
.trace-help-example figcaption { margin-top:6px; color:var(--ink-3); font-size:var(--fs-caption,12px); }
.trace-devtools { border:1px solid var(--line); border-radius:var(--r-2,6px); overflow:hidden; background:var(--bg); color:var(--ink-2); font:12px/1.5 system-ui,sans-serif; }
.trace-devtools-tabs { display:flex; align-items:center; gap:var(--space-4,16px); height:28px; padding-inline:var(--space-3,12px); background:var(--bg-sunken); border-bottom:1px solid var(--line); }
.trace-devtools-tabs strong { align-self:stretch; display:flex; align-items:center; border-bottom:2px solid var(--accent); color:var(--accent); font-weight:500; }
.trace-devtools-more { margin-inline-start:auto; color:var(--ink-3); }
.trace-devtools-toolbar { display:flex; align-items:center; gap:var(--space-3,12px); height:28px; padding-inline:var(--space-3,12px); border-bottom:1px solid var(--line); }
.trace-devtools-record { color:var(--danger); font-size:var(--fs-body,14px); }
.trace-devtools-filter { width:120px; padding-inline:6px; border:1px solid var(--line); border-radius:var(--r-1,3px); color:var(--ink-3); }
.trace-devtools-xhr { border-radius:var(--r-1,3px); padding-inline:6px; color:var(--accent); background:var(--accent-soft); }
.trace-devtools-body { display:grid; grid-template-columns:120px minmax(0,1fr); }
.trace-devtools-requests { border-inline-end:1px solid var(--line); }
.trace-devtools-column { height:30px; padding:6px 10px; border-bottom:1px solid var(--line); background:var(--bg-sunken); }
.trace-devtools-request { display:flex; gap:6px; align-items:center; padding:6px 8px; color:var(--accent); background:var(--accent-soft); }
.trace-devtools-requests > .trace-devtools-muted { padding:6px 10px; }
.trace-devtools-muted { color:var(--ink-3); }
.trace-devtools-detail { min-width:0; }
.trace-devtools-detail-tabs { display:flex; gap:var(--space-3,12px); align-items:center; min-height:30px; padding-inline:10px; border-bottom:1px solid var(--line); }
.trace-devtools-detail-tabs strong { display:flex; gap:4px; align-items:center; align-self:stretch; color:var(--accent); font-weight:500; border-bottom:2px solid var(--accent); }
.trace-devtools-section { padding:5px 10px; font-weight:600; }
.trace-devtools-header { display:flex; align-items:start; gap:6px; margin:0 8px 6px; padding:6px; border:1px solid var(--accent); border-radius:var(--r-1,3px); background:var(--accent-soft); }
.trace-devtools-header > div { min-width:0; }.trace-devtools-header strong { font-weight:600; }.trace-devtools-header code { display:block; font-size:var(--fs-caption,12px); overflow-wrap:anywhere; }
.trace-help-content mark { padding:0; color:var(--accent); background:transparent; font-weight:600; }
.trace-help-raw,.trace-help-log { margin:0; padding:var(--space-3,12px); border-radius:var(--r-2,6px); background:var(--bg-sunken); }
.trace-help-raw { font-size:var(--fs-caption,12px); white-space:pre-wrap; overflow-wrap:anywhere; }
.trace-help-log-title { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:var(--space-2,8px); font-weight:500; }.trace-help-log-title span { font-size:var(--fs-caption,12px); color:var(--ink-3); font-weight:400; }
.trace-help-log dl { display:grid; grid-template-columns:64px minmax(0,1fr); gap:6px 10px; margin:0; }.trace-help-log dt { color:var(--ink-3); }.trace-help-log dd { min-width:0; margin:0; font-family:var(--font-mono,monospace); }
.trace-help-key { display:flex; align-items:baseline; gap:6px; margin:var(--space-2,8px) 0 0; color:var(--ink-2); }.trace-help-key-dot { width:7px; height:7px; flex-shrink:0; align-self:center; background:var(--accent); border-radius:50%; }
.trace-help-more { margin-top:var(--space-2,8px); color:var(--ink-3); }.trace-help-more summary { cursor:pointer; width:fit-content; }.trace-help-more p { margin:var(--space-1,4px) 0 0; }
@media(max-width:600px) { .trace-devtools-body { grid-template-columns:88px minmax(0,1fr); }.trace-devtools-tabs { gap:10px; }.trace-devtools-detail-tabs { gap:8px; padding-inline:6px; }.trace-help-steps { display:grid; gap:6px; } }
</style>
