import { computed, ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { onlyMessage } from '@jetlinks-web/utils'
import { formatApiTime, iotDeviceDetailRealApi, type DevicePropertyValue } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import type { PropertyWriteValue } from './IotDevicePropertyWriteModal.vue'

type Options = {
  deviceId: () => string
  onValue: (value: DevicePropertyValue) => void
}

const $t = i18n.global.t

export function useIotDevicePropertyOperation(options: Options) {
  const selectedProperty = ref<RealtimePropertyRow | null>(null)
  const readOpen = ref(false)
  const writeOpen = ref(false)
  const reading = ref(false)
  const writing = ref(false)

  const selectedTone = computed(() => {
    if (selectedProperty.value?.tone === 'critical') return 'danger'
    if (selectedProperty.value?.tone === 'warning') return 'warning'
    if (selectedProperty.value?.tone === 'normal') return 'success'
    return 'primary'
  })

  function openRead(item: RealtimePropertyRow) {
    if (!canReadProperty(item)) return
    selectedProperty.value = item
    readOpen.value = true
  }

  function openWrite(item: RealtimePropertyRow) {
    if (!canWriteProperty(item)) return
    selectedProperty.value = item
    writeOpen.value = true
  }

  async function readSelectedProperty() {
    const property = selectedProperty.value
    if (!property || !options.deviceId()) return
    reading.value = true
    try {
      const resp: { result?: unknown } = await iotDeviceDetailRealApi.readProperty(options.deviceId(), property.identifier)
      const nextValue = normalizePropertyValue(property, resp?.result)
      selectedProperty.value = {
        ...property,
        value: String(nextValue.value ?? property.value ?? '--'),
        unit: nextValue.unit ?? property.unit,
        updatedAt: nextValue.timeString ?? property.updatedAt,
        tone: 'normal',
      }
      options.onValue(nextValue)
      onlyMessage($t('IotDeviceDetail.propertyOperation.readSuccess', { name: property.name }))
    } finally {
      reading.value = false
    }
  }

  async function writeSelectedProperty(value: PropertyWriteValue) {
    const property = selectedProperty.value
    if (!property || !options.deviceId()) return
    writing.value = true
    try {
      await iotDeviceDetailRealApi.setProperty(options.deviceId(), { [property.identifier]: value })
      options.onValue(normalizePropertyValue(property, value))
      onlyMessage($t('IotDeviceDetail.propertyOperation.writeSuccess', { name: property.name }))
      writeOpen.value = false
    } finally {
      writing.value = false
    }
  }

  return {
    selectedProperty,
    selectedTone,
    readOpen,
    writeOpen,
    reading,
    writing,
    openRead,
    openWrite,
    readSelectedProperty,
    writeSelectedProperty,
  }
}

function normalizePropertyValue(item: RealtimePropertyRow, value: unknown): DevicePropertyValue {
  const source = normalizePropertyValueSource(value)
  const nextValue = source?.formatValue ?? source?.value ?? value ?? item.value
  const timestamp = source?.timestamp ?? source?.createTime ?? Date.now()
  return {
    ...source,
    property: item.identifier,
    value: nextValue,
    formatValue: source?.formatValue ?? nextValue,
    timestamp,
    timeString: formatApiTime(timestamp),
  } as DevicePropertyValue
}

function normalizePropertyValueSource(value: unknown): Partial<DevicePropertyValue> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as { value?: unknown }
  if (source.value && typeof source.value === 'object') return source.value as Partial<DevicePropertyValue>
  return value as Partial<DevicePropertyValue>
}

function canReadProperty(item: RealtimePropertyRow) {
  return item.accessMode === 'read' || item.accessMode === 'readwrite'
}

function canWriteProperty(item: RealtimePropertyRow) {
  return item.accessMode === 'write' || item.accessMode === 'readwrite'
}
