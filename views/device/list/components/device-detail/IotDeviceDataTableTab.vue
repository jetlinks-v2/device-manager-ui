<template>
  <section class="device-data-tab">
    <IotDevicePropertyReadModal
      v-model:open="readOpen"
      :property="selectedLiveProperty"
      :tone="selectedTone"
      :loading="reading"
      @confirm="readSelectedProperty"
    />
    <IotDevicePropertyWriteModal
      v-model:open="writeOpen"
      :property="selectedLiveProperty"
      :loading="writing"
      @confirm="writeSelectedProperty"
    />
    <IotDevicePropertyDetailModal
      v-model:open="detailOpen"
      :device-id="deviceId"
      :property="selectedLiveProperty"
      :tone="selectedTone"
    />
    <header class="data-toolbar">
      <div class="data-toolbar__left">
        <a-segmented v-model:value="activePane" :options="paneOptions">
          <template #label="{ payload, value }">
            <span :class="{'data-segment': true, 'is-active': activePane === value }">
              <AIcon :type="payload.icon" />
              {{ payload.title }}
            </span>
          </template>
        </a-segmented>
        <a-select v-if="activePane === 'property'" v-model:value="propertyTimeRange" class="data-select" :options="propertyTimeRangeOptions">
          <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
        </a-select>
        <a-select v-else v-model:value="eventTimeRange" class="data-select" :options="eventTimeRangeOptions">
          <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
        </a-select>
        <template v-if="activePane === 'property'">
          <div v-if="showPropertyGroupSwitch" class="data-property-groups">
            <div
              ref="propertyGroupsRef"
              class="data-property-groups__list"
              :class="{ 'is-expanded': propertyGroupsExpanded }"
            >
              <ChipGroup
                v-model="propertyGroup"
                :label="$t('IotDeviceDetail.dataTable.propertyGroup')"
                :options="propertyGroupOptions"
                style-variant="inline"
              />
            </div>
            <a-button
              v-if="propertyGroupsOverflow"
              type="text"
              size="small"
              class="data-property-groups__action"
              @click="propertyGroupsExpanded = !propertyGroupsExpanded"
            >
              {{ propertyGroupsExpanded ? $t('IotDeviceDetail.detail.collapseTags') : $t('IotDeviceDetail.detail.expandTags') }}
            </a-button>
          </div>
          <a-select
            v-model:value="propertyFilter"
            class="data-select"
            :options="propertyFilterOptions"
          />
        </template>
      </div>
      <a-button v-if="activePane === 'property'">
        <template #icon><AIcon type="DownloadOutlined" /></template>
        {{ t('IotDeviceDetail.dataTable.exportCsv') }}
      </a-button>
    </header>

    <div v-if="activePane === 'property'" class="property-pane">
      <j-pro-table
        v-if="filteredPropertyCards.length"
        class="property-data-table"
        :columns="[]"
        :request="requestPropertyCards"
        :params="propertyTableParams"
        :pagination="propertyPaginationOptions"
        :body-style="{ padding: 0, background: 'transparent' }"
        mode="CARD"
        :grid-columns="[1, 2, 3, 4]"
      >
        <template #card="item">
          <article
            class="data-property-card"
            :data-tone="cardTone(liveProperty(item), propertyCardIndex(liveProperty(item)))"
          >
            <header>
              <div class="property-title">
                <span />
                <strong>{{ liveProperty(item).name }}</strong>
              </div>
              <div class="property-actions">
                <a-tooltip v-if="canReadProperty(liveProperty(item))" :title="$t('IotDeviceDetail.dataTable.readProperty')">
                  <a-button type="text" size="small" :aria-label="$t('IotDeviceDetail.dataTable.readProperty')" @click="openRead(liveProperty(item))">
                    <template #icon><AIcon type="ReloadOutlined" /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="canWriteProperty(liveProperty(item))" :title="$t('IotDeviceDetail.dataTable.writeProperty')">
                  <a-button type="text" size="small" :aria-label="$t('IotDeviceDetail.dataTable.writeProperty')" @click="openWrite(liveProperty(item))">
                    <template #icon><AIcon type="EditOutlined" /></template>
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="$t('IotDeviceDetail.dataTable.detail')">
                  <a-button type="text" size="small" :aria-label="$t('IotDeviceDetail.dataTable.detail')" @click="openDetail(liveProperty(item))">
                    <template #icon><AIcon type="LineChartOutlined" /></template>
                  </a-button>
                </a-tooltip>
              </div>
            </header>
            <div class="property-value">
              <IotDevicePropertyValuePreview
                :value="liveProperty(item).value"
                :value-type="liveProperty(item).valueType"
                :data-type="liveProperty(item).dataType"
                :name="liveProperty(item).name"
              />
              <span v-if="propertyDisplayUnit(liveProperty(item))">{{ propertyDisplayUnit(liveProperty(item)) }}</span>
            </div>
            <IotDevicePropertySparkline
              :property="liveProperty(item)"
              :rows="getSparklineRows(liveProperty(item))"
              :tone="cardTone(liveProperty(item), propertyCardIndex(liveProperty(item)))"
              :time-range="propertyTimeRange"
            />
            <footer>
              <span>{{ propertyStatusText(liveProperty(item), propertyCardIndex(liveProperty(item))) }}</span>
              <i />
              <span>{{ propertyTimeText(liveProperty(item), propertyCardIndex(liveProperty(item))) }}</span>
            </footer>
          </article>
        </template>
      </j-pro-table>
      <CloudEmpty v-else :description="$t('IotDeviceDetail.dataTable.noData')" />
    </div>

    <IotDeviceEventHistoryPane
      v-else
      :device-id="deviceId"
      :events="events"
      :time-range="eventTimeRange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DevicePropertyValue } from '../../services/iotDeviceDetailReal.service'
