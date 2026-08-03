<template>
  <a-drawer
    :open="open"
    class="iot-log-detail-drawer"
    :width="drawerWidth"
    placement="right"
    :closable="false"
    :footer="null"
    :body-style="{ padding: 0 }"
    :header-style="{ display: 'none' }"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <section class="log-detail-panel">
      <header class="log-detail-head">
        <a-button type="text" class="log-detail-close" :aria-label="$t('IotDeviceDetail.logDetail.ariaClose')" @click="emit('update:open', false)">
          <template #icon>
            <AIcon type="CloseOutlined" />
          </template>
        </a-button>
        <h2>{{ $t('IotDeviceDetail.logs.detailTitle') }}</h2>
      </header>

      <main v-if="row" class="log-detail-body">
        <div class="log-detail-summary">
          <span class="log-detail-type">{{ row.typeText }}</span>
          <span class="log-detail-direction" :data-direction="row.direction">
            <AIcon :type="row.direction === 'down' ? 'ArrowDownOutlined' : 'ArrowUpOutlined'" />
            {{ row.direction === 'down' ? $t('IotDeviceDetail.logs.direction.down') : $t('IotDeviceDetail.logs.direction.up') }}
          </span>
          <time>{{ row.happenedAt }}</time>
        </div>

        <section class="log-message-card" :aria-label="$t('IotDeviceDetail.logDetail.messageHeader')">
          <h3>{{ $t('IotDeviceDetail.logDetail.messageHeader') }}</h3>
          <dl>
            <template v-for="item in headerRows" :key="item.key">
              <dt>{{ item.label }}</dt>
              <dd :title="item.value">{{ item.value }}</dd>
            </template>
          </dl>
        </section>

        <section class="log-payload-block" :aria-label="$t('IotDeviceDetail.logDetail.rawPayload')">
          <h3>{{ $t('IotDeviceDetail.logDetail.rawPayload') }}</h3>
          <pre><code v-html="highlightedPayload" /></pre>
        </section>
      </main>
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDevice } from '../../types'

type Dict = Record<string, unknown>

interface LogDetailRow {
  id: string
  typeText: string
  direction: 'up' | 'down'
  message: string
  happenedAt: string
  rawContent: string
  raw: unknown
}

const props = defineProps<{
  open: boolean
  device: IotDevice
  row: LogDetailRow | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const { t: $t } = useI18n()
const drawerWidth = 'min(35rem, 100vw)'

const parsedPayload = computed(() => parsePayload(rawContentValue()))
const payloadText = computed(() => formatPayloadText(parsedPayload.value))
const highlightedPayload = computed(() => highlightJson(payloadText.value))

const headerRows = computed(() => {
  const payload = toDict(parsedPayload.value)
  const raw = toDict(props.row?.raw)
  const headers = toDict(payload?.headers) ?? toDict(raw?.headers)

  return [
    { key: 'messageId', label: 'messageId', value: firstText(headers?.messageId, payload?.messageId, raw?.messageId, raw?.id, props.row?.id) },
    { key: 'deviceId', label: 'deviceId', value: firstText(headers?.deviceId, payload?.deviceId, raw?.deviceId, props.device.id) },
    { key: 'deviceName', label: 'deviceName', value: firstText(headers?.deviceName, payload?.deviceName, raw?.deviceName, props.device.name) },
    { key: 'productId', label: 'productId', value: firstText(headers?.productId, payload?.productId, raw?.productId, props.device.productId, props.device.productKey) },
    { key: 'productName', label: 'productName', value: firstText(headers?.productName, payload?.productName, raw?.productName, props.device.productName) },
    { key: 'timestamp', label: 'timestamp', value: firstText(payload?.timestamp, headers?.timestamp, raw?.timestamp, raw?.createTime) },
    { key: 'protocol', label: 'protocol', value: firstText(headers?.protocol, payload?.protocol, raw?.protocol, props.device.protocol, props.device.accessMode) },
  ]
})

function rawContentValue() {
  if (!props.row) return ''
  return props.row.rawContent || props.row.message || props.row.raw
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatPayloadText(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toDict(value: unknown): Dict | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Dict : undefined
}

function firstText(...values: unknown[]) {
  const value = values.find((item) => item !== undefined && item !== null && String(item) !== '')
  return value === undefined ? '--' : String(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightJson(value: string) {
  const tokenPattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g
  let cursor = 0
  let result = ''

  // v-html 只接收固定 span 包裹的 token；payload 原文统一 escape 后再拼接。
  value.replace(tokenPattern, (match, _stringToken, keySuffix, offset) => {
    result += escapeHtml(value.slice(cursor, offset))
    const tokenClass = resolveTokenClass(match, Boolean(keySuffix))
    result += `<span class="${tokenClass}">${escapeHtml(match)}</span>`
    cursor = offset + match.length
    return match
  })

  return result + escapeHtml(value.slice(cursor))
}

function resolveTokenClass(token: string, isKey: boolean) {
  if (isKey) return 'json-key'
  if (token.startsWith('"')) return 'json-string'
  if (/true|false/.test(token)) return 'json-boolean'
  if (/null/.test(token)) return 'json-null'
  return 'json-number'
}
</script>

<style scoped src="./IotDeviceLogDetailDrawer.css"></style>
