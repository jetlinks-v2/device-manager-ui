<template>
  <div class="metric-output-sources">
    <p>{{ t('metricHint') }}</p>
    <label class="output-search"><AIcon type="SearchOutlined" /><input v-model="keyword" type="search" :placeholder="t('searchMetric')" :aria-label="t('searchMetric')" /></label>
    <a-alert v-if="state.metricSources.error.value" type="error" :message="t('failed')" show-icon><template #action><a-button type="link" size="small" @click="state.metricSources.load">{{ t('retry') }}</a-button></template></a-alert>
    <a-spin :spinning="state.metricSources.loading.value">
      <div class="output-options" role="group" :aria-label="t('metrics')">
        <button v-for="item in metrics" :key="`${item.config.id}/${item.output.metricId}`" type="button" :disabled="historyMissing(item)" :aria-pressed="state.request.value?.mapping?.configId === item.config.id && state.request.value?.mapping?.id === item.output.metricId" @click="state.confirmMetric(item, `${objectLabel} / ${outputName(item)}`)">
          <AIcon type="NodeIndexOutlined" /><span class="output-option__copy"><b><span :title="outputName(item)">{{ outputName(item) }}</span><small>{{ item.output.unit }}</small></b><small :title="item.config.name || item.template.name">{{ item.config.name || item.template.name }}</small><small v-if="historyMissing(item)" class="unavailable">{{ t('metricHistoryMissing') }}</small></span><AIcon type="RightOutlined" />
        </button>
        <a-empty v-if="!state.metricSources.loading.value && !state.metricSources.error.value && !metrics.length" :description="t('noMetrics')" :image-style="{ height:'36px' }" />
      </div>
    </a-spin>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { localizedTemplate } from '@jetlinks-web-core/components/Metric/template/text'
import { metricOutputName } from '@jetlinks-web-core/components/Metric/presentation'
import { metricHostMessages } from './messages'
import type { MetricOutputSource } from '../../../api/metricSources'
import type { MetricSourcePickerState } from './useMetricSourcePicker'
const props = defineProps<{ state:MetricSourcePickerState; objectLabel:string }>()
const { t, locale } = useI18n({ useScope:'local', messages:metricHostMessages })
const keyword = ref('')
const outputName = (item:MetricOutputSource) => metricOutputName(item.output, localizedTemplate(item.template, String(locale.value))) || item.output.metricId
const metrics = computed(() => props.state.metricSources.items.value.filter(item => `${outputName(item)} ${item.config.name || item.template.name} ${item.output.metricId}`.toLowerCase().includes(keyword.value.trim().toLowerCase())))
const historyMissing = (item:MetricOutputSource) => !!props.state.request.value?.input.source?.lookback && (!item.output.persist || item.output.latestOnly)
</script>
<style scoped>
.metric-output-sources { display:grid; gap:10px; min-width:0; font-size:12px }
.metric-output-sources p { margin:0; color:var(--ink-3); font-size:11px; line-height:1.6 }
.output-search { display:flex; align-items:center; gap:8px; min-height:32px; border-bottom:1px solid var(--line); color:var(--ink-3) }
.output-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:var(--ink-1); font-size:12px }
.output-search:focus-within { border-color:var(--accent) }
.output-options { display:grid; gap:4px; min-width:0 }
.output-options button { display:flex; align-items:center; gap:10px; padding:10px; border:1px solid transparent; border-radius:var(--r-2,6px); color:var(--ink-2); background:transparent; text-align:left; cursor:pointer; min-width:0 }
.output-options button:hover { background:var(--bg-sunken) }
.output-options button[aria-pressed=true] { color:var(--accent); background:var(--accent-soft); border-color:var(--accent) }
.output-options button:focus-visible { outline:2px solid var(--accent) }
.output-options button>.anticon { flex:none; width:16px; font-size:14px }
.output-option__copy { flex:1; min-width:0; overflow-wrap:anywhere }
.output-options b { display:flex; gap:6px; align-items:baseline; font-weight:500 }
.output-options b>span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.output-options b small { flex:none; margin-left:auto }
.output-option__copy>small:not(.unavailable) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.output-options small { display:block; font-size:11px; color:var(--ink-3); font-weight:400; margin-top:3px }
.output-options button:disabled { opacity:.5; cursor:default }
.output-options .unavailable { color:var(--warning, #bf871a) }
</style>
