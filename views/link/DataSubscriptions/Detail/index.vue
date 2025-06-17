<template>
  <a-drawer visible :width="900" :mask="false" @close="emits('close')">
    <template #closeIcon>
      <AIcon type="MenuUnfoldOutlined"/>
    </template>
    <template #title>
      <div class="header">
        <div class="icon">
          <AIcon :type="providerIcon[info.provider]"/>
        </div>
        <EditInput :value="info.name" @save="(val) => onSave(val, 'name')">{{ info.name }}</EditInput>
        <a-tag :color="info.state?.value === 'enabled' ? 'success' : 'error'">{{info.state?.text}}</a-tag>
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
            {{ info.providerInfo?.name || info.provider || '--' }}
          </div>
        </div>
        <div class="top-content-item">
          <div class="top-content-item-label">{{$t('DataSubscriptions.index.411661-7')}}</div>
          <div class="top-content-item-desc">
            <j-ellipsis>{{ info.modifierName || '--' }}</j-ellipsis>
          </div>
        </div>
        <div class="top-content-item">
          <div class="top-content-item-label">{{$t('DataSubscriptions.index.411661-5')}}</div>
          <div class="top-content-item-desc">
            <EditInput :value="info.description" @save="(val) => onSave(val, 'description')">
              <j-ellipsis>{{ info.description || '--' }}</j-ellipsis>
            </EditInput>
          </div>
        </div>
      </div>
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane v-for="item in tabList" :key="item.key" :tab="item.tab"/>
      </a-tabs>
      <div class="tabs-content">
        <component :is="components[activeKey]" :data="info" @refresh="getDetail(data.id)"/>
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
import {modify, remove, queryDetailById} from "@device/api/link/dataSubscriptions";
import {onlyMessage} from "@jetlinks-web/utils";
import {providerIcon} from "../data";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['close', 'refresh'])
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

const info = ref(props.data)

const getActions = (_data) => {
  const state = _data.state?.value;
  const stateText = state === 'enabled' ? $t('AccessConfig.index.764793-5') : $t('AccessConfig.index.764793-9');
  return [
    {
      key: 'action',
      text: stateText,
      tooltip: {
        title: stateText,
      },
      icon: state === 'enabled' ? 'StopOutlined' : 'CheckCircleOutlined',
      popConfirm: {
        title: $t('AccessConfig.index.764793-11', [stateText]),
        onConfirm: () => {
          // let response =
          //     state === 'enabled'
          //         ? undeploy(data.id)
          //         : deploy(data.id);
          // response.then((res) => {
          //   if (res.success) {
          //     onlyMessage($t('AccessConfig.index.764793-12'), 'success');
          //     tableRef.value?.reload();
          //   }
          // });
          // return response;
        },
      },
    },
    {
      key: 'delete',
      text: $t('AccessConfig.index.764793-13'),
      disabled: state === 'enabled',
      tooltip: {
        title: state === 'enabled' ? $t('AccessConfig.index.764793-14') : $t('AccessConfig.index.764793-13'),
      },
      popConfirm: {
        title: $t('AccessConfig.index.764793-15'),
        onConfirm: () => {
          const response = remove(data.id);
          response.then((res) => {
            if (res.success) {
              onlyMessage($t('AccessConfig.index.764793-12'), 'success');
              tableRef.value.reload();
            } else {
              onlyMessage(res?.message, 'error');
            }
          });
          return response
        },
      },
      icon: 'DeleteOutlined',
    },
  ];
}

const getDetail = async (id) => {
  const response = await queryDetailById(id);
  if(response.success){
    info.value = {
      ...props.data,
      ...response.result
    };
  }
}

const onSave = async (val, key) => {
  const obj = {
    [key]: val
  }
  const resp = await modify(props.data.id, obj)
  if(resp.success) {
    onlyMessage($t('Product.index.660348-18'))
    emits('refresh')
    getDetail(props.data.id)
  }
}

watch(() => props.data?.id, (val) => {
  if(val){
    getDetail(val)
  }
}, {
  immediate: true
})
</script>

<style lang="less" scoped>
.content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;

  .icon {
    color: @primary-color;
  }
}

.top-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px
}

.top-content-item {
  display: flex;
  align-items: center;
  gap: 16px;

  &-label {
    color: #777777;
    white-space: nowrap;
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

