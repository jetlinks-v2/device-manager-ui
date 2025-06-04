<template>
  <div class="chart">
    <div class="chart-item">
      <DataTrend/>
    </div>
    <div class="chart-item">
      <HistoryPush/>
    </div>
    <div class="chart-item">
      <PushTime/>
    </div>
  </div>
</template>

<script setup>
import DataTrend from './DataTrend.vue'
import HistoryPush from './HistoryPush.vue'
import PushTime from './PushTime.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
</script>

<style lang="less" scoped>
.chart {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  &-item:nth-child(1) {
    grid-column: 1 / -1;
  }

  &-item {
    padding: 16px;
    border: 1px solid #B9B9B9;
    border-radius: 6px;

    .title {
      color: #1A1A1A;
    }
  }
}
</style>
