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
        class="icon-wrapper"
        @click="toggleSwitch(item)"
      >
        <span
          :class="getIconAnimationClass(getCheckedStatus(item), item.config)"
          :style="getIconStyle(getCheckedStatus(item), item.config)"
        >
          <AIcon
            :type="getCheckedStatus(item) ? item.config?.onType : item.config?.offType"
            :style="{
              color: getCheckedStatus(item) ? item.config.onColor : item.config.offColor,
              fontSize: '32px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }"
          />
        </span>
        <div class="icon-label">{{ item.mappingName || item.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="SwitchTwo">
import { useControl } from '@visualization-dashboard-ui/hooks/useControl'
import { useDashboardData } from '../../../../hooks/useDashboardData'
import { useGridLayout } from '../../../../hooks/useGridLayout'

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

const { dataSourceList, getValue, setValue } = useDashboardData(props, 'switchTwo')

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '100px',
  maxWidthForFew: '160px',
  fewThreshold: 3
})

const { executeFunction } = useControl()
// 切换开关状态
const toggleSwitch = (item: any) => {
  const currentChecked = getCheckedStatus(item)
  const nextChecked = !currentChecked
  item.checked = nextChecked

  const trueValue = item.config?.trueValue ?? true
  const falseValue = item.config?.falseValue ?? false
  const newValue = nextChecked ? trueValue : falseValue

  if (item.isMock) {
    item.value = newValue
  } else {
    // 更新本地数据
    setValue(item, newValue)
    executeFunction(item, currentChecked)
  }
}

const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return record.checked || false
  }

  const trueValue = record.config?.trueValue ?? true
  return String(value) === String(trueValue)
}

const getIconAnimationClass = (isOn: boolean, config: any) => {
  const animation = isOn ? config.onAnimation : config.offAnimation
  if (!animation || animation === 'none') return ''
  return `anim-${animation}`
}

const getIconStyle = (isOn: boolean, config: any) => {
  const speed = isOn ? (config.onSpeed ?? 1) : (config.offSpeed ?? 1)
  return {
    '--anim-speed': `${speed}s`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
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

  .list-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .icon-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }

      .icon-label {
        color: inherit;
        text-align: center;
        user-select: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 90px;
      }

      span {
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
    }
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
