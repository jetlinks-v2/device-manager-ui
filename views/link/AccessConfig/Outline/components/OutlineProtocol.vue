<template>
  <div class="gateway-outline-protocol">
    <div v-if="showDocument && document.document" class="gateway-outline-protocol__document">
      <JMarkdown :source="document.document" />
    </div>
    <template v-if="rows.length">
      <h4>{{ topic ? t('GatewayOutline.topicInfo') : t('DeviceAccess.index.594346-17') }}</h4>
      <a-table :columns="columns" :data-source="rows" :pagination="false" row-key="key" size="small" :scroll="{ x: 720 }">
        <template #bodyCell="{ column, record }">
          <template v-if="typeof column.dataIndex === 'string'">
            <code v-if="['topic', 'address', 'example'].includes(column.dataIndex)">{{ displayOutlineValue(record[column.dataIndex], t) }}</code>
            <template v-else-if="column.dataIndex === 'stream'">{{ stream(record) }}</template>
            <template v-else>{{ displayOutlineValue(record[column.dataIndex], t) }}</template>
          </template>
        </template>
      </a-table>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { displayOutlineValue } from '../outlineSections'
import type { ProtocolDocument, ProtocolRoute } from '../types'
defineOptions({ name: 'GatewayOutlineProtocol' })
const props = defineProps({
  document: { type: Object as PropType<ProtocolDocument>, required: true },
  showDocument: { type: Boolean, default: true },
})
const { t } = useI18n()
const topic = computed(() => props.document.id === 'MQTT' || !!props.document.routes?.some(item => item.topic && !item.address))
/** 只合并连续相同分组，避免不连续的路由被错误跨行合并。 */
const rows = computed(() => {
  const routes = props.document.routes || []
  return routes.map((route, index) => {
    let span = 1
    if (route.group && index > 0 && routes[index - 1].group === route.group) span = 0
    else if (route.group) while (routes[index + span]?.group === route.group) span++
    return { ...route, key: String(index), span }
  })
})
const columns = computed(() => [
  { title: t('DeviceAccess.index.594346-28'), dataIndex: 'group', width: 110, customCell: (record: { span: number }) => ({ rowSpan: record.span }) },
  { title: topic.value ? t('GatewayOutline.topic') : t('DeviceAccess.index.594346-24'), dataIndex: topic.value ? 'topic' : 'address', width: 250 },
  ...(rows.value.some(item => item.example !== undefined) ? [{ title: t('DeviceAccess.index.594346-25'), dataIndex: 'example', width: 210 }] : []),
  ...(topic.value && rows.value.some(item => item.upstream !== undefined || item.downstream !== undefined) ? [{ title: t('DeviceAccess.index.594346-22'), dataIndex: 'stream', width: 100 }] : []),
  { title: t('DeviceAccess.index.594346-23'), dataIndex: 'description', width: 200 },
])
/** 上下行标识保留后端语义，缺项不推断成某个方向。 */
const stream = (route: ProtocolRoute) => [route.upstream ? t('DeviceAccess.index.594346-26') : '', route.downstream ? t('DeviceAccess.index.594346-27') : ''].filter(Boolean).join('、') || t('GatewayEditor.unconfigured')
</script>
<style scoped>
.gateway-outline-protocol { min-width: 0; max-width: 100%; margin-top: var(--space-4); }
.gateway-outline-protocol h4 { font-size: var(--fs-12); font-weight: 600; margin-bottom: var(--space-2); }
.gateway-outline-protocol code { white-space: pre-wrap; overflow-wrap: anywhere; font-size: var(--fs-12); }
.gateway-outline-protocol :deep(.ant-table-cell) { overflow-wrap: anywhere; }
.gateway-outline-protocol__document { min-width: 0; max-width: 100%; overflow-wrap: anywhere; font-size: var(--fs-12); }
.gateway-outline-protocol__document :deep(pre) { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; }
.gateway-outline-protocol__document :deep(pre code) { white-space: inherit; }
.gateway-outline-protocol__document :deep(table) { display: block; max-width: 100%; overflow-x: auto; }
.gateway-outline-protocol__document :deep(img) { max-width: 100%; height: auto; }
.gateway-outline-protocol__document :deep(h1), .gateway-outline-protocol__document :deep(h2), .gateway-outline-protocol__document :deep(h3) { font-size: var(--fs-14); margin-block: var(--space-4) var(--space-2); }
</style>
