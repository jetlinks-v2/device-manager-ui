<template>
  <section class="threshold-tab" :aria-label="$t('IotDeviceDetail.threshold.aria')">
    <header class="threshold-head">
      <div>
        <AIcon type="WarningOutlined" aria-hidden="true" />
        <h3>{{ $t('IotDeviceDetail.threshold.title') }}</h3>
        <span>{{ $t('IotDeviceDetail.common.itemCount', { count: rows.length }) }}</span>
      </div>
    </header>

    <div v-if="hintText" class="threshold-hint">
      {{ hintText }}
    </div>

    <div v-if="rows.length" class="threshold-cards">
      <article v-for="row in rows" :key="row.propertyId" class="threshold-card" :data-source="row.source">
        <header class="threshold-card__head">
          <div>
            <strong>{{ row.propertyName }}</strong>
            <span>{{ row.propertyId }}</span>
          </div>
          <div class="threshold-card__badges">
            <span class="threshold-pill" :data-state="row.configured ? 'configured' : 'empty'">
              {{ row.configured ? $t('IotDeviceDetail.common.configured') : $t('IotDeviceDetail.common.unconfigured') }}
            </span>
            <span class="threshold-pill">{{ sourceLabel(row.source) }}</span>
          </div>
        </header>

        <dl class="threshold-card__meta">
          <div>
            <dt>{{ $t('IotDeviceDetail.threshold.dataType') }}</dt>
            <dd>{{ row.dataType || '-' }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceDetail.threshold.range') }}</dt>
            <dd>{{ thresholdText(row) }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceDetail.threshold.mode') }}</dt>
            <dd>{{ modeText(row.mode) }}</dd>
          </div>
          <div>
            <dt>{{ $t('IotDeviceDetail.threshold.descriptionLabel') }}</dt>
            <dd>{{ row.description || $t('IotDeviceDetail.threshold.noDescription') }}</dd>
          </div>
        </dl>

      </article>
    </div>

    <CloudEmpty v-else class="threshold-empty">
      <template #description>
        <strong>{{ $t('IotDeviceDetail.threshold.emptyTitle') }}</strong>
        <span>{{ $t('IotDeviceDetail.threshold.emptyDescription') }}</span>
      </template>
    </CloudEmpty>

  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DeviceTemplate } from '../../services/device-library/types'
import { iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../../types'
import type { IotDeviceLibraryThingModelProperty } from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'

type ThresholdSource = 'device' | 'product' | 'template' | 'none'

interface ThresholdRow {
  propertyId: string
  propertyName: string
  dataType: string
  configured: boolean
  source: ThresholdSource
  type?: string
  lower?: number
  upper?: number
  mode?: string
  description?: string
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  productId: {
    type: String,
    default: '',
  },
  productTemplate: {
    type: Object as PropType<DeviceTemplate | null>,
    default: null,
  },
  fallbackProperties: {
    type: Array as PropType<IotDeviceLibraryThingModelProperty[]>,
    required: true,
  },
})

const { t: $t } = useI18n()
const loading = ref(false)
const rows = ref<ThresholdRow[]>([])
const hintText = ref('')
const modeOptions = computed(() => [
  { label: $t('IotDeviceDetail.threshold.modeOption.ignore'), value: 'ignore' },
  { label: $t('IotDeviceDetail.threshold.modeOption.record'), value: 'device-record' },
  { label: $t('IotDeviceDetail.threshold.modeOption.alarm'), value: 'device-alarm' },
  { label: $t('IotDeviceDetail.threshold.modeOption.recordAlarm'), value: 'record-alarm' },
])

const apiReady = computed(() => Boolean(props.productId))

const propertyMetaMap = computed(() => {
  const map = new Map<string, Omit<ThresholdRow, 'configured' | 'source' | 'type' | 'lower' | 'upper' | 'mode'>>()
  for (const item of props.fallbackProperties) {
    map.set(item.identifier, {
      propertyId: item.identifier,
      propertyName: item.name,
      dataType: item.dataType,
      description: item.description,
    })
  }
  for (const point of props.device.telemetry) {
    if (!map.has(point.key)) {
      map.set(point.key, {
        propertyId: point.key,
        propertyName: point.name,
        dataType: point.unit || !Number.isNaN(Number(point.value)) ? 'number' : 'string',
        description: point.hint,
      })
    }
  }
  return map
})

const candidateRows = computed<ThresholdRow[]>(() => {
  return Array.from(propertyMetaMap.value.values())
    .filter((item) => item.dataType === 'number')
    .map((item) => ({
      ...item,
      configured: false,
      source: 'none',
    }))
})

function sourceLabel(source: ThresholdSource) {
  if (source === 'device') return $t('IotDeviceDetail.threshold.source.device')
  if (source === 'product') return $t('IotDeviceDetail.threshold.source.product')
  if (source === 'template') return $t('IotDeviceDetail.threshold.source.template')
  return $t('IotDeviceDetail.common.unconfigured')
}

function modeText(mode?: string) {
  return modeOptions.value.find((item) => item.value === mode)?.label || '-'
}

function thresholdText(row: ThresholdRow) {
  if (row.type === 'number-range') {
    return `${row.lower ?? '-'} ~ ${row.upper ?? '-'}`
  }
  if (row.source === 'template') {
    return `${row.lower ?? '-'} ~ ${row.upper ?? '-'}`
  }
  return row.configured ? '-' : $t('IotDeviceDetail.common.unset')
}

function normalizeRecord(item: any, source: 'device' | 'product'): ThresholdRow {
  const propertyId = item?.property || item?.propertyId || item?.id
  const matcher = item?.configuration?.matcher || {}
  const processors = item?.configuration?.processors || []
  const property = propertyMetaMap.value.get(propertyId)
  const modeProviders = processors.map((i: any) => i.provider)
  const mode =
    modeProviders.includes('device-record') && modeProviders.includes('device-alarm')
      ? 'record-alarm'
      : modeProviders[0]

  return {
    propertyId,
    propertyName: property?.propertyName || propertyId,
    dataType: property?.dataType || 'number',
    description: property?.description,
    configured: true,
    source,
    type: matcher?.provider,
    lower: matcher?.configuration?.min,
    upper: matcher?.configuration?.max,
    mode,
  }
}

function buildTemplateRows(): ThresholdRow[] {
  return props.fallbackProperties.map((item) => {
    const rangeText = item.expandedConfig.deviationConfig.normalRange || ''
    const [lowerRaw, upperRaw] = rangeText.split('~').map((value) => value?.trim() || '')
    return {
      propertyId: item.identifier,
      propertyName: item.name,
      dataType: item.dataType,
      configured: Boolean(rangeText && rangeText !== '-'),
      source: 'template',
      lower: Number.parseFloat(lowerRaw),
      upper: Number.parseFloat((upperRaw || '').split(' ')[0] || ''),
      description: item.expandedConfig.deviationConfig.description || item.description,
    }
  })
}

async function loadRows() {
  if (!apiReady.value) {
    rows.value = buildTemplateRows()
    hintText.value = $t('IotDeviceDetail.threshold.templateHint')
    return
  }

  loading.value = true
  hintText.value = ''
  try {
    const queryParams = {
      paging: false,
      sorts: [{ name: 'id', order: 'desc' }],
    }

    const [deviceResp, productResp] = await Promise.all([
      iotDeviceDetailRealApi.queryDeviceThresholdList(props.productId!, props.device.id, queryParams),
      iotDeviceDetailRealApi.queryProductThresholdList(props.productId!, queryParams),
    ])

    const deviceList = Array.isArray(deviceResp?.result) ? deviceResp.result : (deviceResp?.result?.data || [])
    const productList = Array.isArray(productResp?.result) ? productResp.result : (productResp?.result?.data || [])

    const productMap = new Map(productList.map((item: any) => {
      const row = normalizeRecord(item, 'product')
      return [row.propertyId, row]
    }))

    const deviceMap = new Map(deviceList.map((item: any) => {
      const row = normalizeRecord(item, 'device')
      return [row.propertyId, row]
    }))

    const mergedKeys = new Set<string>([
      ...candidateRows.value.map((item) => item.propertyId),
      ...productMap.keys(),
      ...deviceMap.keys(),
    ])

    rows.value = Array.from(mergedKeys).map((propertyId) => {
      return deviceMap.get(propertyId)
        || productMap.get(propertyId)
        || candidateRows.value.find((item) => item.propertyId === propertyId)
        || {
          propertyId,
          propertyName: propertyId,
          dataType: 'number',
          configured: false,
          source: 'none' as const,
        }
    })
  } catch (error) {
    rows.value = buildTemplateRows()
    hintText.value = $t('IotDeviceDetail.threshold.fallbackHint')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.device.id, props.productId, props.fallbackProperties.length] as const,
  () => {
    loadRows()
  },
  { immediate: true },
)
</script>

<style scoped src="./IotDeviceThresholdConfigTab.css"></style>
