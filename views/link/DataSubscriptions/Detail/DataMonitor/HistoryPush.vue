<template>
  <div>
    <div class="title">{{ $t('DataSubscriptions.Detail.index.697323-50') }}</div>
    <div class="box">
      <div style="height: 250px; flex: 1; min-width: 0;background-color: #7f7f7f">
        <JEcharts :options="option"/>
      </div>
      <div class="right">
        <div>
          <div class="value">2147</div>
          <div class="label">推送成功数</div>
        </div>
        <div>
          <div class="value">245</div>
          <div class="label">推送失败数</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import 'echarts-liquidfill'
import {useI18n} from "vue-i18n";

const {t: $t} = useI18n();
const option = {
  series: [{
    type: 'liquidFill',
    data: [0.6, 0.5, 0.3],
    label: {
      show: true,
      color: '#294D99',
      insideColor: '#fff',
      fontSize: 30,
      fontWeight: 'bold',
      align: 'center',
      baseline: 'middle',
      position: 'inside',
    },
    animationDuration: 0,
    animationDurationUpdate: 2000,
    animationEasingUpdate: 'cubicOut',
    outline: {
      show: true,
      borderDistance: 10,
      itemStyle: {
        borderColor: '#C3C7CB',
        borderWidth: 1,
        shadowColor: 'none'
      }
    },
  }]
};
</script>

<style lang="less" scoped>
.box {
  display: flex;
  align-items: center;

  .right {
    padding-right: 24px;
  }
}
.value {
  font-size: 26px;
  color: #1A1A1A;
  font-weight: 500;
}

.label {
  color: #777777;
}
</style>
