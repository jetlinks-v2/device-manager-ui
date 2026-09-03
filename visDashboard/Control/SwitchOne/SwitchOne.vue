<template>
  <div
    class="container"
    :style="containerStyle"
  >
    <div
      v-for="item in dataSourceList"
      :key="item.key"
      class="list-item"
    >
      <div
        v-if="item.config.showValue"
        class="switch-value"
      >
        {{ getCheckedLabel(item) }}
      </div>
      <a-switch
        :checked="getCheckedStatus(item)"
        @change="(checked) => handleSwitchChange(item, checked)"
        :style="{
          '--switch-color': item.config.switchColor || '#1890ff'
        }"
      />
      <div class="switch-label">{{ item.mappingName || item.name }}</div>
    </div>
  </div>
</template>

<script setup lang="ts" name="SwitchOne">
import {moduleRegistry} from "@jetlinks-web-core/utils/module-registry";

const { useDashboardData, useGridLayout, useControl } = moduleRegistry.getResource('visualization-dashboard-ui', 'hooks')


const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  },
  style: {
    type: Object,
    default: () => ({})
  },
  systemData: {
    type: Object,
    default: () => ({})
  }
})

const { dataSourceList, getValue, setValue } = useDashboardData(props, 'switchOne')
const { executeFunction } = useControl()

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '80px',
  maxWidthForFew: '160px',
  fewThreshold: 3
})

const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return record.checked || false
  }

  const trueValue = record.config?.trueValue ?? true
  return String(value) === String(trueValue)
}
const getCheckedLabel = (record: any) => {
  const checked = getCheckedStatus(record)

  let str
  if (record.isMock) {
    str = checked ? 'ON' : 'OFF'
  } else {
    if (record.config.showLabel) {
      str = checked ? record.config?.trueValue : record.config?.falseValue
    } else {
      str = getValue(record)
    }
  }
  return str || (checked ? 'ON' : 'OFF')
}

// 处理开关切换
const handleSwitchChange = (record: any, checked: any) => {
  record.checked = checked
  const trueValue = record.config?.trueValue ?? true
  const falseValue = record.config?.falseValue ?? false
  const newValue = checked ? trueValue : falseValue

  if (record.isMock) {
    record.value = newValue
  } else {
    // 更新本地数据
    setValue(record, newValue)
    executeFunction(record, checked)
  }
}
</script>

<style lang="less" scoped>
.container {
  width: 100%;
  height: 100%;
  display: grid;
  row-gap: 16px;
  align-content: center;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 16px;

  .list-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;

    .switch-value {
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      opacity: 0.8;
      min-height: 20px;
    }

    .switch-label {
      font-size: 14px;
      color: inherit;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
    }

    // 标准开关颜色自定义
    :deep(.ant-switch-checked) {
      background-color: var(--switch-color, #1890ff);
    }
  }
}
</style>
