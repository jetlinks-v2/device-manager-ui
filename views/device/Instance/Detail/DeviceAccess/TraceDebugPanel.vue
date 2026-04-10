<template>
  <aside class="trace-debug-panel">
    <div class="trace-debug-panel__head">
      <div class="trace-debug-panel__title-row">
        <ApiOutlined class="trace-debug-panel__icon" aria-hidden="true" />
        <span class="trace-debug-panel__title">{{ $t('InstanceDeviceAccess.traceDebug.title') }}</span>
      </div>
      <p class="trace-debug-panel__sub">
        {{ $t('InstanceDeviceAccess.traceDebug.subtitle') }}
      </p>
    </div>

    <a-alert
      v-if="!isOnline"
      type="warning"
      show-icon
      class="trace-debug-panel__alert"
      :message="$t('InstanceDeviceAccess.traceDebug.offline')"
    />

    <a-segmented
      v-model:value="mode"
      block
      size="small"
      class="trace-debug-panel__mode"
      :options="modeOptions"
    />

    <div class="trace-debug-panel__body">
      <a-empty
        v-if="!hasAnyCapability && isOnline"
        :description="$t('InstanceDeviceAccess.traceDebug.empty')"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />

      <template v-else-if="isOnline">
        <!-- 读属性 -->
        <div v-show="mode === 'read'" class="trace-debug-panel__section">
          <a-form layout="vertical" class="trace-debug-form">
            <a-form-item :label="$t('Function.index.125063-3')">
              <a-select
                v-model:value="readPropertyIds"
                mode="multiple"
                allow-clear
                show-search
                :placeholder="$t('Function.index.125063-3')"
                :options="readPropertyOptions"
                :filter-option="filterPropertyOption"
              />
            </a-form-item>
            <a-button
              type="primary"
              block
              size="small"
              :loading="loading"
              :disabled="!readPropertyIds.length"
              @click="onRead"
            >
              {{ $t('Function.index.125063-6') }}
            </a-button>
          </a-form>
        </div>

        <!-- 写属性 -->
        <div v-show="mode === 'write'" class="trace-debug-panel__section">
          <a-form layout="vertical" class="trace-debug-form">
            <a-form-item :label="$t('Function.index.125063-3')">
              <a-select
                v-model:value="writePropertyId"
                allow-clear
                show-search
                :placeholder="$t('Function.index.125063-3')"
                :options="writePropertyOptions"
                :filter-option="filterPropertyOption"
                @change="onWritePropertyChange"
              />
            </a-form-item>
            <a-form-item
              v-if="selectedWriteProperty"
              :label="$t('Function.index.125063-4')"
              :required="true"
            >
              <j-value-item
                v-model:modelValue="writeValue"
                :item-type="writeValueType"
                :options="writeValueOptions"
              />
            </a-form-item>
            <a-button
              type="primary"
              block
              size="small"
              :loading="loading"
              :disabled="!writePropertyId || writeValue === undefined || writeValue === null"
              @click="onWrite"
            >
              {{ $t('Function.index.125063-6') }}
            </a-button>
          </a-form>
        </div>

        <!-- 功能调用 -->
        <div v-show="mode === 'invoke'" class="trace-debug-panel__section">
          <a-form layout="vertical" class="trace-debug-form">
            <a-form-item :label="$t('Function.index.125063-5')">
              <a-select
                v-model:value="functionId"
                allow-clear
                show-search
                :placeholder="$t('Function.index.125063-5')"
                :options="functionOptions"
                :filter-option="filterPropertyOption"
                @change="onFunctionChange"
              />
            </a-form-item>
            <template v-if="functionId">
              <a-segmented
                v-model:value="invokeInputMode"
                size="small"
                class="trace-debug-panel__invoke-mode"
                :options="invokeModeOptions"
              />
              <template v-if="invokeInputMode === 'form'">
                <div v-if="invokeInputDefs.length" class="trace-debug-panel__inputs-label">
                  {{ $t('Function.index.125063-7') }}
                </div>
                <a-form-item
                  v-for="input in invokeInputDefs"
                  :key="`${functionId}-${input.id}`"
                  :label="input.name ? `${input.name} (${input.id})` : input.id"
                  :required="!!input?.expands?.required"
                >
                  <j-value-item
                    v-model:modelValue="invokeFormValues[input.id]"
                    :item-type="input?.valueType?.type"
                    :options="getValueOptions(input?.valueType)"
                  />
                </a-form-item>
              </template>
              <a-form-item v-else :label="$t('InstanceDeviceAccess.traceDebug.jsonInput')">
                <a-textarea
                  v-model:value="invokeJsonText"
                  :rows="7"
                  :placeholder="$t('InstanceDeviceAccess.traceDebug.jsonInputPlaceholder')"
                />
              </a-form-item>
            </template>
            <a-button
              type="primary"
              block
              size="small"
              :loading="loading"
              :disabled="!functionId"
              @click="onInvoke"
            >
              {{ $t('Function.index.125063-6') }}
            </a-button>
          </a-form>
        </div>
      </template>

      <div v-if="invokeResult" class="trace-debug-result">
        <div class="trace-debug-result__title">{{ $t('InstanceDeviceAccess.traceDebug.resultTitle') }}</div>
        <div v-if="invokeResult.success" class="trace-debug-result__ok">
          <a-tag color="success">{{ $t('InstanceDeviceAccess.952800-21') }}</a-tag>
          <span class="trace-debug-result__ok-time">{{
            `${$t('InstanceDeviceAccess.traceDebug.resultTime')}: ${invokeResult.time}`
          }}</span>
        </div>
        <a-alert
          v-else
          type="error"
          show-icon
          :message="$t('InstanceDeviceAccess.952800-22')"
          :description="`${$t('InstanceDeviceAccess.traceDebug.resultTime')}: ${invokeResult.time}`"
        />
        <div v-if="!invokeResult.success && invokeResult.payload" class="trace-debug-result__payload">
          <pre>{{ invokeResult.payload }}</pre>
        </div>
      </div>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { ApiOutlined } from '@ant-design/icons-vue'
