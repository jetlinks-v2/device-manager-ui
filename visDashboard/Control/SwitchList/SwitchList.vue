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
      <div class="item-left">
        <span
          class="icon-wrapper"
          :class="getIconAnimationClass(item.config)"
          :style="getIconStyle(item.config)"
        >
          <AIcon
            :type="item.config.iconType || 'BulbOutlined'"
            :style="{
              color: item.config.iconColor || '#ffcc80',
              fontSize: '18px'
            }"
          />
        </span>
        <span>{{ item.mappingName || item.name }}</span>
      </div>
      <div>
        <a-switch
          :checked="getCheckedStatus(item)"
          @change="(checked) => handleSwitchChange(item, checked)"
          :style="{
            '--switch-color': item.config.switchColor || '#1890ff'
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="SwitchList">
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
  }
})

const { dataSourceList, getValue, setValue } = useDashboardData(props, 'switchList')

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '160px',
  maxWidthForFew: '320px',
  fewThreshold: 3
})

// 使用 useControl hook
const { executeFunction } = useControl()

// 根据订阅数据计算 checked 状态
const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return record.checked || false
  }

  const trueValue = record.config?.trueValue ?? true
  return String(value) === String(trueValue)
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

const getIconAnimationClass = (itemConfig: any) => {
  const animation = itemConfig.iconAnimation
  if (!animation || animation === 'none') return ''
  return `anim-${animation}`
}

const getIconStyle = (itemConfig: any) => {
  const speed = itemConfig.iconSpeed ?? 1
  const color = itemConfig.iconColor || '#ffcc80'
  return {
    '--anim-speed': `${speed}s`,
    color: color
  }
}
</script>

<style lang="less" scoped>
.container {
  width: 100%;
  height: 100%;
  padding: 0 16px;
  display: grid;
  column-gap: 24px;
  row-gap: 16px;
  align-content: center;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 4px;
    transition: background-color 0.3s;

    &:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }

    .item-left {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;

      .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    :deep(.ant-switch-checked) {
      background-color: var(--switch-color, #1890ff);
    }
  }
}

.icon-wrapper {
  &.anim-clockwise {
    animation: rotate-clockwise var(--anim-speed) linear infinite;
  }

  &.anim-anticlockwise {
    animation: rotate-anticlockwise var(--anim-speed) linear infinite;
  }

  &.anim-shake {
    animation: shake var(--anim-speed) ease-in-out infinite;
  }
}

@keyframes rotate-clockwise {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes rotate-anticlockwise {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg);
  }
  75% {
    transform: rotate(-15deg);
  }
}
</style>
