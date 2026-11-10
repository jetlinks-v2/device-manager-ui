<template>
  <div v-if="!isAgent" class="gateway-protocol-info">
          <div v-if="config.document" class="gateway-protocol-info__document">
            <JMarkdown :source="config.document" />
          </div>
          <div v-if="config.routes && config.routes.length > 0">
            <h1>
              {{
                data.provider === 'mqtt-server-gateway' || data.provider === 'mqtt-client-gateway'
                  ? 'topic'
                  : $t('Network.index.041705-15')
              }}
            </h1>
            <a-table
              :pagination="false"
              :rowKey="generateUUID()"
              :data-source="config.routes || []"
              bordered
              :scroll="{ x: 600, y: 320 }"
              :columns="config.id === 'MQTT' ? columnsMQTT : columnsHTTP"
            >
              <template #bodyCell="{ column, text, record }">
                <template v-if="column.dataIndex === 'stream'">
                  {{ getStream(record) }}
                </template>
              </template>
            </a-table>
          </div>
  </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import type { useNetworkEditor } from './useNetworkEditor'
const { editor } = defineProps<{ editor: ReturnType<typeof useNetworkEditor> }>()
const { $t, generateUUID, isAgent, config, columnsMQTT, columnsHTTP, getStream } = editor
const { data } = toRefs(editor.props)
</script>
<style scoped>
.gateway-protocol-info { min-width: 0; max-width: 100%; font-size: var(--fs-12); overflow-wrap: anywhere; }
.gateway-protocol-info__document { min-width: 0; max-width: 100%; }
.gateway-protocol-info__document :deep(pre) { max-width: 100%; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
.gateway-protocol-info__document :deep(pre code) { white-space: inherit; word-break: normal; overflow-wrap: inherit; }
.gateway-protocol-info__document :deep(table) { display: block; max-width: 100%; overflow-x: auto; }
.gateway-protocol-info__document :deep(img) { max-width: 100%; height: auto; }
.gateway-protocol-info :deep(table) { font-size: var(--fs-12); }
.gateway-protocol-info :deep(.ant-table-wrapper) { min-width: 0; max-width: 100%; }
.gateway-protocol-info :deep(.ant-table-cell) { white-space: normal; overflow-wrap: anywhere; }
.gateway-protocol-info h1 { font-size: var(--fs-12); font-weight: 600; margin-block: var(--space-3) var(--space-2); }
</style>
