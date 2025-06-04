<template>
  <div>
    <div class="title">
      历史推送耗时占比
      <a-tooltip title="仅计算成功推送的数据">
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
