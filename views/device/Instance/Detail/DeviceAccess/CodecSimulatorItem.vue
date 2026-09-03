<template>
  <div :class="['codec-simulator-item', type]">
    <div class="codec-simulator-item__header">
      <div class="codec-simulator-item__main">
        <a-tag :color="type === 'uplink' ? 'blue' : 'purple'">
          {{ type === 'uplink' ? $t('InstanceDeviceAccess.codecDebug.uplinkTag') : $t('InstanceDeviceAccess.codecDebug.downlinkTag') }}
        </a-tag>
        <template v-if="type === 'uplink'">
          <a-input v-model:value="model.topic" class="codec-simulator-item__topic" :placeholder="$t('InstanceDeviceAccess.codecDebug.topicPlaceholder')" />
          <a-select v-model:value="model.encoding" :options="encodingOptions" size="small" class="codec-simulator-item__select-sm" />
          <a-select v-model:value="model.qos" :options="qosOptions" size="small" class="codec-simulator-item__select-sm" />
        </template>
        <template v-else>
          <a-select v-model:value="model.commandType" :options="commandTypeOptions" size="small" class="codec-simulator-item__select-md" />
          <a-select
            v-model:value="model.commandId"
            :options="commandOptions"
            size="small"
            show-search
            :disabled="!commandOptions.length"
            :placeholder="commandOptions.length ? $t('InstanceDeviceAccess.codecDebug.commandPlaceholder') : $t('InstanceDeviceAccess.codecDebug.noCommand')"
            :filter-option="filterOption"
            class="codec-simulator-item__select-lg"
          />
        </template>
      </div>
      <a-space class="codec-simulator-item__actions">
        <AIcon type="ArrowUpOutlined" @click="emit('moveUp')" />
        <AIcon type="ArrowDownOutlined" @click="emit('moveDown')" />
        <AIcon type="DeleteOutlined" class="codec-simulator-item__delete" @click="emit('delete')" />
      </a-space>
    </div>

    <div class="codec-simulator-item__body">
      <div class="codec-simulator-item__label">
        {{ type === 'uplink' ? $t('InstanceDeviceAccess.codecDebug.deviceMessageSource') : $t('InstanceDeviceAccess.codecDebug.platformParamSource') }}
      </div>
      <div class="codec-simulator-item__editor">
        <a-textarea
          v-if="model.encoding === 'Hex' && type === 'uplink'"
          :value="model.payload"
          :rows="5"
          class="codec-simulator-item__textarea"
          :placeholder="$t('InstanceDeviceAccess.codecDebug.hexPlaceholder')"
          @input="onHexInput"
        />
        <div v-else-if="isReadOnlyParam" class="codec-simulator-item__readonly">
          {{ $t('InstanceDeviceAccess.codecDebug.readNoParams') }}
        </div>
        <a-table
          v-else-if="isDownlinkTableMode"
          size="small"
          :columns="tableColumns"
          :data-source="tableRows"
          :pagination="false"
          rowKey="key"
          class="codec-simulator-item__table"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.dataIndex === 'property'">
              <span>{{ record.property || '--' }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'value'">
              <j-value-item
                valueFormat="YYYY-MM-DD HH:mm:ss"
                :modelValue="record.value"
                :itemType="record.itemType"
                :options="record.options"
                style="width: 100%"
                @update:modelValue="(value) => onParamValueInput(index, value)"
              />
            </template>
          </template>
        </a-table>
        <a-textarea
          v-else
          v-model:value="model.payload"
          :rows="5"
          class="codec-simulator-item__textarea"
          :placeholder="type === 'uplink' ? $t('InstanceDeviceAccess.codecDebug.payloadPlaceholder') : $t('InstanceDeviceAccess.codecDebug.paramsPlaceholder')"
        />
        <div class="codec-simulator-item__footer">
          <span>{{ byteCount }} Bytes</span>
          <a-button type="primary" size="small" @click="handleSend">
            <template #icon><AIcon type="SendOutlined" /></template>
            {{ $t('InstanceDeviceAccess.codecDebug.sendShort') }}
          </a-button>
        </div>
      </div>

      <div class="codec-simulator-item__arrow">
        <AIcon type="DownOutlined" />
      </div>

      <div v-if="model.isExecuted" class="codec-simulator-item__target">
        <div class="codec-simulator-item__label">
          {{ type === 'uplink' ? $t('InstanceDeviceAccess.codecDebug.platformTarget') : $t('InstanceDeviceAccess.codecDebug.deviceTarget') }}
        </div>
        <pre>{{ targetResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInstanceStore } from '../../../../../store/instance'
import { safeParseMetadata } from './composables/useCodecSimulator'
import type { MetadataModel, MetadataValueType, SimulationItem, SimulatorType } from './codecSimulatorTypes'
import './CodecSimulatorItem.less'

const props = defineProps<{
  type: SimulatorType
  modelValue: SimulationItem
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SimulationItem): void
  (e: 'delete'): void
  (e: 'send', value: SimulationItem): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
}>()

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const model = reactive<SimulationItem>({ ...props.modelValue, isExecuted: !!props.modelValue.result })

const encodingOptions = [
  { label: 'Hex', value: 'Hex' },
  { label: 'JSON', value: 'JSON' },
  { label: 'Text', value: 'Text' },
]
const qosOptions = [0, 1, 2].map((value) => ({ label: `QoS ${value}`, value }))
const commandTypeOptions = computed(() => [
  { label: $t('InstanceDeviceAccess.codecDebug.readProperty'), value: 'read' },
  { label: $t('InstanceDeviceAccess.codecDebug.writeProperty'), value: 'write' },
  { label: $t('InstanceDeviceAccess.codecDebug.invokeFunction'), value: 'invoke' },
])
const tableColumns = computed(() => [
  { title: $t('InstanceDeviceAccess.codecDebug.property'), dataIndex: 'property', key: 'property', width: 200, ellipsis: true },
  { title: $t('InstanceDeviceAccess.codecDebug.value'), dataIndex: 'value', key: 'value' },
])

const metadataModel = computed<MetadataModel>(() => {
  const deviceMetadata = safeParseMetadata(instanceStore.current?.metadata)
  const hasDeviceModel = !!((deviceMetadata.properties?.length || 0) + (deviceMetadata.functions?.length || 0))
  return hasDeviceModel ? deviceMetadata : safeParseMetadata(instanceStore.current?.productMetadata || '{}')
})

const getPropertyActionTypes = (item: any) => {
  if (Array.isArray(item.expands?.type)) return item.expands.type
  return item.expands?.type ? [item.expands.type] : []
}

const commandOptions = computed(() => {
  if (model.commandType === 'invoke') {
    return (metadataModel.value.functions || []).map((item) => ({
      label: `${item.name || item.id} (${item.id})`,
      value: item.id,
    }))
  }
  return (metadataModel.value.properties || [])
    .filter((item) => getPropertyActionTypes(item).includes(model.commandType))
    .map((item) => ({ label: `${item.name || item.id} (${item.id})`, value: item.id }))
})

const tableRows = ref<any[]>([])
const isReadOnlyParam = computed(() => props.type === 'downlink' && model.commandType === 'read')
const isDownlinkTableMode = computed(() => props.type === 'downlink' && !isReadOnlyParam.value)
const byteCount = computed(() => new Blob([model.payload || '']).size)
const targetResult = computed(() => (props.type === 'downlink' ? formatHexText(model.result) : model.result) || $t('InstanceDeviceAccess.codecDebug.waitingResult'))

const filterOption = (input: string, option: any) =>
  String(option?.label || '').toLowerCase().includes(input.toLowerCase())

const normalizeItemType = (type?: string) => String(type || 'string').toLowerCase()
const getValueTypeOptions = (valueType?: MetadataValueType) => {
  if (normalizeItemType(valueType?.type) === 'enum') {
    return (valueType?.elements || []).map((item) => ({ label: item?.text ?? String(item?.value ?? ''), value: item?.value }))
  }
  if (normalizeItemType(valueType?.type) === 'boolean') {
    return [
      { label: valueType?.falseText ?? 'false', value: valueType?.falseValue ?? false },
      { label: valueType?.trueText ?? 'true', value: valueType?.trueValue ?? true },
    ]
  }
  return []
}
const parseTextPayload = (payload: unknown) => {
  if (payload === undefined || payload === null) return undefined
  if (typeof payload === 'object') return payload
  try {
    return JSON.parse(String(payload).trim())
  } catch {
    return String(payload || '')
  }
}
const toPayloadText = (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''))

