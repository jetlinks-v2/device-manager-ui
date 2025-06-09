<template>
  <div>
    <div class="header">
      <div class="title">{{ $t('DataSubscriptions.Detail.index.697323-49') }}</div>
      <JDashboardTimeSelect
          type="hour"
          :quickBtnList="[
                    { label: $t('DashBoard.index.753511-3'), value: 'hour' },
                    { label: $t('DashBoard.index.753511-4'), value: 'day' },
                    { label: $t('DashBoard.index.753511-5'), value: 'week' },
                  ]"
          @change="initQueryTime"
      />
    </div>
    <div style="height: 250px;">
      <JEcharts :options="echartsOptions"/>
    </div>
  </div>
</template>

<script setup>
import {useI18n} from "vue-i18n";

const props = defineProps({
  data: {
    type: Object,
    default: undefined
  }
})
const {t: $t} = useI18n();
const serverData = reactive({
  xAxis: [],
  data: [],
})

const loading = ref(false);
const isEmpty = ref(false);

const colorCpu = ['#313CA9', '#21CCFF', '#249EFF', '#86DF6C', '#979AFF']


const echartsOptions = computed(() => {
  return {
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: serverData.xAxis,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${value}%`,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value} %'
      }
    },
    grid: {
      left: '54px',
      right: '54px',
      top: '10px',
    },
    color: colorCpu,
    series: [
      {
        name: $t('system-monitor.basic_monitor.system.cpu.usage'),
        data: serverData.data,
        type: 'line',
      },
    ]
  };
})
const getCPUEcharts = async (val) => {
  loading.value = true;

  setTimeout(() => {
    loading.value = false;
  }, 300);
};

const initQueryTime = (data) => {

};

watch(
    () => props.data,
    (value) => {
      if (value === undefined) return;
      getCPUEcharts(value);
    },
    {immediate: true, deep: true},
);

</script>

<style lang="less" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
