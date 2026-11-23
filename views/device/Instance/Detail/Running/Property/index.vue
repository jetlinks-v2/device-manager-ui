<template>
  <a-spin :spinning='loading'>
    <JProTable
      ref='tableRef'
      :columns='columns'
      :request='query'
      modeValue='CARD'
      :params='_params'
      :gridColumns='[2, 4]'
      :bodyStyle="{ padding: '0 0 0 20px' }"
      :scroll='{y : 450}'
    >
      <template #headerLeftRender>
        <div class='property-header-filters'>
          <div v-if='showGroupSwitch' class='property-group-switch'>
            <a-radio-group
              v-model:value='_params.groupId'
              size='small'
              button-style='solid'
            >
              <a-radio-button
                v-for='item in groupOptions'
                :key='item.value'
                :value='item.value'
              >
                {{ item.label }}（{{ item.count }}）
              </a-radio-button>
            </a-radio-group>
          </div>
          <a-input-search
            :placeholder="$t('Save.index.912481-5')"
            style='width: 300px'
            @search='onSearch'
            v-model:value='value'
            :allowClear='true'
          />
        </div>
      </template>
      <template #card='slotProps'>
        <PropertyCard
          :data='{ ...slotProps, ...propertyValue[slotProps?.id] }'
          :actions='getActions(slotProps, metric)'
        />
      </template>
      <template #value='slotProps'>
        <ValueRender
          type='table'
          :data='slotProps'
          :value='propertyValue[slotProps?.id]'
        />
      </template>
      <template #time='slotProps'>
        {{ propertyValue[slotProps?.id]?.timeString || $t('comm.table.empty-2') }}
      </template>
      <template #action='slotProps'>
        <a-space :size='16'>
          <template v-for='i in getActions(slotProps, metric)' :key='i.key'>
            <a-tooltip v-bind='i.tooltip' v-if="i.key !== 'edit'">
              <a-button
                style='padding: 0'
                type='link'
                :disabled='i.disabled'
                @click='i.onClick && i.onClick(slotProps)'
              >
                <AIcon :type='i.icon' />
              </a-button>
            </a-tooltip>
            <j-permission-button
              :disabled='i.disabled'
              v-else
              :popConfirm='i.popConfirm'
              :tooltip='i.tooltip'
              @click='i.onClick && i.onClick(slotProps)'
              type='link'
              style='padding: 0px'
            >
              <template #icon>
                <AIcon :type='i.icon' />
              </template>
            </j-permission-button>
          </template>
        </a-space>
      </template>
    </JProTable>
  </a-spin>
  <Save v-if='editVisible' @close='editVisible = false' :data='currentInfo' />
  <Indicators
    v-if='indicatorVisible'
    @close='indicatorVisible = false'
    :data='currentInfo'
  />
  <Detail
    v-if='detailVisible'
    :data='currentInfo'
    @close='detailVisible = false'
  />
</template>

<script lang='ts' setup>
import { cloneDeep, groupBy, throttle, toArray } from 'lodash-es'
import { PropertyData } from '../../../typings'
import PropertyCard from './PropertyCard.vue'
import ValueRender from './ValueRender.vue'
import Save from './Save.vue'
import Detail from './Detail/index.vue'
import Indicators from './Indicators.vue'
import { getProperty, queryPropertyMetric } from '../../../../../../api/instance'
import { dashboard } from '../../../../../../api/dashboard'
import { useInstanceStore } from '../../../../../../store/instance'
import { subscribeDeviceProperties } from '../../../../list/services/iotDeviceDetailReal.service'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const columns = [
  {
    title: $t('Product.index.660348-28'),
    dataIndex: 'name',
    key: 'name',
    ellipsis: true
  },
  {
    title: $t('Properties.OtherSetting.237457-26'),
    dataIndex: 'value',
    key: 'value',
    scopedSlots: true
  },
  {
    title: $t('BasicInfo.indev.028379-6'),
    dataIndex: 'time',
    key: 'time',
    scopedSlots: true
  },
  {
    title: $t('Product.index.660348-11'),
    dataIndex: 'action',
    key: 'action',
    scopedSlots: true
  }
]

