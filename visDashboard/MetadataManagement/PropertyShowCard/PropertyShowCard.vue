<template>
  <div class="property-show-card">
    <div
      v-if="deviceName"
      class="property-show-card__header"
    >
      {{ deviceName }}
    </div>
    <div class="property-show-card__content">
      <div
        v-if="dataSource.length"
        v-for="item in dataSource"
        :key="item?.id"
        class="property-show-card__item"
      >
        <Card
          class="property-show-card__item-card"
          :data="item"
          :actions="getActions(item, )"
        />
      </div>
      <Card
        v-else
        class="property-show-card__empty-card"
        :data="{}"
        :actions="[]"
      />
    </div>
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
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { dashboard } from '@device-manager-ui/api/dashboard'
import {detail, getProperty, queryPropertyMetric} from '@device-manager-ui/api/instance'
import { cloneDeep, debounce, groupBy, throttle, toArray } from 'lodash-es'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { wsClient } from '@jetlinks-web/core'
import { map } from 'rxjs/operators'
import {onlyMessage} from "@jetlinks-web/utils";
import Card from '@device-manager-ui/views/device/Instance/Detail/Running/Property/PropertyCard.vue'
import Save from "@device-manager-ui/views/device/Instance/Detail/Running/Property/Save.vue";
import Indicators from "@device-manager-ui/views/device/Instance/Detail/Running/Property/Indicators.vue";
import Detail from "@device-manager-ui/views/device/Instance/Detail/Running/Property/Detail/index.vue";
import { useI18n } from 'vue-i18n'

defineOptions({
  name: 'PropertyShowCard'
})

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})
const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const productStore = useProductStore()

const dataSource = ref<Record<string, any>[]>([])
const propertyValue = ref<Record<string, any>>({})
const subRef = ref()
const route = useRoute()
const metadataText = ref('')
const deviceName = ref('')
const deviceDetail = ref(instanceStore.detail)
const runtimeProductId = ref('')
const editVisible = ref<boolean>(false) // 编辑
const detailVisible = ref<boolean>(false) // 详情
const currentInfo = ref<Record<string, any>>({})
const indicatorVisible = ref<boolean>(false) // 指标
const metric = ref()

provide('runtime-device-detail', deviceDetail)

const messageCache = new Map<string, Record<string, any>>()

const isProduct = computed(() => route.name === 'device/Product/Detail')
const targetDeviceId = computed(() => String(props.info?.componentProps?.propertyShowCard?.targetId || ''))
const runtimeDeviceId = computed(() => (isProduct.value ? targetDeviceId.value : String(instanceStore.current.id || '')))

const propertyMap = computed(() => {
  try {
    const properties = JSON.parse(metadataText.value || '{}').properties || []
    const data = new Map<string, Record<string, any>>()

    properties.forEach((property: Record<string, any>) => {
      data.set(String(property.id || ''), property)
    })
    console.log(properties,data)
    return data
  } catch (error) {
    return new Map<string, Record<string, any>>()
  }
})

