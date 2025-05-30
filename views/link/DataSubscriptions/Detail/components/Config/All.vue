<template>
  <div class="all-content">
    <img :src="dataSubscriptions.allIconImg" :width="126" />
    <div class="desc">
      {{ data.type !== 'device' ?
        '该模式下推送当前用户数据权限范围内所有告警数据，包含告警配置告警，属性阈值告警，数采点位告警等' :
        '该模式下推送当前用户数据权限范围内所有设备数据，当新增/删除设备时，订阅设备列表实时同步更新。'
      }}
    </div>
  </div>
</template>

<script setup>
import {dataSubscriptions} from '@device/assets/data-subscriptions'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({type: 'device'}),
  },
})
</script>

<style lang="less" scoped>
.all-content {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  height: 100%;

  img {
    margin-bottom: 16px;
  }
}
.desc {
  color: #777777;
  width: 40%;
  text-align: center;
  line-height: 24px;
}
</style>