const rebuildTableRows = () => {
  if (props.type !== 'downlink' || isReadOnlyParam.value) {
    tableRows.value = []
    return
  }
  const parsed = parseTextPayload(model.payload)
  if (model.commandType === 'write') {
    const property = (metadataModel.value.properties || []).find((item) => item.id === model.commandId)
    tableRows.value = [{
      key: model.commandId || 'property',
      property: model.commandId || '--',
      value: parsed,
      itemType: normalizeItemType(property?.valueType?.type),
      options: getValueTypeOptions(property?.valueType),
    }]
    return
  }
  const inputs = (metadataModel.value.functions || []).find((item) => item.id === model.commandId)?.inputs || []
  const valueMap = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  tableRows.value = inputs.map((input, index) => {
    const name = String(input?.id || input?.name || `arg${index + 1}`)
    return {
      key: `${name}-${index}`,
      property: name,
      value: valueMap[name],
      itemType: normalizeItemType(input?.valueType?.type),
      options: getValueTypeOptions(input?.valueType),
    }
  })
}

const syncPayloadFromTable = () => {
  if (props.type !== 'downlink') return
  if (model.commandType === 'write') {
    model.payload = toPayloadText(tableRows.value[0]?.value)
    return
  }
  const payload: Record<string, unknown> = {}
  tableRows.value.forEach((row) => {
    if (row.property) payload[row.property] = row.value
  })
  model.payload = Object.keys(payload).length ? JSON.stringify(payload) : ''
}

const onParamValueInput = (index: number, value: unknown) => {
  if (!tableRows.value[index]) return
  tableRows.value[index].value = value
  syncPayloadFromTable()
}

const onHexInput = (e: any) => {
  const clean = e.target.value.replace(/[^0-9a-fA-F]/g, '')
  model.payload = clean.replace(/(.{2})(?=.)/g, '$1 ').toUpperCase()
}

const formatHexText = (value: unknown) => {
  const pureHex = String(value || '').trim().replace(/\s+/g, '')
  return pureHex && !/[^0-9a-fA-F]/.test(pureHex) ? pureHex.replace(/(.{2})(?=.)/g, '$1 ').toUpperCase() : String(value || '')
}

const handleSend = () => {
  model.isExecuted = true
  emit('send', model)
}

watch(model, (val) => emit('update:modelValue', { ...val }), { deep: true })
watch(
  () => [model.commandType, commandOptions.value],
  () => {
    if (props.type !== 'downlink') return
    const values = commandOptions.value.map((item) => item.value)
    if (!values.length) model.commandId = undefined
    else if (!model.commandId || !values.includes(model.commandId)) model.commandId = values[0]
  },
  { immediate: true, deep: true },
)
watch(() => [props.type, model.commandType, model.commandId, model.payload, metadataModel.value], rebuildTableRows, { immediate: true, deep: true })
</script>
