<template>
  <div class='event_container'>
    <pro-search
      class='device-running-search'
      :columns='columns'
      target='device-instance-running-events'
      @search='handleSearch'
      type='simple'
      ref='searchRef'
    />
    <div style='min-height: 0; flex: 1;'>
      <JProTable
        ref='eventsRef'
        :columns='columns'
        :request='_getEventList'
        mode='TABLE'
        :params='params'
        :bodyStyle="{ padding: '0 0 0 24px' }"
        :scroll="{ x: 'max-content' }"
      >
        <template v-for='item in renderColumns' #[item.slotName]='slotProps'>
          <ValueRender
            :record='slotProps'
            :field='item.field'
          />
        </template>
        <template #timestamp='slotProps'>
          {{ dayjs(slotProps.timestamp).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template #action='slotProps'>
          <a-button type='link' @click='detail(slotProps)'>
            <AIcon type='SearchOutlined' />
          </a-button>
        </template>
      </JProTable>
    </div>
  </div>
  <a-modal
    :width='600'
    v-model:open='visible'
    :title="$t('Event.index.277611-0')"
    class='device-running-event-modal'
  >
    <JsonViewer
      :value='info'
      style='max-height: calc(100vh - 400px); overflow: auto'
    />
    <template #footer>
      <a-button type='primary' @click='visible = false'>{{ $t('Event.index.277611-1') }}</a-button>
    </template>
  </a-modal>
</template>

<script lang='ts' setup>
import dayjs from 'dayjs'
import { getEventList } from '../../../../../../api/instance'
import { useInstanceStore } from '../../../../../../store/instance'
import { JsonViewer } from 'vue3-json-viewer'
import { cloneDeep, omit } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import ValueRender from './ValueRender.vue'

const { t: $t } = useI18n()
const props = defineProps({
  data: {
    type: Object,
    default: () => {
    }
  }
})
const instanceStore = useInstanceStore()
const searchRef = ref()
const eventsRef = ref()
const defaultColumns = [
  {
    title: $t('Event.index.277611-2'),
    dataIndex: 'timestamp',
    key: 'timestamp',
    scopedSlots: true,
    width: 180,
    search: {
      type: 'date'
    }
  },
  {
    title: $t('Event.index.277611-3'),
    dataIndex: 'action',
    key: 'action',
    scopedSlots: true,
    fixed: 'right',
    width: 72
  }
]

const params = ref<Record<string, any>>({})
const visible = ref<boolean>(false)
const info = ref<Record<string, any>>({})

const componentsType = {
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

const _getEventList = (_params: any) => getEventList(instanceStore.current.id || '', props.data.id || '', _params)

const getColumnWidth = (type?: string) => {
  if (['object', 'array'].includes(type || '')) return 320
  if (type === 'file') return 300
  if (type === 'geoPoint') return 220
  if (['date', 'time'].includes(type || '')) return 180
  if (['enum', 'boolean'].includes(type || '')) return 140
  if (['int', 'long', 'float', 'double'].includes(type || '')) return 160
  return 240
}

const getSearchOptions = (field: any) => {
  return field?.valueType?.type === 'boolean' ? [
    {
      label: field?.valueType?.falseText,
      value: field?.valueType?.falseValue
    },
    {
      label: field?.valueType?.trueText,
      value: field?.valueType?.trueValue
    }
  ] : (field?.valueType?.elements || []).map((item: any) => {
    return {
      label: item.text,
      value: item.value
    }
  })
}

const renderColumns = computed(() => {
  const eventNotQueryable = (instanceStore.current.features || []).find((i: any) => i.id === 'eventNotQueryable')
  const arr: Array<{ slotName: string; field: Record<string, any> }> = []
  if (!eventNotQueryable && props.data?.valueType?.type === 'object') {
    const eventProperties = cloneDeep(props.data.valueType?.properties || [])
    eventProperties.reverse().forEach((item: any) => {
      arr.push({
        slotName: item.id,
        field: item
      })
    })
  } else {
    arr.push({
      slotName: 'value',
      field: {
        id: 'value',
        name: $t('Event.index.277611-4'),
        valueType: props.data?.valueType || { type: 'string' }
      }
    })
  }
  return arr
})

const columns = computed(() => {
  const eventNotQueryable = (instanceStore.current.features || []).find((i: any) => i.id === 'eventNotQueryable')
  const arr: Record<string, any>[] = renderColumns.value.map((item) => {
    const type = item.field?.valueType?.type
    const column: Record<string, any> = {
      key: item.slotName,
      title: item.field?.name,
      dataIndex: item.slotName === 'value' ? 'value' : item.field.id,
      scopedSlots: true,
      ellipsis: true,
      width: getColumnWidth(type)
    }

    if (!eventNotQueryable) {
      column.search = {
        type: componentsType?.[type] || 'string',
        rename: item.field.id,
        options: getSearchOptions(item.field)
      }
    }

    return column
  })
  nextTick(() => {
    searchRef.value?.reset?.()
  })
  return [...arr, ...defaultColumns]
})

const handleSearch = (_params: any) => {
  params.value = _params
}

const detail = (_info: any) => {
  info.value = omit(_info, ['column', 'key', 'index'])
  visible.value = true
}

watch(
  () => props.data?.id,
  () => {
    params.value = {}
    nextTick(() => {
      searchRef.value?.reset?.()
      eventsRef.value?.reload?.()
    })
  }
)
</script>

<style lang='less'>
.device-running-search {
  margin: 0 0 24px 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.device-running-event-modal {
  .ant-modal-body {
    padding: 0 20px;
  }
}

.event_container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event_container {
  :deep(.ant-table-cell) {
    vertical-align: top;
  }
}
</style>
