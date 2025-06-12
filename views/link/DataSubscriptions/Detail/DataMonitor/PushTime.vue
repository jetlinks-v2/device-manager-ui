<template>
  <div>
    <div class="title">
      {{ $t('DataSubscriptions.Detail.index.697323-51') }}
      <a-tooltip :title="$t('DataSubscriptions.Detail.index.697323-52')">
        <AIcon
            type="QuestionCircleOutlined"
            style="color: #a6a6a6"
        />
      </a-tooltip>
    </div>
    <div style="height: 280px;">
      <JEcharts :options="echartsOptions"/>
    </div>
    <div class="legend">
      <div class="item">
        <div class="icon"></div>
        低延迟 &lt;100ms <span>34.3%</span></div>
      <div class="item">
        <div class="icon icon1"></div>
        中延迟 100ms-1s <span>34.3%</span></div>
      <div class="item">
        <div class="icon icon2"></div>
        高延迟 &gt;100ms <span>34.3%</span></div>
    </div>
  </div>
</template>

<script setup>
import {useI18n} from "vue-i18n";

const {t: $t} = useI18n();
const echartsOptions = {
  tooltip: {
    trigger: 'item',
  },
  title: {
    text: '45ms',
    subtext: '平均耗时',
    fontSize: 20,
    left: 'center',
    top: 'center',
  },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      labelLine: {
        show: false
      },
      label: {
        show: false,
      },
      color: ['#0080FE', '#C3C7CB', '#E4E6E7'],
      data: [
        {value: 1048, name: '低延迟'},
        {value: 735, name: '中延迟'},
        {value: 580, name: '高延迟'}
      ]
    }
  ]
}
</script>

<style lang="less" scoped>
.legend {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;

  .item {
    width: 240px;
    display: flex;
    align-items: center;
    gap: 24px;
    padding-bottom: 12px;

    .icon {
      width: 16px;
      height: 16px;
      background: #0080FE;
    }

    .icon1 {
      background: #C3C7CB;
    }

    .icon2 {
      background: #E4E6E7;
    }

    span {
      color: @primary-color;
    }
  }
}
</style>
