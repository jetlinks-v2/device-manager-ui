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
        :class="getAnimationClass(getCheckedStatus(item))"
        :style="getIconStyle(getCheckedStatus(item))"
      >
        <AIcon :type="getCheckedStatus(item) ? config.onIcon : config.offIcon" />
      </div>
      <div class="label">{{ item.name }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  }
})

const { dataSourceList, getValue } = useDashboardData(props, 'switchStatusOne')

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '90px',
  maxWidthForFew: '180px',
  fewThreshold: 3
})

const config = computed(() => {
  return props.info?.componentProps?.switchStatusOne || {}
})

const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return !!record.value
  }

  const trueValue = record.config?.trueValue ?? true
  return value === trueValue || String(value) === String(trueValue)
}

const getAnimationClass = (activeValue: boolean) => {
  const anim = activeValue ? config.value.onAnimation : config.value.offAnimation
  return anim && anim !== 'none' ? `anim-${anim}` : ''
}

const getIconStyle = (activeValue: boolean) => {
  const color = activeValue ? config.value.onIconColor : config.value.offIconColor
  const speed = activeValue ? config.value.onAnimationSpeed : config.value.offAnimationSpeed

  return {
    color: color,
    fontSize: '32px',
    '--anim-speed': `${speed || 1}s` // 根据之前 SwitchList 调整的逻辑，speed 现在通常定义为秒数
  }
}
</script>

<style scoped lang="less">
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
    gap: 8px;

    .icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.3s ease;

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

    .label {
      font-size: 14px;
      color: inherit;
      text-align: center;
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
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