import type { RealtimeEventLevel, RealtimeEventRow, RealtimePropertyRow } from './iotDeviceDetail.types'
import IotDevicePropertyDetailModal from './IotDevicePropertyDetailModal.vue'
import IotDeviceEventHistoryPane from './IotDeviceEventHistoryPane.vue'
import IotDevicePropertyReadModal from './IotDevicePropertyReadModal.vue'
import IotDevicePropertySparkline from './IotDevicePropertySparkline.vue'
import IotDevicePropertyValuePreview from './IotDevicePropertyValuePreview.vue'
import IotDevicePropertyWriteModal from './IotDevicePropertyWriteModal.vue'
import { useIotDevicePropertyOperation } from './useIotDevicePropertyOperation'
import { useIotDevicePropertyPagination } from './useIotDevicePropertyPagination'
import { useIotDevicePropertySparklineData } from './useIotDevicePropertySparklineData'

const props = defineProps<{
  deviceId: string
  properties: RealtimePropertyRow[]
  events: RealtimeEventRow[]
}>()

const emit = defineEmits<{
  'property-value': [value: DevicePropertyValue]
  'visible-keys-change': [keys: string[]]
}>()

const activePane = ref<'property' | 'event'>('property')
const propertyTimeRange = ref<'1h' | '24h' | '7d'>('1h')
const eventTimeRange = ref<'all' | '1h' | '24h' | '7d'>('all')
const propertyFilter = ref<RealtimeEventLevel | 'all'>('all')
const propertyGroup = ref('__all__')
const propertyGroupsRef = ref<HTMLElement | null>(null)
const propertyGroupsExpanded = ref(false)
const propertyGroupsOverflow = ref(false)
const detailOpen = ref(false)
const { t } = useI18n()

const propertyGroups = computed(() => {
  const groups = new Map<string, { key: string; label: string; count: number }>()
  props.properties.forEach((item) => {
    const group = groups.get(item.groupId)
    if (group) {
      group.count += 1
      return
    }
    groups.set(item.groupId, {
      key: item.groupId,
      label: item.groupName,
      count: 1,
    })
  })
  return [...groups.values()]
})

const propertyGroupOptions = computed(() => [
  {
    key: '__all__',
    label: t('IotDeviceDetail.dataTable.propertyGroupCount', {
      label: t('IotDeviceDetail.dataTable.allProperties'),
      count: props.properties.length,
    }),
  },
  ...propertyGroups.value.map((group) => ({
    key: group.key,
    label: t('IotDeviceDetail.dataTable.propertyGroupCount', group),
  })),
])
const showPropertyGroupSwitch = computed(() => propertyGroups.value.length > 1)

const paneOptions = computed(() => [
  { value: 'property', payload: { title: t('IotStandardModel.thingModel.kind.properties'), icon: 'EnvironmentOutlined' } },
  { value: 'event', payload: { title: t('IotStandardModel.thingModel.kind.events'), icon: 'BellOutlined' } },
])

const propertyTimeRangeOptions = computed(() => [
  { label: t('IotDeviceDetail.dataTable.range.lastHour'), value: '1h' },
  { label: t('IotDeviceDetail.dataTable.range.last24Hours'), value: '24h' },
  { label: t('IotDeviceDetail.dataTable.range.last7Days'), value: '7d' },
])
const eventTimeRangeOptions = computed(() => [
  { label: t('IotDeviceDetail.dataTable.range.all'), value: 'all' },
  ...propertyTimeRangeOptions.value,
])