import { Empty, message } from 'ant-design-vue'
import { computed, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  sendDeviceMessage,
} from '../../../../../api/instance'
import { useInstanceStore } from '../../../../../store/instance'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const emit = defineEmits<{
  (e: 'trace-match', traceId: string): void
}>()

const mode = ref<'read' | 'write' | 'invoke'>('read')
const loading = ref(false)

const readPropertyIds = ref<string[]>([])
const writePropertyId = ref<string | undefined>()
const writeValue = ref<any>(undefined)

const functionId = ref<string | undefined>()
const invokeInputMode = ref<'form' | 'json'>('form')
const invokeFormValues = ref<Record<string, any>>({})
const invokeJsonText = ref('')
const invokeResult = ref<{
  success: boolean
  time: string
  traceId?: string
  payload?: string
} | null>(null)
const TRACE_DEBUG_MEMORY_KEY = 'jetlinks:device-trace-debug-memory:v1'

const metadata = computed(() => {
  try {
    return JSON.parse(instanceStore.current?.metadata || '{}') as {
      properties?: any[]
      functions?: any[]
    }
  } catch {
    return {} as { properties?: any[]; functions?: any[] }
  }
})

const isOnline = computed(() => instanceStore.current?.state?.value === 'online')
const currentDeviceId = computed(() => instanceStore.current?.id || '')

const modeOptions = computed(() => [
  { label: $t('Function.index.125063-0'), value: 'read' },
  { label: $t('Function.index.125063-1'), value: 'write' },
  { label: $t('Function.index.125063-2'), value: 'invoke' },
])

const readPropsList = computed(() =>
  (metadata.value.properties || []).filter((p: any) => (p.expands?.type || []).includes('read')),
)

