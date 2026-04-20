<template>
  <div
    class="device-map-card"
    :style="style"
  >
    <SectionHeader :title="config.topTitle" />
    <div class="device-map-card__body">
      <a-spin
        :spinning="loading"
        tip="地图加载中"
        class="device-map-card__spin"
      >
        <div
          v-if="supportMessage"
          class="device-map-card__status error"
        >
          {{ supportMessage }}
        </div>
        <div
          v-else-if="error"
          class="device-map-card__status error"
        >
          {{ error }}
        </div>
        <div
          v-else-if="!points.length"
          class="device-map-card__status"
        >
          <a-empty description="暂无设备位置信息" />
        </div>
        <a-map-component
          v-else
          class="device-map-card__map"
          @init="onMapInit"
        >
          <el-amap-marker-cluster
            :points="points"
            :extraOptions="extraOptions"
            @click="onClusterClick"
          />
        </a-map-component>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElAmapMarkerCluster } from '@vuemap/vue-amap'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import SectionHeader from '../components/SectionHeader.vue'
import { useDeviceMap } from '../hooks/useDeviceMap'

defineOptions({
  name: 'DeviceMapCard'
})

const props = defineProps({
  info: {
    type: Object,
    default:  () => ({})
  },
  style: {
    type: Object,
    default:  () => ({})
  },
  isEdit: false
})

const infoRef = toRef(props, 'info')
const isEditRef = toRef(props, 'isEdit')
const system = useSystemStore()

const hasMapKey = computed(() => !!system.systemInfo.amap?.apiKey)
const supportMessage = computed(() => {
  if (!hasMapKey.value) {
    return '未配置高德地图 Key'
  }

  if (!isNoCommunity) {
    return '社区版暂不支持设备地图'
  }

  return ''
})

const isMapEnabled = computed(() => !supportMessage.value)

const { config, points, loading, error, extraOptions, onMapInit, onClusterClick } = useDeviceMap(
  infoRef,
  isEditRef,
  isMapEnabled
)
</script>

<style scoped lang="less">
.device-map-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
  background-color: #fff;
}

.device-map-card__body {
  flex: 1;
  min-height: 320px;
}

.device-map-card__spin,
.device-map-card__spin :deep(.ant-spin-container),
.device-map-card__map {
  width: 100%;
  height: 100%;
}

.device-map-card__status {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.45);
}

.device-map-card__status.error {
  color: #ff4d4f;
}
</style>

<style lang="less">
.device-dashboard-marker-content {
  position: relative;

  .device-dashboard-marker-label {
    position: absolute;
    top: 0;
    left: 50%;
    width: 120px;
    padding: 4px 8px;
    overflow: hidden;
    text-align: center;
    word-break: break-all;
    vertical-align: bottom;
    background-color: #fff;
    border-radius: 4px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -120%);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
}
</style>
