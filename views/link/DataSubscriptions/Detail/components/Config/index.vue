<template>
  <a-modal visible title="配置" :width="1200" @cancel="emits('close')">
    <h3>订阅模式</h3>
    <TabSelect :options="options" v-model:active-key="activeKey"/>
    <div class="config-content">
      <component :is="components[activeKey]" />
    </div>
  </a-modal>
</template>

<script setup>
import TabSelect from '../TabSelect.vue'
import {dataSubscriptions} from '@device/assets/data-subscriptions'
import _Self from './_Self.vue'
import All from './All.vue'
import Org from './Org.vue'
import Product from './Product.vue'
import AlarmType from './AlarmType.vue'
import AlarmLevel from './AlarmLevel.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['close', 'save']);
const activeKey = ref('_Self')
const options = computed(() => {
  return props.data.type === 'device' ? [
    {
      label: '自定义',
      value: '_Self',
      desc: '自定义选择任意设备',
      img: dataSubscriptions._selfImg
    },
    {
      label: '全部',
      value: 'All',
      desc: '选择所有设备',
      img: dataSubscriptions.allImg
    },
    {
      label: '按组织',
      value: 'Org',
      desc: '选择归属于具体组织的设备',
      img: dataSubscriptions.orgImg
    },
    {
      label: '按产品',
      value: 'Product',
      desc: '选择具体产品下的设备',
      img: dataSubscriptions.productImg
    },
  ] : [
    {
      label: '全部',
      value: 'All',
      desc: '选择所有告警',
      img: dataSubscriptions.allImg
    },
    {
      label: '按告警类型',
      value: 'AlarmType',
      desc: '按告警类型选择对应告警',
      img: dataSubscriptions.productImg
    },
    {
      label: '按告警级别',
      value: 'AlarmLevel',
      desc: '按告警级别选择对应告警',
      img: dataSubscriptions.orgImg
    },
  ]
})

const components = {
  _Self,
  All,
  Org,
  Product,
  AlarmType,
  AlarmLevel,
}
</script>

<style lang="less" scoped>
.config-content {
  margin-top: 16px;
  display: flex;
  height: 450px;
  flex-direction: column;
}
</style>
