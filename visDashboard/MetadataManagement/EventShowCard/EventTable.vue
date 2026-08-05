<template>
  <div class="event-table">
    <div
      v-if="headerTitle"
      class="event-table__header"
    >
      {{ headerTitle }}
    </div>
    <template v-if="isPreview">
      <div class="event-table__status">
        <a-empty description="预览模式暂无事件数据" />
      </div>
    </template>
    <template v-else>
      <div class="event-table__search">
        <pro-search
          ref="searchRef"
          :noMargin="true"
          :columns="columns"
          :target="searchTarget"
          type="simple"
          @search="handleSearch"
        />
      </div>
      <div class="event-table__content">
        <JProTable
          ref="eventsRef"
          :columns="columns"
          :request="requestEventList"
          mode="TABLE"
          :params="params"
          :bodyStyle="{ padding: '0 0 0 0' }"
          :scroll="{ x: 'max-content' }"
        >
          <template
            v-for="item in renderColumns"
            :key="item.slotName"
            #[item.slotName]="slotProps"
          >
            <ValueRender
              :record="slotProps"
              :field="item.field"
            />
          </template>
          <template #timestamp="slotProps">
            {{ dayjs(slotProps.timestamp).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
          <template #action="slotProps">
            <a-button
              type="link"
              @click="openDetail(slotProps)"
            >
              <AIcon type="SearchOutlined" />
            </a-button>
          </template>
        </JProTable>
      </div>
    </template>

    <a-modal
      v-model:open="visible"
      :width="600"
      title="详情"
      class="event-table__modal"
    >
      <JsonViewer
        :value="info"
        style="max-height: calc(100vh - 400px); overflow: auto"
      />
      <template #footer>
        <a-button
          type="primary"
          @click="visible = false"
        >
          关闭
        </a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { cloneDeep, omit } from 'lodash-es'
import { JsonViewer } from 'vue3-json-viewer'
import { detail as queryDeviceDetail, getEventList } from '@device-manager-ui/api/instance'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import ValueRender from '@device-manager-ui/views/device/Instance/Detail/Running/Event/ValueRender.vue'
import type { DashboardEventField, DashboardEventMetadata } from '../../DeviceManagement/shared'

type SearchRefLike = {
  reset?: () => void
}

type EventsRefLike = {
  reload?: () => void
}

const props = withDefaults(
  defineProps<{
    event: DashboardEventMetadata
    deviceId?: string
    isPreview?: boolean
    isAutoRefresh?: boolean
    interval?: number
  }>(),
  {
    deviceId: '',
    isPreview: false,
    isAutoRefresh: true,
    interval: 5
  }
)

const instanceStore = useInstanceStore()
const searchRef = ref<SearchRefLike>()
const eventsRef = ref<EventsRefLike>()
const params = ref<Record<string, unknown>>({})
const visible = ref(false)
const info = ref<Record<string, unknown>>({})
const deviceMetadata = ref('')
const deviceName = ref('')
let refreshTimer: ReturnType<typeof setInterval> | undefined

const defaultColumns = [
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    scopedSlots: true,
    width: 180,
    search: {
      type: 'date'
    }
  },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    scopedSlots: true,
    fixed: 'right',
    width: 72
  }
]

const componentsType: Record<string, string> = {
  int: 'number',
  long: 'number',
  float: 'number',
  double: 'number',
  string: 'string',
  array: 'string',
  password: 'string',
  enum: 'select',
  boolean: 'select',
  date: 'date',
  object: 'string',
  geoPoint: 'string',
  file: 'string',
  time: 'time'
}

const searchTarget = computed(() => `device-instance-running-events-${props.event?.id || 'unknown'}`)
const currentEvent = computed<DashboardEventMetadata>(() => {
  try {
    const events = JSON.parse(deviceMetadata.value || '{}').events || []
    const target = events.find((item: DashboardEventMetadata) => item.id === props.event?.id)

    return target || props.event
  } catch (error) {
    return props.event
  }
})
const headerTitle = computed(() => {
  if (deviceName.value && currentEvent.value?.name) {
    return `${deviceName.value} / ${currentEvent.value.name}`
  }

  return deviceName.value || currentEvent.value?.name || ''
})

const getColumnWidth = (type?: string) => {
  if (['object', 'array'].includes(type || '')) return 320
  if (type === 'file') return 300
  if (type === 'geoPoint') return 220
  if (['date', 'time'].includes(type || '')) return 180
  if (['enum', 'boolean'].includes(type || '')) return 140
  if (['int', 'long', 'float', 'double'].includes(type || '')) return 160
  return 240
}

