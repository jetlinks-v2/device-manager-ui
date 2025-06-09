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
    <div style="height: 300px;">
      <JEcharts :options="echartsOptions"/>
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
  legend: {
    top: 'bottom'
  },
  series: [
    {
      name: 'Access From',
      type: 'pie',
      radius: ['40%', '70%'],
      label: {
        show: false,
      },
      // emphasis: {
      //   label: {
      //     show: true,
      //     fontSize: 20,
      //     fontWeight: 'bold'
      //   }
      // },
      labelLine: {
        show: false
      },
      data: [
        { value: 1048, name: '低延迟' },
        { value: 735, name: '中延迟' },
        { value: 580, name: '高延迟' }
      ]
    }
  ]
}
</script>

<style lang="less" scoped>

</style>
