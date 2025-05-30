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
          :request="queryPage"
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
        <template #type="slotProps">
          123
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
                  :tooltip="{
                                    ...i.tooltip,
                                }"
                  @click="i.onClick"
                  type="link"
                  :danger="i.key === 'delete'"
                  style="padding: 0 5px"
                  :hasPermission="'link/plugin:' + i.key"
              >
                <template #icon
                >
                  <AIcon :type="i.icon"
                  />
                </template>
              </j-permission-button>
            </template>
          </a-space>
        </template>
      </JProTable>
    </FullPage>
  </j-page-container>
  <Save v-if="saveData.visible" @close="saveData.visible = false"/>
  <Detail v-if="detailData.visible"/>
</template>

<script setup name="DataSubscriptions">
import {onlyMessage} from '@jetlinks-web/utils';
import {queryPage, removeFn, getTypes} from '@device/api/link/plugin';
import {useI18n} from 'vue-i18n';
import Save from './Save/index.vue'
import Detail from './Detail/index.vue'

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
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    search: {
      type: 'input',
    },
  },
  {
    title: '状态',
    dataIndex: 'version',
    key: 'version',
    ellipsis: true,
  },
  {
    title: '订阅类型',
    dataIndex: 'type',
    key: 'type',
    ellipsis: true,
    scopedSlots: true,
  },
  {
    title: '推送地址',
    dataIndex: 'filename',
    key: 'filename',
    ellipsis: true,
  },
  {
    title: '说明',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('plugin.index.293829-7'),
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

const getActions = (data) => {
  if (!data) {
    return [];
  }
  return [
    {
      key: 'view',
      text: $t('plugin.index.293829-13'),
      tooltip: {
        title: $t('plugin.index.293829-13'),
      },
      icon: 'EyeOutlined',
      onClick: () => {
        viewDetail(data);
      },
    },
    {
      key: 'action',
      text: $t('plugin.index.293829-8'),
      tooltip: {
        title: (data?.configuration?.sourceId || data?.configuration?.autoCreate) ? $t('plugin.index.293829-14', [$t('plugin.index.293829-8')]) : $t('plugin.index.293829-8'),
      },
      disabled: data?.configuration?.sourceId || data?.configuration?.autoCreate,
      icon: 'EditOutlined',
      onClick: () => {

      },
    },
    {
      key: 'delete',
      text: $t('plugin.index.293829-9'),
      tooltip: {
        title: (data?.configuration?.sourceId || data?.configuration?.autoCreate) ? $t('plugin.index.293829-14', [$t('plugin.index.293829-9')]) : $t('plugin.index.293829-9'),
      },
      disabled: data?.configuration?.sourceId || data?.configuration?.autoCreate,
      popConfirm: {
        title: $t('plugin.index.293829-10'),
        onConfirm: () => {
          // const response = removeFn(data.id);
          // response.then((resp) => {
          //   if (resp.status === 200) {
          //     onlyMessage($t('plugin.index.293829-11'));
          //     instanceRef.value?.reload();
          //   } else {
          //     onlyMessage(resp?.message || $t('plugin.index.293829-12'), 'error');
          //   }
          // });
          // return response;
        },
      },
      icon: 'DeleteOutlined',
    },
  ];
};
</script>

<style scoped lang="less">
.plugin-version {
  border-radius: 4px;
}
</style>