const writePropsList = computed(() =>
  (metadata.value.properties || []).filter((p: any) => (p.expands?.type || []).includes('write')),
)

const readPropertyOptions = computed(() =>
  readPropsList.value.map((p: any) => ({
    value: p.id,
    label: p.name ? `${p.name} (${p.id})` : p.id,
  })),
)

const writePropertyOptions = computed(() =>
  writePropsList.value.map((p: any) => ({
    value: p.id,
    label: p.name ? `${p.name} (${p.id})` : p.id,
  })),
)

const functionList = computed(() => metadata.value.functions || [])

const functionMap = computed(() => {
  const map: Record<string, any> = {}
  functionList.value.forEach((fn: any) => {
    if (fn?.id) map[fn.id] = fn
  })
  return map
})

const functionOptions = computed(() =>
  functionList.value.map((f: any) => ({
    value: f.id,
    label: f.name ? `${f.name} (${f.id})` : f.id,
  })),
)

const invokeModeOptions = computed(() => [
  { label: $t('InstanceDeviceAccess.traceDebug.invokeModeForm'), value: 'form' },
  { label: $t('InstanceDeviceAccess.traceDebug.invokeModeJson'), value: 'json' },
])

const selectedFunction = computed(() =>
  functionId.value ? functionMap.value[functionId.value] : undefined,
)

const invokeInputDefs = computed<any[]>(() => selectedFunction.value?.inputs || [])

const selectedWriteProperty = computed(() =>
  writePropsList.value.find((p: any) => p.id === writePropertyId.value),
)

const writeValueType = computed(
  () => selectedWriteProperty.value?.valueType?.type || selectedWriteProperty.value?.dataType || 'string',
)

const writeValueOptions = computed(() => {
  const p = selectedWriteProperty.value
  const vt = p?.valueType
  const t = vt?.type || p?.dataType
  if (t === 'enum') {
    return (vt?.elements || []).map((item: any) => ({
      label: item?.text,
      value: item?.value,
    }))
  }
  if (t === 'boolean') {
    return [
      { label: vt?.falseText, value: vt?.falseValue },
      { label: vt?.trueText, value: vt?.trueValue },
    ]
  }
  return undefined
})

function getValueOptions(valueType: any) {
  const t = valueType?.type
  if (t === 'enum') {
    return (valueType?.elements || []).map((item: any) => ({
      label: item?.text,
      value: item?.value,
    }))
  }
  if (t === 'boolean') {
    return [
      { label: valueType?.falseText, value: valueType?.falseValue },
      { label: valueType?.trueText, value: valueType?.trueValue },
    ]
  }
  return undefined
}

function defaultValueForInput(input: any): any {
  const dv = input?.valueType?.expands?.defaultValue
  if (dv !== undefined) return dv
  const t = input?.valueType?.type
  if (t === 'boolean') {
    if (input?.valueType?.falseValue !== undefined) return input.valueType.falseValue
    return false
  }
  if (t === 'enum') {
    const first = input?.valueType?.elements?.[0]
    if (first?.value !== undefined) return first.value
  }
  return null
}

function buildInvokePayloadFromForm(includeTemplate = false): Record<string, any> {
  const defs = invokeInputDefs.value || []
  const values = invokeFormValues.value || {}
  const out: Record<string, any> = {}
  for (const input of defs) {
    const has = Object.prototype.hasOwnProperty.call(values, input.id)
    const v = values[input.id]
    if (has && v !== undefined && v !== null && v !== '') {
      out[input.id] = v
      continue
    }
    if (includeTemplate) {
      out[input.id] = defaultValueForInput(input)
    }
  }
  return out
}

function syncInvokeJsonFromForm(includeTemplate = false) {
  if (!functionId.value) {
    invokeJsonText.value = ''
    return
  }
  const payload = buildInvokePayloadFromForm(includeTemplate)
  invokeJsonText.value = JSON.stringify(payload, null, 2)
}

