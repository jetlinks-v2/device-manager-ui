<template>
  <div
    class="device-list-container"
    ref="containerRef"
  >
    <a-table
      :columns="columns"
      :data-source="deviceListData"
      :size="config.tableSize"
      :pagination="false"
      :row-class-name="rowClassName"
      :bordered="config.showColumnDivider"
      :row-key="(record) => record.id"
      :custom-row="customRow"
      :scroll="{ y: scrollY }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div class="device-name-cell">
            <span>{{ record.name }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'onlineStatus'">
          <span :class="['status-tag', record.online ? 'online' : 'offline']">
            <span class="status-dot"></span>
            {{ record.online ? '在线' : '离线' }}
          </span>
        </template>
        <template v-else-if="column.key === 'activeTime'">
          <span class="active-time">{{ record.activeTime }}</span>
        </template>
        <!-- <template v-else-if="column.key === 'alarmStatus'">
          <span :class="['alarm-tag', record.alarmLevel]">
            <span
              v-if="record.alarmLevel !== 'none'"
              class="alarm-dot"
            ></span>
            {{ getAlarmText(record.alarmLevel) }}
          </span>
        </template> -->
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { useDeviceListData } from '../../../../hooks/useDeviceListData'

const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  }
})

const containerRef = ref<HTMLElement | null>(null)
const scrollY = ref<number | string>(300)

const config = computed(() => {
  return props.info?.componentProps?.deviceList || {}
})

const { deviceListData, selectedRowKey } = useDeviceListData(props, config)

const columns = computed(() => {
  const cols: any[] = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name'
    }
  ]

  if (config.value.showDeviceType) {
    cols.push({
      title: '设备类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      width: 120
    })
  }

  if (config.value.showOnlineStatus) {
    cols.push({
      title: '在线状态',
      dataIndex: 'online',
      key: 'onlineStatus',
      width: 120
    })
  }

  if (config.value.showActiveTime) {
    cols.push({
      title: '在线/离线时间',
      dataIndex: 'activeTime',
      key: 'activeTime'
    })
  }

  /*   if (config.value.showAlarmStatus) {
    cols.push({
      title: '告警状态',
      dataIndex: 'alarmLevel',
      key: 'alarmStatus',
      align: 'center'
    })
  } */

  return cols
})

/* const getAlarmText = (level: string) => {
  const map: Record<string, string> = {
    critical: '重要告警',
    warning: '一般告警',
    none: '无告警'
  }
  return map[level] || '无告警'
} */

const rowClassName = (record: any) => {
  return selectedRowKey.value === record.id ? 'selected-row' : ''
}

const customRow = (record: any) => {
  return {
    onClick: () => {
      selectedRowKey.value = record.id
    }
  }
}

let resizeObserver: ResizeObserver | null = null

const computeScrollY = () => {
  if (containerRef.value) {
    const containerHeight = containerRef.value.clientHeight
    // 减去表头的大致高度
    const headerHeight = config.value.tableSize === 'small' ? 40 : 55
    scrollY.value = containerHeight - headerHeight
  }
}

onMounted(() => {
  if (config.value.selectFirstByDefault && deviceListData.value.length > 0) {
    selectedRowKey.value = deviceListData.value[0].id
  }

  nextTick(() => {
    computeScrollY()
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(computeScrollY)
      resizeObserver.observe(containerRef.value)
    }
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped lang="less">
.device-list-container {
  width: 100%;
  height: 100%;
  overflow: hidden;

  :deep(.ant-table-wrapper),
  :deep(.ant-spin-nested-loading),
  :deep(.ant-spin-container),
  :deep(.ant-table) {
    height: 100%;
  }

  :deep(.ant-table) {
    background: transparent;

    .ant-table-thead > tr > th {
      background: rgba(0, 0, 0, 0.02);
      font-weight: 600;
      color: #333;
    }

    .ant-table-tbody > tr.selected-row > td {
      background: v-bind('config.selectedRowBgColor') !important;
    }
  }
}

.device-name-cell {
  display: flex;
  align-items: center;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  &.online {
    color: #52c41a;
    .status-dot {
      background: #52c41a;
    }
  }

  &.offline {
    color: #999;
    .status-dot {
      background: #999;
    }
  }
}

.active-time {
  color: #1890ff;
  font-size: 13px;
}

/* .alarm-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;

  .alarm-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  &.critical {
    color: #ff4d4f;
    .alarm-dot {
      background: #ff4d4f;
    }
  }

  &.warning {
    color: #faad14;
    .alarm-dot {
      background: #faad14;
    }
  }

  &.none {
    color: #999;
  }
} */
</style>
