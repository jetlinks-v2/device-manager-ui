<template>
  <div class="container">
    <component
      :is="_component"
      :info="_info"
      :isEdit="false"
    />
  </div>
</template>

<script setup lang="ts" name="DeviceVideo">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { debounce } from 'lodash-es'

const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  },
  style: {
    type: Object,
    default: () => ({})
  }
})

const { ResourceBasicComponentsInstance } = moduleRegistry.getResource('visualization-resources', 'events')
const _component = ResourceBasicComponentsInstance['AMap']?.component
let events: any = []

const _dataMap = ref<Record<string, any>>({})
const _info = ref({...props.info})

const flushInfo = debounce(() => {
  _info.value = {
    ...props.info,
    dataSourceProps: handleData(_dataMap.value)
  }
}, 0)

const handleData = (dataMap: Record<string, any>) => {
  const _dataSourceProps: any = {
    mode: 'static',
    type: 'array',
    defaultValue: []
  }

  const options: any[] = props.info?.extraProps?.options || []

  for (const key in dataMap) {
    const data = dataMap[key]
    // 通过 key 匹配对应的 option（key 格式：deviceId_geoId_geoSource）
    const option = options.find((opt: any) => {
      const geo = opt.config?.geo
      return `${opt.deviceId}_${geo?.geoId}_${geo?.geoSource}` === key
    })
    if (!option) continue

    const geo = option.config?.geo
    // title 取 mappingName
    const title = option.mappingName || ''

    // 经纬度：从 data[geoId] 里取 lon/lat
    const geoPoint = data[geo?.geoId] || {}
    let longitude = geoPoint.lon ?? geoPoint.longitude ?? ''
    let latitude = geoPoint.lat ?? geoPoint.latitude ?? ''

    // 处理经纬度可能是字符串格式 "105.930395,29.722573"
    if (typeof geoPoint === 'string' && geoPoint.includes(',')) {
      const [lon, lat] = geoPoint.split(',').map((v: string) =>Number( v.trim()))
      longitude = lon
      latitude = lat
    }

    // extData：geoExtra 里配置的字段名从 data 里取值
    const extData = (geo?.geoExtra || []).map((field: string) => ({
      name: field,
      value: data[field] ?? ''
    }))

    _dataSourceProps.defaultValue.push({
      title,
      longitude,
      latitude,
      extData
    })
  }
  console.log('_dataSourceProps',_dataSourceProps);
  
  return _dataSourceProps
}

watch(
  () => props.info.extraProps.options,
  (val) => {
    events?.forEach((event: any) => event?.())
    events = []
    if (!val || !val.length) return
    val.forEach((item: any) => {
      const geo = item.config.geo
      const id = `${item.deviceId}_${geo.geoId}_${geo.geoSource}`
      events.push(
        (window as any).$viewDataEventBus?.subscribe(id, (data: any) => {
          _dataMap.value[id] = data
          flushInfo()
        })
      )
    })
  },
  { deep: true, immediate: true }
)


onBeforeUnmount(() => {
  events?.forEach((event: any) => event?.())

})
</script>

<style lang="less" scoped>
.container {
  width: 100%;
  height: 100%;
  padding: 6px;
  display: flex;
  align-content: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #eee;
  background-color: #eee;
}
</style>