const valueChange = (arr: Record<string, any>[]) => {
  (arr || [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .forEach((item: any) => {
      const { value } = item
      propertyValue.value[value?.property] = { ...item, ...value }
    })
}

const throttleFn = throttle(() => {
  const _list = [...messageCache.values()]
  valueChange(_list)
}, 500)

const subscribeProperty = () => {
  if (!runtimeDeviceId.value || !runtimeProductId.value) {
    return
  }

  const id = `instance-info-property-${runtimeDeviceId.value}-${runtimeProductId.value}-${dataSource.value.map((item) => item.id).join('-')}`
  const topic = `/dashboard/device/${runtimeProductId.value}/properties/realTime`
  subRef.value = wsClient.getWebSocket(id, topic, {
    deviceId: runtimeDeviceId.value,
    properties: dataSource.value.map((item) => item.id),
    history: 1
  })
    ?.pipe(map((res: any) => res.payload))
    .subscribe((payload) => {
      if (payload.value?.property) {
        messageCache.set(payload.value?.property, payload)
        throttleFn()
      }
    })
}

const getDashboard = async () => {
  if (!dataSource.value?.length || !runtimeDeviceId.value || !runtimeProductId.value) {
    subRef.value && subRef.value?.unsubscribe()
    return
  }
  const param = [
    {
      dashboard: 'device',
      object: runtimeProductId.value,
      measurement: 'properties',
      dimension: 'history',
      params: {
        deviceId: runtimeDeviceId.value,
        history: 1,
        properties: dataSource.value.map((item) => item.id)
      }
    }
  ]

  const resp: Record<string, any> = await dashboard(param)
  if (resp.status === 200) {
    const t1 = (resp.result || []).map((item: any) => {
      return {
        timeString: item.data?.timeString,
        timestamp: item.data?.timestamp,
        ...item?.data?.value
      }
    })
    const obj = {}
    toArray(groupBy(t1, 'property'))
      .map((item) => {
        return {
          list: item.sort((a, b) => b.timestamp - a.timestamp),
          property: item[0].property
        }
      })
      .forEach((item) => {
        obj[item.property] = item.list[0]
      })
    propertyValue.value = { ...unref(propertyValue), ...obj }
  }
  subRef.value && subRef.value?.unsubscribe()
  subscribeProperty()
}

const resolveMetadata = async () => {
  if (!isProduct.value) { // 设备详情页面时
    metadataText.value = instanceStore.current.metadata || instanceStore.detail.metadata || ''
    deviceName.value = instanceStore.current.name || instanceStore.detail.name || ''
    runtimeProductId.value = String(instanceStore.current.productId || instanceStore.detail.productId || '')
    return
  }

  if (!targetDeviceId.value) {
    metadataText.value = productStore.detail.metadata || ''
    deviceName.value = ''
    runtimeProductId.value = String(productStore.detail.id || '')
    return
  }

  const response = await detail(targetDeviceId.value, true)
  deviceDetail.value = response.result
  metadataText.value = response.result?.metadata
  deviceName.value = response.result.name || ''
  runtimeProductId.value = String(response.result?.productId || '')
}

const handleProperty = debounce(async () => {
  subRef.value && subRef.value?.unsubscribe()
  messageCache.clear()
  propertyValue.value = {}
  await resolveMetadata()

  const _value = props.info.componentProps.propertyShowCard.value || []
  const _data: Record<string, any>[] = []
  _value.forEach((key: any) => {
    const property = propertyMap.value.get(key)

    if (property) {
      _data.push(property)
    }
  })
  dataSource.value = cloneDeep(_data)
  getMetric()
  if (messageCache.size === 0) {
    await getDashboard()
  }
}, 300)

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
      _metric?.includes(data.id) &&
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

const getMetric = async (arr = []) => {
  const _id = isProduct.value ? targetDeviceId.value : instanceStore.current.id
  if (!_id) return
  const resp = await queryPropertyMetric(_id, arr)
  if (resp.success) {
    metric.value = resp.result.filter((i: any) => i.metrics.length).map((item: any) => item.property)
  }
}


onUnmounted(() => {
  handleProperty.cancel()
  subRef.value && subRef.value?.unsubscribe()
})

watch(
  () => [props.info, targetDeviceId.value, runtimeDeviceId.value],
  () => {
    handleProperty()
  },
  { immediate: true, deep: true }
)
</script>

<style scoped lang="less">
.property-show-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: #fff;
  padding: 12px;
}

.property-show-card__header {
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
}

.property-show-card__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 24px;
  overflow: auto;
}

.property-show-card__item {
  flex: 1 1 250px;
  min-width: 250px;
  max-width: 100%;
  box-sizing: border-box;
}

.property-show-card__item-card,
.property-show-card__empty-card {
  width: 100%;
  min-width: 250px;
  max-width: 100%;
  background-color: #fff;
}

.property-show-card__empty-card {
  flex: 1 1 250px;
}
</style>
