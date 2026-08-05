<template>
  <div class="numerical-list-container">
    <div
      v-for="item in dataSourceList"
      :key="item.key"
      class="list-item"
    >
      <div class="item-left">
        <span
          class="item-icon"
          :style="{ color: config.iconColor }"
        >
          <AIcon :type="config.icon" />
        </span>
        <span class="item-label">{{ item.name }}</span>
      </div>
      <div class="item-value">
        <span class="value-text">{{ getValue(item) ?? item.value ?? '--' }}</span>
        <span
          v-if="config.unit"
          class="unit-text"
        >
          {{ config.unit }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDashboardData } from '@visualization-dashboard-ui/hooks/useDashboardData'

const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  }
})

const { dataSourceList, getValue } = useDashboardData(props, 'numericalListOne')

const config = computed(() => {
  return props.info?.componentProps?.numericalListOne || {}
})
</script>

<style scoped lang="less">
.numerical-list-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  overflow: auto;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  font-size: 24px;
}

.item-label {
  font-size: 15px;
  color: #333;
}

.item-value {
  font-size: 15px;
  color: #666;
  font-weight: 500;
  display: flex;
  align-items: baseline;

  .unit-text {
    margin-left: 4px;
    font-size: 13px;
    color: #999;
    font-weight: normal;
  }
}
</style>
