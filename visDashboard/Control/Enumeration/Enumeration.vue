<template>
  <div
    class="enumeration-container"
    :style="style"
  >
    <div
      v-for="item in dataSourceList"
      :key="item.key"
      class="enumeration-group"
    >
      <div class="group-title">{{ item.mappingName || item.name }}</div>
      <div
        class="tab-items"
        :style="getTabItemsStyle(item)"
      >
        <div
          v-for="(option, index) in getOptions(item)"
          :key="index"
          class="tab-item"
          :class="{ 'tab-item-active': getSelectKey(item) === getOptionValue(option) }"
          :style="getTabItemStyle(item, getOptionValue(option))"
          @click="handleTabClick(item, getOptionValue(option))"
        >
          {{ getOptionLabel(option) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="Enumeration">
import { useDashboardData } from '../../../../hooks/useDashboardData'
import { useControl } from '@visualization-dashboard-ui/hooks/useControl'
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

const { dataSourceList, getValue, setValue } = useDashboardData(props, 'enumeration')
const { executeProperties } = useControl()
const handleTabClick = (item: any, key: string) => {
  if (item.isMock) {
    item.value = key
  } else {
    setValue(item, key)
    executeProperties(item,key)
  }
}

const getOptions = (item: any) => {
  if (item.config?.options && item.config.options.length > 0) return item.config.options
  return [
    { value: 'a', label: '选项A' },
    { value: 'b', label: '选项B' },
    { value: 'c', label: '选项C' }
  ]
}

const getOptionValue = (option: any) => {
  return option.value
}

const getOptionLabel = (option: any) => {
  // 优先使用 label，其次 name，最后 text
  return option.label ?? option.name ?? option.text ?? option.value
}

const getSelectKey = (item: any) => {
  const value = item.isMock ? item.value : getValue(item)
  const opts = getOptions(item)

  if (value !== undefined && value !== null) {
    // 检查当前值是否存在于选项中
    const exists = opts.some((opt: any) => getOptionValue(opt) === value)
    if (exists) return value
  }

  // 默认选中第一项
  if (opts && opts.length > 0) {
    return getOptionValue(opts[0])
  }

  return value
}

const getTabItemsStyle = (item: any) => {
  const conf = item.config || props.info.componentProps?.enumeration || {}
  if (!conf.showBorder) {
    return {
      border: 'none'
    }
  }
  const style: any = {
    borderRadius: `${conf.borderRadius ?? 4}px`
  }

  if (conf.showBorder) {
    style.border = `${conf.borderWidth ?? 4}px solid ${conf.borderColor ?? '#ffffffff'}`
  }

  return style
}

const getTabItemStyle = (item: any, key: string) => {
  const isActive = getSelectKey(item) === key
  const conf = item.config || props.info.componentProps?.enumeration || {}

  return {
    fontSize: `${conf.selectFontSize ?? 14}px`,
    backgroundColor: isActive ? conf.selectBgColor || '#000000ff' : conf.defaultBgColor || '#ffffffff',
    color: isActive ? conf.selectFontColor || '#ffffffff' : conf.defaultFontColor || '#000000ff',
    transition: 'all 0.3s ease'
  }
}
</script>

<style lang="less" scoped>
.enumeration-container {
  width: 100%;
  height: 100%;
  padding: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  // gap: 16px;

  .enumeration-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    // gap: 8px;

    .group-title {
      font-size: 14px;
      color: #666;
      margin-bottom: 4px;
    }

    .tab-items {
      display: flex;
      overflow: hidden;

      .tab-item {
        padding: 8px 16px;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;

        &:hover {
          opacity: 0.8;
        }

        &.tab-item-active {
          font-weight: 500;
        }
      }
    }
  }
}
</style>