function nowText(): string {
  const d = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function firstHeaderValue(h: any, names: string[]): string | undefined {
  if (!h) return undefined
  if (typeof h.get === 'function') {
    for (const n of names) {
      const v = h.get(n) ?? h.get(n.toLowerCase()) ?? h.get(n.toUpperCase())
      if (v != null && String(v).trim()) return String(v).trim()
    }
  }
  const getByName = (obj: any, name: string) => {
    if (!obj) return undefined
    const exact = obj[name]
    if (exact != null) return exact
    const lower = obj[name.toLowerCase()]
    if (lower != null) return lower
    const upper = obj[name.toUpperCase()]
    if (upper != null) return upper
    return undefined
  }
  for (const n of names) {
    const v = getByName(h, n)
    if (Array.isArray(v)) {
      const merged = v.map((x) => String(x).trim()).filter(Boolean).join(', ')
      if (merged) return merged
      continue
    }
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return undefined
}

function findTraceparentDeep(input: unknown): string | undefined {
  const visited = new Set<unknown>()
  const stack: unknown[] = [input]
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    if (visited.has(cur)) continue
    visited.add(cur)
    const obj = cur as Record<string, unknown>
    const direct = firstHeaderValue(obj, ['traceparent', 'Traceparent', 'trace-parent'])
    if (direct) return direct
    for (const [k, v] of Object.entries(obj)) {
      if (/traceparent/i.test(k) && v != null && String(v).trim()) {
        return String(v).trim()
      }
      if (v && typeof v === 'object') stack.push(v)
    }
  }
  return undefined
}

function findTraceparentFromText(text: string): string | undefined {
  if (!text) return undefined
  const m = /([0-9a-fA-F]{2}-[0-9a-fA-F]{32}-[0-9a-fA-F]{16}-[0-9a-fA-F]{2})/.exec(text)
  return m ? m[1] : undefined
}

function extractTraceparent(resp: any): string | undefined {
  const byHeader =
    firstHeaderValue(resp?.headers, ['traceparent']) ||
    firstHeaderValue(resp?.result?.headers, ['traceparent']) ||
    firstHeaderValue(resp?.response?.headers, ['traceparent']) ||
    firstHeaderValue(resp?.raw?.headers, ['traceparent'])
  if (byHeader) return byHeader

  const byDeep = findTraceparentDeep(resp)
  if (byDeep) return byDeep

  const byText = findTraceparentFromText(safePayloadText(resp))
  if (byText) return byText
  return undefined
}

function traceIdFromTraceparent(traceparent?: string): string | undefined {
  if (!traceparent) return undefined
  const normalized = traceparent.replace(/\s+/g, '')
  const parts = normalized
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const part of parts) {
    const m = /([0-9a-fA-F]{2})-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})/.exec(part)
    if (m) return m[2].toLowerCase()
  }
  return undefined
}

function normalizeTraceId(text?: string): string | undefined {
  if (!text) return undefined
  const pure = String(text).replace(/[^0-9a-fA-F]/g, '')
  if (pure.length === 32) return pure.toLowerCase()
  return undefined
}

function findTraceIdDeep(input: unknown): string | undefined {
  const visited = new Set<unknown>()
  const stack: unknown[] = [input]
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    if (visited.has(cur)) continue
    visited.add(cur)
    const obj = cur as Record<string, unknown>
    const direct = normalizeTraceId(
      firstHeaderValue(obj, ['traceId', 'trace_id', 'trace-id']),
    )
    if (direct) return direct
    for (const [k, v] of Object.entries(obj)) {
      if (/trace[-_]?id/i.test(k)) {
        const fromKey = normalizeTraceId(String(v))
        if (fromKey) return fromKey
      }
      if (v && typeof v === 'object') stack.push(v)
    }
  }
  return undefined
}