const _data = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})
const value = ref<string>('')
const dataSource = ref<PropertyData[]>([])
const _dataSource = ref<PropertyData[]>([])
const editVisible = ref<boolean>(false) // 编辑
const detailVisible = ref<boolean>(false) // 详情
const currentInfo = ref<Record<string, any>>({})
const instanceStore = useInstanceStore()
const indicatorVisible = ref<boolean>(false) // 指标
const loading = ref<boolean>(false)
const propertyValue = ref<Record<string, any>>({})
const _params = reactive({
  name: '',
  groupId: '__all__'
})
const tableRef = ref()
const subRef = ref()
let disposed = false
let dashboardRequest = 0
const metric = ref([])
const ALL_GROUP_KEY = '__all__'
const DEFAULT_GROUP_KEY = '__default__'

type PropertyGroupOption = {
  label: string
  value: string
  count: number
}

const getPropertyGroup = (item: Partial<PropertyData> = {}) => {
  const expands = item?.expands || {}

  return {
    id: expands.groupId || DEFAULT_GROUP_KEY,
    name: expands.groupName || $t('Running.Property.376017-3')
  }
}

const propertyGroups = computed<PropertyGroupOption[]>(() => {
  const groups = new Map<string, PropertyGroupOption>()

  ;(_data.data || []).forEach((item: PropertyData) => {
    const group = getPropertyGroup(item)
    const current = groups.get(group.id)

    if (current) {
      current.count += 1
    } else {
      groups.set(group.id, {
        label: group.name,
        value: group.id,
        count: 1
      })
    }
  })

  return [...groups.values()]
})

const groupOptions = computed<PropertyGroupOption[]>(() => [
  {
    label: $t('Running.Property.376017-2'),
    value: ALL_GROUP_KEY,
    count: (_data.data || []).length
  },
  ...propertyGroups.value
])

const showGroupSwitch = computed(() => propertyGroups.value.length > 1)

// const list = ref<any[]>([]);

const getActions = (data: Partial<Record<string, any>>, _metric: string[]) => {
  const arr = []
  if (data.expands?.type?.includes('write')) {
    arr.push({
      key: 'edit',
      tooltip: {
        title: $t('Property.index.076208-0')
      },
      icon: 'EditOutlined',
      onClick: () => {
        editVisible.value = true
        currentInfo.value = data
      }
    })
  }
  if (
    _metric.includes(data.id) &&
    [
      'int',
      'long',
      'float',
      'double',
      'string',
      'boolean',
      'date'
    ].includes(data.valueType?.type || '')
  ) {
    arr.push({
      key: 'metrics',
      tooltip: {
        title: $t('Property.index.076208-1')
      },
      icon: 'ClockCircleOutlined',
      onClick: () => {
        indicatorVisible.value = true
        currentInfo.value = data
      }
    })
  }
  if (data.expands?.type?.includes('read')) {
    arr.push({
      key: 'read',
      tooltip: {
        title: $t('Property.index.076208-2')
      },
      icon: 'SyncOutlined',
      onClick: async () => {
        if (instanceStore.current.id && data.id) {
          const resp = await getProperty(
            instanceStore.current.id,
            data.id
          )
          if (resp.status === 200) {
            onlyMessage($t('Product.index.660348-18'))
          }
        }
      }
    })
  }
  arr.push({
    key: 'detail',
    text: $t('Event.index.277611-0'),
    tooltip: {
      title: $t('Event.index.277611-0')
    },
    icon: 'BarsOutlined',
    onClick: () => {
      detailVisible.value = true
      currentInfo.value = data
    }
  })
  return arr
}

