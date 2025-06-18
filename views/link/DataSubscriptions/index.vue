<template>
  <j-page-container>
    <pro-search
        :columns="columns"
        target="link-data-subscriptions"
        @search="handleSearch"
    />
    <FullPage>
      <JProTable
          ref="instanceRef"
          :columns="columns"
          :request="query"
          mode="TABLE"
          :defaultParams="{
                    sorts: [{ name: 'createTime', order: 'desc' }],
                }"
          :params="params"
      >
        <template #headerLeftRender>
          <j-permission-button
              type="primary"
              @click="handleAdd"
              hasPermission="link/plugin:add"
          >
            <template #icon>
              <AIcon type="PlusOutlined"/>
            </template>
            {{ $t('plugin.index.293829-0') }}
          </j-permission-button>
        </template>
        <template #name="slotProps">
          <div class="data-name" @click="viewDetail(slotProps)">
            {{ slotProps.name }}
          </div>
        </template>
        <template #state="slotProps">
          <a-tag :color="slotProps.state.value === 'enabled' ? 'success' : 'error'">{{slotProps.state?.text}}</a-tag>
        </template>
        <template #provider="slotProps">
          <div class="provider-box">
            <AIcon :type="providerIcon[slotProps.provider]" />{{ slotProps.providerInfo?.name }}
          </div>
        </template>
        <template #url="slotProps">
          <div style="white-space: normal;">
            <j-ellipsis>{{ (slotProps.configuration?.writers || []).map(i => i.url).join(',') || '--' }}</j-ellipsis>
          </div>
        </template>
        <template #action="slotProps">
          <a-space :size="16">
            <template
                v-for="i in getActions(slotProps)"
                :key="i.key"
            >
              <j-permission-button
                  :disabled="i.disabled"
                  :popConfirm="i.popConfirm"
                  :tooltip="i.tooltip"
                  @click="i.onClick"
                  type="link"
                  :danger="i.key === 'delete'"
                  style="padding: 0 5px"
                  :hasPermission="true"
              >
                <template #icon>
                  <AIcon :type="i.icon" />
                </template>
              </j-permission-button>
            </template>
          </a-space>
        </template>
      </JProTable>
    </FullPage>
  </j-page-container>
  <Save v-if="saveData.visible" @close="saveData.visible = false" @save="onSave"/>
  <Detail :data="detailData.data" @refresh="onRefresh" v-if="detailData.visible" @close="detailData.visible = false"/>
</template>

<script setup name="DataSubscriptions">
import {query, remove, queryProviders} from '@device/api/link/dataSubscriptions';
import {useI18n} from 'vue-i18n';
import Save from './Save/index.vue'
import Detail from './Detail/index.vue'
import {providerIcon} from "./data";
import {onlyMessage} from "@jetlinks-web/utils";

const {t: $t} = useI18n();
const params = ref({});
const instanceRef = ref();
const saveData = reactive({
  visible: false,
  data: {}
});
const detailData = reactive({
  visible: false,
  data: {}
});

const columns = [
  {
    title: $t('DataSubscriptions.index.411661-1'),
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    search: {
      type: 'string',
    },
    scopedSlots: true,
  },
  {
    title: $t('DataSubscriptions.index.411661-2'),
    dataIndex: 'state',
    key: 'state',
    scopedSlots: true,
    search: {
      type: 'select',
      options: [
        {
          label: $t('AccessConfig.index.764793-5'),
          value: 'disabled',
        },
        {
          label: $t('Type.index.196842-12'),
          value: 'enabled',
        },
      ],
    },
  },
  {
    title: $t('DataSubscriptions.index.411661-3'),
    dataIndex: 'provider',
    key: 'provider',
    ellipsis: true,
    scopedSlots: true,
    search: {
      type: 'select',
      options: async () => {
        const res = await queryProviders();
        return res.result.map((item) => ({ ...item, label: item.name, value: item.provider }));
      },
    },
  },
  {
    title: $t('DataSubscriptions.index.411661-4'),
    dataIndex: 'url',
    key: 'url',
    ellipsis: true,
    width: 200,
    search: {
      type: 'string',
    },
    scopedSlots: true,
  },
  {
    title: $t('DataSubscriptions.index.411661-5'),
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('DataSubscriptions.index.411661-6'),
    key: 'action',
    width: 160,
    scopedSlots: true,
  },
];

const handleAdd = () => {
  saveData.visible = true;
  saveData.data = {};
};

const handleSearch = (p) => {
  params.value = p;
};

const viewDetail = (data) => {
  detailData.visible = true;
  detailData.data = data;
}

const onRefresh = () => {
  instanceRef.value.reload?.();
}

const onSave = () => {
  saveData.visible = false;
  onRefresh()
}

const getActions = (data) => {
  if (!data) {
    return [];
  }
  const state = data.state.value;
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
};
</script>

<style scoped lang="less">
.data-name {
  &:hover {
    color: @primary-color;
    cursor: pointer;
  }
}

.provider-box {
  background-color: #F5F5F5;
  padding: 8px 24px;
  border-radius: 51px;
  gap: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124px;
}
</style>