const propertyFilterOptions = computed(() => [
  { label: t('IotDeviceDetail.dataTable.allProperties'), value: 'all' },
  { label: t('IotDeviceDetail.dataTable.filter.normal'), value: 'info' },
  { label: t('IotDeviceDetail.dataTable.filter.alarm'), value: 'major' },
  { label: t('IotDeviceDetail.dataTable.filter.critical'), value: 'critical' },
])

const {
  selectedProperty,
  readOpen,
  writeOpen,
  reading,
  writing,
  openRead,
  openWrite,
  readSelectedProperty,
  writeSelectedProperty,
} = useIotDevicePropertyOperation({
  deviceId: () => props.deviceId,
  onValue: (value) => emit('property-value', value),
})
const propertyByIdentifier = computed(() => new Map(
  props.properties.map((item) => [item.identifier.toLowerCase(), item]),
))
const selectedLiveProperty = computed(() => selectedProperty.value ? liveProperty(selectedProperty.value) : null)
const selectedTone = computed(() => selectedLiveProperty.value ? cardTone(selectedLiveProperty.value, propertyCardIndex(selectedLiveProperty.value)) : 'primary')
const {
  propertyPaginationOptions,
  filteredPropertyCards,
  visiblePropertyCards,
  propertyTableParams,
  propertyDisplayUnit,
  propertyCardIndex,
  requestPropertyCards,
} = useIotDevicePropertyPagination(
  computed(() => props.properties),
  propertyFilter,
  propertyGroup,
)
const {
  getSparklineRows,
} = useIotDevicePropertySparklineData(
  computed(() => props.deviceId),
  visiblePropertyCards,
  propertyTimeRange,
)
const visiblePropertyKeys = computed(() =>
  visiblePropertyCards.value.map((item) => item.identifier).filter(Boolean),
)

watch(
  visiblePropertyKeys,
  (keys) => emit('visible-keys-change', keys),
  { immediate: true },
)

function updatePropertyGroupsOverflow() {
  void nextTick(() => {
    const element = propertyGroupsRef.value
    if (!element) {
      propertyGroupsOverflow.value = false
      return
    }
    propertyGroupsOverflow.value = element.scrollHeight > 26
    if (!propertyGroupsOverflow.value) propertyGroupsExpanded.value = false
  })
}

watch([propertyGroups, activePane], ([groups]) => {
  if (propertyGroup.value !== '__all__' && !groups.some((group) => group.key === propertyGroup.value)) {
    propertyGroup.value = '__all__'
  }
  updatePropertyGroupsOverflow()
}, { immediate: true })

onMounted(() => {
  updatePropertyGroupsOverflow()
  window.addEventListener('resize', updatePropertyGroupsOverflow)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePropertyGroupsOverflow)
})

function cardTone(item: RealtimePropertyRow, index: number) {
  if (item.tone === 'critical') return 'danger'
  if (item.tone === 'warning') return 'warning'
  return ['primary', 'cyan', 'success', 'warning', 'slate', 'slate', 'primary'][index % 7]
}

function liveProperty(item: RealtimePropertyRow) {
  return propertyByIdentifier.value.get(item.identifier.toLowerCase()) ?? item
}

function propertyStatusText(item: RealtimePropertyRow, index: number) {
  if (item.tone === 'critical') return t('IotDeviceDetail.dataTable.trend.rising')
  if (item.tone === 'warning') return t('IotDeviceDetail.dataTable.trend.good')
  if (index === 3) return t('IotDeviceDetail.dataTable.trend.declining')
  if (index === 7) return t('IotDeviceDetail.dataTable.trend.noChanges')
  return t('IotWorkbench.trend.stable')
}

function openDetail(item: RealtimePropertyRow) {
  selectedProperty.value = item
  detailOpen.value = true
}

function canReadProperty(item: RealtimePropertyRow) {
  return item.accessMode === 'read' || item.accessMode === 'readwrite'
}

function canWriteProperty(item: RealtimePropertyRow) {
  return item.accessMode === 'write' || item.accessMode === 'readwrite'
}

function propertyTimeText(item: RealtimePropertyRow, index: number) {
  if (index === 3) return t('IotDeviceDetail.dataTable.minutesAgo', { value: 5 })
  if (index === 4) return t('IotDeviceDetail.dataTable.minutesAgo', { value: 2 })
  return item.updatedAt && item.updatedAt !== '--'
    ? item.updatedAt
    : t('IotDeviceDetail.dataTable.minutesAgo', { value: 1 })
}

</script>

<style scoped src="./IotDeviceDataTableTab.css"></style>
