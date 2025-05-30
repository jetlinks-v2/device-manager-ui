<template>
  <a-drawer visible :width="900" :mask="false">
    <template #closeIcon>
      <AIcon type="MenuUnfoldOutlined" />
    </template>
    <template #title>
      <div class="header">
        <div><AIcon type="icon-shebei" /></div>
        <div>A传感器设备属性</div>
        <AIcon type="EditOutlined" />
        <a-tag>禁用</a-tag>
      </div>
    </template>
    <template #extra>
      <a-space>
        <a-button type="link" danger>
          <AIcon type="DeleteOutlined"/>
        </a-button>
      </a-space>
    </template>
   <div class="content">
     <div class="top-content">
       <div class="top-content-item">
         <div class="top-content-item-label">订阅类型</div>
         <div class="top-content-item-type"><AIcon type="icon-shebei1" />设备数据</div>
       </div>
       <div class="top-content-item">
         <div class="top-content-item-label">说明</div>
         <div class="top-content-item-desc">--<AIcon type="EditOutlined" /></div>
       </div>
     </div>
     <a-tabs v-model:activeKey="activeKey">
       <a-tab-pane v-for="item in tabList" :key="item.key" :tab="item.tab"/>
     </a-tabs>
     <div class="tabs-content">
       <component :is="components[activeKey]" :data="data"/>
     </div>
   </div>
  </a-drawer>
</template>

<script setup>
import Subscription from './Subscription/index.vue'
import PushConfig from './PushConfig/index.vue'
import PushLog from './PushLog/index.vue'
import DataMonitor from './DataMonitor/index.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['close'])

const tabList = [
  {
    key: 'Subscription',
    tab: '订阅配置',
  },
  {
    key: 'PushConfig',
    tab: '推送配置',
  },
  {
    key: 'PushLog',
    tab: '推送记录',
  },
  {
    key: 'DataMonitor',
    tab: '数据监控',
  }
]

const activeKey = ref('Subscription')

const components = {
  Subscription,
  PushConfig,
  PushLog,
  DataMonitor
}
</script>

<style lang="less" scoped>
.content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header, .top-content {
  display: flex;
  align-items: center;
  gap: 16px
}

.top-content-item {
  display: flex;
  align-items: center;
  gap: 16px;

  &-label {
    color: #777777;
  }

  &-type {
    background: #F5F5F5;
    border-radius: 50px;
    padding: 8px 24px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
}

.tabs-content {
  flex: 1;
  min-height: 0;
}
</style>

