<template>
  <section v-if="issues.length" class="node-bottleneck-hints" :aria-label="t('RuntimeMonitor.bottleneck.title')">
    <ul>
      <li v-for="issue in shown" :key="issue.key" :class="{ 'node-bottleneck-hint--retained': issue.retained }">
        <WarningOutlined aria-hidden="true" />
        <span class="node-bottleneck-message">{{ t(issue.message, issue.values ?? {}) }}<small v-if="issue.retained">{{ t('RuntimeMonitor.bottleneck.retained') }}</small></span>
        <a-button v-if="canOpen(issue)" size="small" type="link" @click="emit('inspect', issue.target)">{{ t(action(issue)) }}<ArrowRightOutlined /></a-button>
      </li>
    </ul>
    <a-button v-if="issues.length > 3" class="node-bottleneck-more" size="small" type="text" @click="expanded = !expanded">{{ t(expanded ? 'RuntimeMonitor.bottleneck.less' : 'RuntimeMonitor.bottleneck.more', { count: issues.length - 3 }) }}<DownOutlined :rotate="expanded ? 180 : 0" /></a-button>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { ArrowRightOutlined, DownOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { Bottleneck } from './bottleneckRules'
const props = defineProps({ issues: { type: Array as PropType<Bottleneck[]>, default: () => [] }, access: { type: Object as PropType<{ jvm: boolean; monitor: boolean; query: boolean }>, required: true } })
const emit = defineEmits<{ (event: 'inspect', target: Bottleneck['target']): void }>()
const { t } = useI18n(), expanded = ref(false)
const shown = computed(() => expanded.value ? props.issues : props.issues.slice(0, 3))
function canOpen(issue: Bottleneck) { return issue.target.tool === 'mbean' ? props.access.monitor : issue.target.tool === 'jvm' ? props.access.jvm : props.access.query }
function action(issue: Bottleneck) { return `RuntimeMonitor.bottleneck.${issue.target.kind === 'cache' ? 'inspectCache' : issue.target.tool === 'mbean' ? 'inspectQueue' : issue.target.tool === 'jvm' ? 'inspectJvm' : 'inspectResource'}` }
</script>
<style scoped>
.node-bottleneck-hints { margin-block:var(--space-3,12px); padding:var(--space-2,8px) var(--space-3,12px); border-inline-start:2px solid var(--ant-color-warning,#faad14); background:var(--ant-color-warning-bg,#fffbe6); border-radius:var(--radius-sm,4px); }
.node-bottleneck-hints ul { list-style:none; padding:0; margin:0; }
.node-bottleneck-hints li { display:flex; align-items:baseline; gap:var(--space-2,8px); min-width:0; font-size:13px; line-height:24px; }
.node-bottleneck-hints li > :deep(.anticon) { flex:none; color:var(--ant-color-warning,#faad14); }
.node-bottleneck-message { flex:1; min-width:0; overflow-wrap:anywhere; }
.node-bottleneck-message small { margin-inline-start:var(--space-2,8px); color:var(--ink-3); font-size:12px; white-space:nowrap; }
.node-bottleneck-hints li > :deep(.ant-btn) { flex:none; padding-inline:0; height:24px; font-size:12px; }
.node-bottleneck-hint--retained { color:var(--ink-2); }
.node-bottleneck-more { height:24px; padding-inline:0; font-size:12px; }
</style>