function safePayloadText(resp: any): string {
  const payload = resp?.result ?? resp?.data ?? resp
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function setInvokeResult(resp: any, success: boolean) {
  const traceparent = extractTraceparent(resp)
  const traceId = traceIdFromTraceparent(traceparent) || findTraceIdDeep(resp)
  invokeResult.value = {
    success,
    time: nowText(),
    traceId,
    payload: safePayloadText(resp),
  }
  if (traceId) emit('trace-match', traceId)
}

const hasAnyCapability = computed(
  () =>
    readPropsList.value.length > 0 ||
    writePropsList.value.length > 0 ||
    functionList.value.length > 0,
)

const filterPropertyOption = (input: string, option: any) => {
  const q = input.toLowerCase()
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(q)
}

function resetWriteValue() {
  writeValue.value = undefined
}

function onWritePropertyChange() {
  resetWriteValue()
  const p = selectedWriteProperty.value
  if (!p) return
  const t = p?.valueType?.type || p?.dataType
  if (t === 'boolean' && p?.valueType?.falseValue !== undefined) {
    writeValue.value = p.valueType.falseValue
  }
}

function onFunctionChange(val: string | undefined) {
  invokeFormValues.value = {}
  invokeJsonText.value = ''
  invokeInputMode.value = 'form'
  if (!val) return
  const arr = functionMap.value[val]?.inputs || []
  const next: Record<string, any> = {}
  arr.forEach((item: any) => {
    const defaultValue = item?.valueType?.expands?.defaultValue
    if (defaultValue !== undefined) next[item.id] = defaultValue
  })
  invokeFormValues.value = next
  // 首次进入该功能时，自动准备模板 JSON
  syncInvokeJsonFromForm(true)
}

function buildMetadataSignature(): string {
  const props = (metadata.value.properties || [])
    .map((p: any) => {
      const types = Array.isArray(p?.expands?.type) ? [...p.expands.type].sort().join(',') : ''
      return `${p?.id || ''}:${types}:${p?.valueType?.type || p?.dataType || ''}`
    })
    .sort()
    .join('|')
  const funcs = (metadata.value.functions || [])
    .map((fn: any) => {
      const inputs = (fn?.inputs || [])
        .map((i: any) => `${i?.id || ''}:${i?.valueType?.type || ''}`)
        .sort()
        .join(',')
      return `${fn?.id || ''}:${inputs}`
    })
    .sort()
    .join('|')
  return `${props}#${funcs}`
}

const metadataSignature = computed(() => buildMetadataSignature())

function normalizeByCurrentMetadata() {
  const readSet = new Set(readPropsList.value.map((p: any) => String(p.id)))
  const writeSet = new Set(writePropsList.value.map((p: any) => String(p.id)))
  const functionSet = new Set(functionList.value.map((f: any) => String(f.id)))

  const nextReadIds = (readPropertyIds.value || []).filter((id) => readSet.has(String(id)))
  if (nextReadIds.join('|') !== (readPropertyIds.value || []).join('|')) {
    readPropertyIds.value = nextReadIds
  }

  if (!writePropertyId.value || !writeSet.has(String(writePropertyId.value))) {
    writePropertyId.value = undefined
    resetWriteValue()
  }

  if (!functionId.value || !functionSet.has(String(functionId.value))) {
    functionId.value = undefined
    invokeFormValues.value = {}
    invokeJsonText.value = ''
    invokeInputMode.value = 'form'
    return
  }

  const defs = functionMap.value[functionId.value]?.inputs || []
  const allow = new Set(defs.map((d: any) => d.id))
  const current = invokeFormValues.value || {}
  const normalized: Record<string, any> = {}
  Object.keys(current).forEach((k) => {
    if (allow.has(k)) normalized[k] = current[k]
  })
  defs.forEach((item: any) => {
    if (!(item.id in normalized)) {
      const dv = item?.valueType?.expands?.defaultValue
      if (dv !== undefined) normalized[item.id] = dv
    }
  })
  if (JSON.stringify(normalized) !== JSON.stringify(current)) {
    invokeFormValues.value = normalized
  }
}

function loadMemoryForCurrentDevice() {
  const deviceId = currentDeviceId.value
  if (!deviceId) return
  try {
    const raw = localStorage.getItem(TRACE_DEBUG_MEMORY_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as Record<string, any>
    const entry = all?.[deviceId]
    if (!entry) return
    mode.value = ['read', 'write', 'invoke'].includes(entry.mode) ? entry.mode : 'read'
    readPropertyIds.value = Array.isArray(entry.readPropertyIds) ? entry.readPropertyIds : []
    writePropertyId.value = entry.writePropertyId || undefined
    writeValue.value = entry.writeValue
    functionId.value = entry.functionId || undefined
    invokeInputMode.value = entry.invokeInputMode === 'json' ? 'json' : 'form'
    invokeJsonText.value = typeof entry.invokeJsonText === 'string' ? entry.invokeJsonText : ''
    if (entry.invokeFormValues && typeof entry.invokeFormValues === 'object') {
      invokeFormValues.value = entry.invokeFormValues
    } else if (Array.isArray(entry.functionInputs)) {
      // 兼容旧版本缓存结构
      const legacy: Record<string, any> = {}
      entry.functionInputs.forEach((item: any) => {
        if (item?.id) legacy[item.id] = item.value
      })
      invokeFormValues.value = legacy
    } else {
      invokeFormValues.value = {}
    }
    normalizeByCurrentMetadata()
  } catch {
    // ignore corrupted local memory
  }
}

function saveMemoryForCurrentDevice() {
  const deviceId = currentDeviceId.value
  if (!deviceId) return
  try {
    const raw = localStorage.getItem(TRACE_DEBUG_MEMORY_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, any>) : {}
    all[deviceId] = {
      mode: mode.value,
      readPropertyIds: [...readPropertyIds.value],
      writePropertyId: writePropertyId.value,
      writeValue: toRaw(writeValue.value),
      functionId: functionId.value,
      invokeInputMode: invokeInputMode.value,
      invokeFormValues: toRaw(invokeFormValues.value || {}),
      invokeJsonText: invokeJsonText.value,
      metadataSignature: metadataSignature.value,
      updatedAt: Date.now(),
    }
    localStorage.setItem(TRACE_DEBUG_MEMORY_KEY, JSON.stringify(all))
  } catch {
    // ignore localStorage write errors
  }
}

watch(
  [currentDeviceId, metadataSignature],
  () => {
    loadMemoryForCurrentDevice()
    normalizeByCurrentMetadata()
    if (functionId.value && !invokeJsonText.value.trim()) {
      syncInvokeJsonFromForm(true)
    }
  },
  { immediate: true },
)

watch(
  invokeInputMode,
  (v, prev) => {
    if (v === 'json' && prev !== 'json') {
      // 切到 JSON 时自动按当前表单回填
      syncInvokeJsonFromForm(true)
    }
  },
)

watch(
  [
    mode,
    readPropertyIds,
    writePropertyId,
    writeValue,
    functionId,
    invokeInputMode,
    invokeFormValues,
    invokeJsonText,
    currentDeviceId,
  ],
  () => {
    saveMemoryForCurrentDevice()
  },
  { deep: true },
)

const deviceId = () => instanceStore.current?.id || ''

async function onRead() {
  if (!readPropertyIds.value.length) return
  loading.value = true
  try {
    const resp: any = await sendDeviceMessage(deviceId(), {
      deviceId: deviceId(),
      messageType: 'READ_PROPERTY',
      properties: [...readPropertyIds.value],
    })
    if (resp?.status === 200 || resp?.success === true) {
      onlyMessage($t('InstanceDeviceAccess.traceDebug.success'))
    }
    setInvokeResult(resp, resp?.status === 200 || resp?.success === true)
  } finally {
    loading.value = false
  }
}

async function onWrite() {
  if (!writePropertyId.value) return
  loading.value = true
  try {
    const resp: any = await sendDeviceMessage(deviceId(), {
      deviceId: deviceId(),
      messageType: 'WRITE_PROPERTY',
      properties: {
        [writePropertyId.value]: toRaw(writeValue.value),
      },
    })
    if (resp?.status === 200 || resp?.success === true) {
      onlyMessage($t('InstanceDeviceAccess.traceDebug.success'))
    }
    setInvokeResult(resp, resp?.status === 200 || resp?.success === true)
  } finally {
    loading.value = false
  }
}

async function onInvoke() {
  if (!functionId.value) return
  let obj: Record<string, any> = {}
  if (invokeInputMode.value === 'json') {
    const text = (invokeJsonText.value || '').trim()
    if (text) {
      try {
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          message.error($t('InstanceDeviceAccess.traceDebug.jsonInputInvalid'))
          return
        }
        obj = parsed as Record<string, any>
      } catch {
        message.error($t('InstanceDeviceAccess.traceDebug.jsonInputInvalid'))
        return
      }
    }
  } else {
    for (const input of invokeInputDefs.value || []) {
      const v = invokeFormValues.value?.[input.id]
      if (input?.expands?.required && (v === undefined || v === null || v === '')) {
        message.error(`${$t('Function.index.125063-7')}: ${input.name || input.id}`)
        return
      }
    }
    obj = buildInvokePayloadFromForm(false)
  }
  loading.value = true
  try {
    const resp: any = await sendDeviceMessage(deviceId(), {
      deviceId: deviceId(),
      messageType: 'INVOKE_FUNCTION',
      functionId: functionId.value,
      inputs: { ...obj },
    })
    if (resp?.status === 200 || resp?.success === true) {
      onlyMessage($t('InstanceDeviceAccess.traceDebug.success'))
    }
    setInvokeResult(resp, resp?.status === 200 || resp?.success === true)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.trace-debug-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  padding: 10px 10px 12px;
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  border-radius: 10px;
  background: linear-gradient(
    165deg,
    rgba(22, 119, 255, 0.04) 0%,
    var(--ant-color-bg-container, #fff) 42%
  );
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.trace-debug-panel__head {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.trace-debug-panel__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.trace-debug-panel__icon {
  font-size: 16px;
  color: rgba(22, 119, 255, 0.85);
}

.trace-debug-panel__title {
  font-weight: 600;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.35;
}

.trace-debug-panel__sub {
  margin: 4px 0 0;
  padding-left: 22px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.45);
}

.trace-debug-panel__alert {
  margin-bottom: 8px;
  font-size: 12px;
}

.trace-debug-panel__mode {
  margin-bottom: 10px;

  :deep(.ant-segmented) {
    font-size: 11px;
  }
}

.trace-debug-panel__body {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.trace-debug-panel__section {
  padding-bottom: 4px;
}

.trace-debug-form {
  :deep(.ant-form-item) {
    margin-bottom: 10px;
  }

  :deep(.ant-form-item-label) {
    padding-bottom: 2px;
  }

  :deep(label) {
    font-size: 12px;
  }
}

.trace-debug-panel__inputs-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.trace-debug-panel__invoke-mode {
  margin: 2px 0 10px;
}

.trace-debug-result {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(0, 0, 0, 0.12);
}

.trace-debug-result__title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.78);
}

.trace-debug-result__ok {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  padding: 2px 0;
}

.trace-debug-result__ok-time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.trace-debug-result__payload {
  margin-top: 6px;

  pre {
    margin: 0;
    max-height: 160px;
    overflow: auto;
    padding: 8px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.02);
    font-size: 11px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

:deep(.trace-debug-panel__body .ant-empty) {
  margin: 16px 0;
}
</style>
