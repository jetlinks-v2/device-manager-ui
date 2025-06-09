<template>
  <a-drawer visible :width="900" :mask="false" @close="emits('close')">
    <template #closeIcon>
      <AIcon type="MenuUnfoldOutlined"/>
    </template>
    <template #title>
      <div class="header">
        <div>
          <AIcon type="icon-shebei"/>
        </div>
        <EditInput :value="data.name" @save="(val) => onSave(val, 'name')">{{ data.name }}</EditInput>
        <a-tag>禁用</a-tag>
      </div>
    </template>
    <template #extra>
      <a-space>
        <template
            v-for="i in getActions({})"
            :key="i.key"
        >
          <j-permission-button
              :disabled="i.disabled"
              :popConfirm="i.popConfirm"
              :tooltip="i.tooltip"
              @click="i.onClick"
              type="link"
              style="padding: 0 5px"
              :danger="i.key === 'delete'"
              :hasPermission="'device/Instance:' + i.key"
          >
            <template #icon>
              <AIcon :type="i.icon" />
            </template>
          </j-permission-button>
        </template>
      </a-space>
    </template>
    <div class="content">
      <div class="top-content">
        <div class="top-content-item">
          <div class="top-content-item-label">{{$t('DataSubscriptions.index.411661-3')}}</div>
          <div class="top-content-item-type">
            <AIcon type="icon-shebei1"/>
            设备数据
          </div>
        </div>
        <div class="top-content-item">
          <div class="top-content-item-label">{{$t('DataSubscriptions.index.411661-5')}}</div>
          <div class="top-content-item-desc">
            <EditInput :value="data.description" @save="(val) => onSave(val, 'description')">{{ data.description || '--' }}</EditInput>
          </div>
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
import EditInput from './components/EditInput.vue'
import {useI18n} from "vue-i18n";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['close'])
const {t: $t} = useI18n();

const tabList = [
  {
    key: 'Subscription',
    tab: $t('DataSubscriptions.Detail.index.697323-0'),
  },
  {
    key: 'PushConfig',
    tab: $t('DataSubscriptions.Detail.index.697323-1'),
  },
  {
    key: 'PushLog',
    tab: $t('DataSubscriptions.Detail.index.697323-2'),
  },
  {
    key: 'DataMonitor',
    tab: $t('DataSubscriptions.Detail.index.697323-3'),
  }
]

const activeKey = ref('Subscription')

const components = {
  Subscription,
  PushConfig,
  PushLog,
  DataMonitor
}

const getActions = (data) => {
  return [
    {
      key: 'action',
      text: data.state?.value !== 'notActive' ? $t('Instance.index.133466-7') : $t('Instance.index.133466-22'),
      tooltip: {
        title: data.state?.value !== 'notActive' ? $t('Instance.index.133466-7') : $t('Instance.index.133466-22'),
      },
      icon:
          data.state?.value !== 'notActive'
              ? 'StopOutlined'
              : 'CheckCircleOutlined',

      popConfirm: {
        title: `${$t('Instance.index.133466-23', [data.state?.value !== 'notActive' ? $t('Instance.index.133466-7') : $t('Instance.index.133466-22')])}`,
        onConfirm: async () => {

        },
      },
    },
    {
      key: 'delete',
      text: $t('Instance.index.133466-26'),
      disabled: data.state?.value !== 'notActive',
      tooltip: {
        placement: 'bottomLeft',
        title:
            data.state?.value !== 'notActive'
                ? $t('Instance.index.133466-27')
                : $t('Instance.index.133466-26'),
      },
      onClick: async () => {

      },
      icon: 'DeleteOutlined',
    },
  ]
}

const onSave = (val, key) => {
  console.log(val, key)
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

