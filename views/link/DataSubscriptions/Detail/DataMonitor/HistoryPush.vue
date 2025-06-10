<template>
  <div class="history-push">
    <div class="title">{{ $t('DataSubscriptions.Detail.index.697323-50') }}</div>
    <div class="box">
      <div class="left">
        <JEcharts :options="option"/>
      </div>
      <div class="right">
        <div>
          <div class="value">2147</div>
          <div class="label">{{ $t('DataSubscriptions.Detail.index.697323-58') }}</div>
        </div>
        <div>
          <div class="value">245</div>
          <div class="label">{{ $t('DataSubscriptions.Detail.index.697323-59') }}</div>
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
  grid: {
    top: '10px',
    bottom: '10px',
    left: '10px',
    right: '10px',
  },
  series: [{
    type: 'liquidFill',
    data: [ {
      value: 0.8,
      itemStyle: {
        color: 'rgba(22, 119, 255)',
        opacity: 0.4
      },
    }, {
      value: 0.6,
      itemStyle: {
        color: 'rgba(22, 119, 255)',
        opacity: 0.6
      }
    }, {
      value: 0.4,
      itemStyle: {
        color: 'rgba(22, 119, 255)',
        opacity: 0.8
      }
    }],
    label: {
      show: true,
      color: '#294D99',
      insideColor: '#fff',
      fontSize: 30,
      // fontWeight: 'bold',
      // align: 'center',
      // baseline: 'middle',
      // position: 'inside',
      // formatter: '{a}\n{b}\nValue: {c}',
    },
    backgroundStyle: {
      color: 'white'
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
.history-push {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  //overflow: hidden;
}

.box {
  position: relative;
  flex: 1;
  min-height: 0;

  .left {
    height: 140%;
    position: absolute;
    top: -20%;
    left: -20%;
    width: 100%;
  }

  .right {
    width: 100px;
    margin-left: calc(100% - 100px);
    height: 100%;
    justify-content: center;
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 24px;
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
