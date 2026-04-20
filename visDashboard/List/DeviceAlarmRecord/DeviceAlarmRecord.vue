<template>
  <div
    class="alarm-record-container"
    ref="containerRef"
  >
    <a-table
      :columns="columns"
      :data-source="mockData"
      :size="config.tableSize"
      :pagination="false"
      :scroll="{ y: scrollY }"
      :row-key="(record) => record.id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'alarmStatus'">
          <span :class="['status-tag', record.status]">
            <span class="status-icon">💚</span>
            {{ getStatusText(record.status) }}
          </span>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  }
})

const containerRef = ref<HTMLElement | null>(null)
const scrollY = ref<number | string>(300)

const config = computed(() => {
  return props.info?.componentProps?.deviceAlarmRecord || {}
})

// 模拟数据
const mockData = ref([
  {
    id: '1',
    status: 'normal',
    device: '排风机',
    rule: '规则',
    message: '温度:63℃',
    time: '2023-02-25 09:40:19'
  },
  {
    id: '2',
    status: 'warning',
    device: '温湿度传感器',
    rule: '湿度报警',
    message: '湿度超过阈值',
    time: '2023-02-25 09:35:10'
  },
  {
    id: '3',
    status: 'critical',
    device: '烟雾报警器',
    rule: '烟雾报警',
    message: '烟雾浓度异常',
    time: '2023-02-25 09:30:05'
  }
])

const columns = [
  {
    title: '告警状态',
    dataIndex: 'status',
    key: 'alarmStatus',
    width: 100
  },
  {
    title: '设备',
    dataIndex: 'device',
    key: 'device',
    width: 120
  },
  {
    title: '告警规则',
    dataIndex: 'rule',
    key: 'rule',
    width: 120
  },
  {
    title: '告警信息',
    dataIndex: 'message',
    key: 'message'
  },
  {
    title: '时间',
    dataIndex: 'time',
    key: 'time',
    width: 180
  }
]

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    critical: '严重'
  }
  return map[status] || '未知'
}

let resizeObserver: ResizeObserver | null = null

const computeScrollY = () => {
  if (containerRef.value) {
    const containerHeight = containerRef.value.clientHeight
    const headerHeight = config.value.tableSize === 'small' ? 40 : 55
    scrollY.value = containerHeight - headerHeight
  }
}

onMounted(() => {
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
.alarm-record-container {
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

    .ant-table-tbody > tr > td {
      border-bottom: 1px solid #f0f0f0;
    }

    .ant-table-tbody > tr:hover > td {
      background: rgba(0, 0, 0, 0.02);
    }
  }
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;

  .status-icon {
    font-size: 14px;
  }

  &.normal {
    color: #52c41a;
  }

  &.warning {
    color: #faad14;
  }

  &.critical {
    color: #ff4d4f;
  }
}
</style>