const getSearchOptions = (field: DashboardEventField) => {
  if (field?.valueType?.type === 'boolean') {
    return [
      {
        label: field?.valueType?.falseText,
        value: field?.valueType?.falseValue
      },
      {
        label: field?.valueType?.trueText,
        value: field?.valueType?.trueValue
      }
    ]
  }

  return (field?.valueType?.elements || []).map((item) => ({
    label: item.text,
    value: item.value
  }))
}

const renderColumns = computed<Array<{ slotName: string; field: DashboardEventField }>>(() => {
  const eventNotQueryable = (instanceStore.current.features || []).find((item: { id?: string }) => item.id === 'eventNotQueryable')
  const columns: Array<{ slotName: string; field: DashboardEventField }> = []

  if (!eventNotQueryable && currentEvent.value?.valueType?.type === 'object') {
    const eventProperties = cloneDeep(currentEvent.value.valueType.properties || [])
    eventProperties.reverse().forEach((item) => {
      columns.push({
        slotName: item.id,
        field: item
      })
    })
  } else {
    columns.push({
      slotName: 'value',
      field: {
        id: 'value',
        name: '值',
        valueType: currentEvent.value?.valueType || { type: 'string' }
      }
    })
  }

  return columns
})

const columns = computed(() => {
  const eventNotQueryable = (instanceStore.current.features || []).find((item: { id?: string }) => item.id === 'eventNotQueryable')
  const currentColumns = renderColumns.value.map((item) => {
    const type = item.field?.valueType?.type
    const column: Record<string, unknown> = {
      key: item.slotName,
      title: item.field?.name,
      dataIndex: item.slotName === 'value' ? 'value' : item.field.id,
      scopedSlots: true,
      ellipsis: true,
      width: getColumnWidth(type)
    }

    if (!eventNotQueryable) {
      column.search = {
        type: componentsType[type || ''] || 'string',
        rename: item.field.id,
        options: getSearchOptions(item.field)
      }
    }

    return column
  })

  nextTick(() => {
    searchRef.value?.reset?.()
  })

  return [...currentColumns, ...defaultColumns]
})

const requestEventList = (requestParams: Record<string, unknown>) => {
  if (!props.deviceId || !currentEvent.value?.id) {
    return Promise.resolve({
      status: 200,
      result: {
        data: [],
        total: 0
      }
    })
  }

  return getEventList(props.deviceId, currentEvent.value.id, requestParams)
}

const handleSearch = (searchParams: Record<string, unknown>) => {
  params.value = searchParams
}

const openDetail = (detailInfo: Record<string, unknown>) => {
  info.value = omit(detailInfo, ['column', 'key', 'index'])
  visible.value = true
}

const stopRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

const loadDeviceDetail = async () => {
  if (!props.deviceId) {
    deviceMetadata.value = ''
    deviceName.value = ''
    return
  }

  const response = await queryDeviceDetail(props.deviceId, true)
  deviceMetadata.value = response.result?.metadata || ''
  deviceName.value = response.result?.name || ''
}

watch(
  () => [props.event?.id, props.deviceId],
  async () => {
    await loadDeviceDetail()
    params.value = {}
    nextTick(() => {
      searchRef.value?.reset?.()
      eventsRef.value?.reload?.()
    })
  },
  { immediate: true }
)

watch(
  () => [props.isPreview, props.isAutoRefresh, props.interval, props.event?.id, props.deviceId],
  ([isPreview, isAutoRefresh, interval]) => {
    stopRefreshTimer()

    if (isPreview || !isAutoRefresh || Number(interval) <= 0) {
      return
    }

    refreshTimer = setInterval(() => {
      eventsRef.value?.reload?.()
    }, Number(interval) * 1000)
  },
  { immediate: true }
)

onUnmounted(() => {
  stopRefreshTimer()
})
</script>

<style scoped lang="less">
.event-table {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  overflow: hidden;
}

.event-table__header {
  margin-bottom: 16px;
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
}

.event-table__content {
  flex: 1;
  min-height: 0;
}

.event-table__search {
  margin: 0;

  :deep(.JSearch-warp) {
    padding: 0 !important;
  }
}

.event-table__content :deep(.ant-spin-nested-loading),
.event-table__content :deep(.ant-spin-container) {
  height: 100%;
}

.event-table__content :deep(.ant-table-cell) {
  vertical-align: top;
}

.event-table__status {
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style lang="less">
.event-table__modal {
  .ant-modal-body {
    padding: 0 20px;
  }
}
</style>