const valueChange = (arr: Record<string, any>[]) => {
  (arr || [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .forEach((item: any) => {
      const { value } = item
      propertyValue.value[value?.property] = { ...item, ...value }
    })
}

let messageCache = new Map()

const throttleFn = throttle(() => {
  const _list = [...messageCache.values()]
  valueChange(_list)
}, 500)

/** 固定查询时的设备和属性，切页、切设备及翻页后均丢弃迟到响应，避免重建失效订阅。 */
const getDashboard = async () => {
  const request = ++dashboardRequest
  subRef.value?.unsubscribe()
  subRef.value = undefined
  throttleFn.cancel()
  messageCache.clear()
  const { id: deviceId, productId } = instanceStore.current
  const properties = dataSource.value.map((item) => item.id)
  const isCurrent = () => !disposed && request === dashboardRequest
    && deviceId === instanceStore.current.id && productId === instanceStore.current.productId
  if (!isCurrent() || !deviceId || !productId || !properties.length) {
    loading.value = false
    return
  }
  const param = [
    {
      dashboard: 'device',
      object: productId,
      measurement: 'properties',
      dimension: 'history',
      params: {
        deviceId,
        history: 1,
        properties
      }
    }
  ]
  loading.value = true
  try {
    const resp: Record<string, any> = await dashboard(param)
    if (!isCurrent() || resp.status !== 200) return
    const t1 = (resp.result || []).map((item: any) => ({
      timeString: item.data?.timeString,
      timestamp: item.data?.timestamp,
      ...item?.data?.value
    }))
    const obj: Record<string, Record<string, any>> = {}
    toArray(groupBy(t1, 'property')).forEach((item) => {
      const latest = item.sort((a, b) => b.timestamp - a.timestamp)[0]
      obj[latest.property] = latest
    })
    propertyValue.value = { ...unref(propertyValue), ...obj }
    subRef.value = subscribeDeviceProperties(deviceId, productId, properties, (value) => {
      if (!isCurrent()) return
      messageCache.set(value.property, { ...value, value })
      throttleFn()
    })
  } finally {
    if (isCurrent()) loading.value = false
  }
}

const query = (params: Record<string, any>) =>
  new Promise((resolve) => {
    const _from = params.pageIndex * params.pageSize
    const _to = (params.pageIndex + 1) * params.pageSize
    let arr = cloneDeep(_dataSource.value)
    if (params?.groupId && params.groupId !== ALL_GROUP_KEY) {
      arr = arr.filter((item: PropertyData) => {
        return getPropertyGroup(item).id === params.groupId
      })
    }
    if (params?.name) {
      const li = arr.filter((i: any) => {
        return i?.name.indexOf(params.name) !== -1
      })
      arr = cloneDeep(li)
    }
    dataSource.value = arr.slice(_from, _to)
    messageCache.clear()
    resolve({
      result: {
        data: dataSource.value,
        pageIndex: params.pageIndex || 0,
        pageSize: params.pageSize || 12,
        total: arr.length
      },
      success: true,
      status: 200
    })
    void getDashboard().catch(() => { /* 请求层统一展示错误；失败时不创建订阅。 */ })
  })

const getMetric = async (arr = []) => {
  const resp = await queryPropertyMetric(instanceStore.current.id, arr)
  if (resp.success) {
    metric.value = resp.result.filter((i: any) => i.metrics.length).map((item: any) => item.property)
  }
}

watch(
  () => _data.data,
  (newVal) => {
    if (newVal.length) {
      _dataSource.value = newVal as PropertyData[]
      _params.name = ''
      const hasCurrentGroup = propertyGroups.value.some(
        (item) => item.value === _params.groupId
      )
      if (_params.groupId !== ALL_GROUP_KEY && !hasCurrentGroup) {
        _params.groupId = ALL_GROUP_KEY
      }
      getMetric(newVal.map(i => i.id))
      tableRef.value?.reload()
    } else {
      _dataSource.value = []
      _params.name = ''
      _params.groupId = ALL_GROUP_KEY
      metric.value = []
      tableRef.value?.reload()
    }
  },
  {
    deep: true,
    immediate: true
  }
)

const onSearch = () => {
  _params.name = value.value
}

// 共享 store 可先于组件卸载切换设备，此时立即释放旧订阅和待刷新的值。
watch(
  [() => instanceStore.current.id, () => instanceStore.current.productId],
  () => {
    dashboardRequest += 1
    subRef.value?.unsubscribe()
    subRef.value = undefined
    throttleFn.cancel()
    messageCache.clear()
    propertyValue.value = {}
    loading.value = false
  },
  { flush: 'sync' }
)

onUnmounted(() => {
  disposed = true
  dashboardRequest += 1
  subRef.value?.unsubscribe()
  throttleFn.cancel()
  messageCache.clear()
})
</script>

<style scoped lang='less'>
.property-header-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
}

.property-group-switch {
  overflow-x: auto;
  padding-right: 16px;

  :deep(.ant-radio-group) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  :deep(.ant-radio-button-wrapper) {
    border-inline-start-width: 1px;
    border-radius: 16px;
  }

  :deep(.ant-radio-button-wrapper:not(:first-child)) {
    &::before {
      display: none;
    }
  }
}
</style>
