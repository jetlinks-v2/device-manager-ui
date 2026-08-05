<template>
  <div
    ref="containerRef"
    class="device-card-container"
    :style="containerStyle"
  >
    <div
      v-for="device in deviceListData"
      :key="device.id"
      class="device-card"
      :class="{ selected: selectedDeviceId === device.id }"
      :style="cardStyle(device)"
      @click="selectDevice(device.id)"
    >
      <div class="card-content">
        <div class="device-name">{{ device.name }}</div>
        <div class="device-time">{{ device.activeTime }}</div>
        <div class="device-status-row">
          <span :class="['online-status', device.online ? 'online' : 'offline']">
            <span class="status-icon">⚡</span>
            {{ device.online ? '在线' : '离线' }}
          </span>
          <!-- <span
            v-if="device.alarmLevel !== 'none'"
            :class="['alarm-status', device.alarmLevel]"
          >
            <span class="alarm-icon">💗</span>
            {{ getAlarmText(device.alarmLevel) }}
          </span> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {moduleRegistry} from "@jetlinks-web-core/utils/module-registry";

const { useDeviceListData } = moduleRegistry.getResource('visualization-dashboard-ui', 'hooks')


const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  }
})

const containerRef = ref<HTMLElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null

const config = computed(() => {
  return props.info?.componentProps?.deviceCard || {}
})

// 列表数据获取
const { deviceListData, selectedRowKey: selectedDeviceId } = useDeviceListData(props, config)

const containerStyle = computed(() => {
  const gap = Number(config.value.gap ?? 12)
  const minCardWidth = 250
  const minCardHeight = 100
  const maxCardWidth = 400
  const maxCardHeight = 150
  const total = deviceListData.value.length || 1

  const width = containerSize.value.width
  const height = containerSize.value.height

  if (!width || !height) {
    const fallbackCols = Math.max(1, Math.ceil(Math.sqrt(total)))
    const fallbackRows = Math.ceil(total / fallbackCols)
    const fallbackRowHeight = Math.min(maxCardHeight, Math.max(minCardHeight, (height || minCardHeight) / fallbackRows))
    return {
      gap: `${gap}px`,
      gridTemplateColumns: `repeat(${fallbackCols}, minmax(${minCardWidth}px, ${maxCardWidth}px))`,
      gridAutoRows: `${Math.floor(fallbackRowHeight)}px`,
      justifyContent: 'center'
    }
  }

  const maxColsByWidth = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)))
  const rowsByHeight = Math.max(1, Math.floor((height + gap) / (minCardHeight + gap)))
  const idealCols = Math.ceil(total / rowsByHeight)
  const cols = Math.min(maxColsByWidth, Math.max(1, idealCols))
  const rows = Math.ceil(total / cols)

  const colWidth = Math.min(maxCardWidth, (width - gap * (cols - 1)) / cols)
  const rowHeight = Math.min(maxCardHeight, Math.max(minCardHeight, (height - gap * (rows - 1)) / rows))

  return {
    gap: `${gap}px`,
    gridTemplateColumns: `repeat(${cols}, ${Math.floor(colWidth)}px)`,
    gridAutoRows: `${Math.floor(rowHeight)}px`,
    justifyContent: 'center'
  }
})

const cardStyle = computed(() => (device: any) => {
  const isSelected = selectedDeviceId.value === device.id
  const styles: Record<string, string> = {
    backgroundColor: isSelected ? config.value.cardSelectedBgColor : config.value.cardBgColor,
    borderRadius: `${config.value.borderRadius ?? 8}px`
  }

  if (config.value.showBorder) {
    styles.border = `${config.value.borderWidth ?? 1}px solid ${config.value.borderColor || '#e8e8e8'}`
  }

  if (config.value.showShadow) {
    const size = config.value.shadowSize ?? 8
    styles.boxShadow = `0 2px ${size}px rgba(0, 0, 0, 0.08)`
  }

  return styles
})

/* const getAlarmText = (level: string) => {
  const map: Record<string, string> = {
    critical: '重要告警',
    warning: '普通告警',
    none: ''
  }
  return map[level] || ''
} */

const selectDevice = (id: string) => {
  selectedDeviceId.value = id
}

onMounted(() => {
  if (config.value.selectFirstByDefault && deviceListData.value.length > 0) {
    selectedDeviceId.value = deviceListData.value[0].id
  }

  if (!containerRef.value) return

  resizeObserver = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect
    containerSize.value = {
      width: Math.floor(width),
      height: Math.floor(height)
    }
  })

  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped lang="less">
.device-card-container {
  width: 100%;
  height: 100%;
  display: grid;
  grid-auto-flow: row dense;
  overflow: auto;
  align-content: stretch;
  padding: 16px;
  box-sizing: border-box;
}

.device-card {
  display: flex;
  padding: 16px;
  cursor: pointer;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  height: 100%;

  &.selected {
    border-color: #1890ff !important;
  }
}

.card-content {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-time {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.device-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 4px;

  .status-icon {
    font-size: 14px;
  }

  &.online {
    color: #52c41a;
  }

  &.offline {
    color: #999;
  }
}

.alarm-status {
  display: flex;
  align-items: center;
  gap: 4px;

  .alarm-icon {
    font-size: 14px;
  }

  &.critical {
    color: #ff4d4f;
  }

  &.warning {
    color: #faad14;
  }
}
</style>
