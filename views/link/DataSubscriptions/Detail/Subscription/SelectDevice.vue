<template>
  <pro-search
      :columns="columns"
      target="data-subscription-select-device"
      @search="handleSearch"
      style="padding: 0"
      type="simple"
  />
  <div style="flex: 1; min-height: 0">
    <j-pro-table
        ref="tableRef"
        mode="TABLE"
        :columns="columns"
        :request="query"
        :defaultParams="{
            sorts: [{ name: 'createTime', order: 'desc' }, { name: 'name', order: 'desc'}],
        }"
        :params="params"
        :bodyStyle="{padding: 0}"
    >
      <template #productId="slotProps">
        <span>{{ slotProps.productName }}</span>
      </template>
      <template #state="slotProps">
        <a-badge
            :text="slotProps.state?.text"
            :status="statusMap.get(slotProps.state?.value)"
        />
      </template>
      <template #createTime="slotProps">
        <span>{{ slotProps.createTime ? dayjs(slotProps.createTime).format('YYYY-MM-DD HH:mm:ss') : '--' }}</span>
      </template>
    </j-pro-table>
  </div>
</template>

<script setup>
import {useI18n} from 'vue-i18n';
import dayjs from "dayjs";
import {onlyMessage} from "@jetlinks-web/utils";
import {query} from "@device/api/instance";
import {queryNoPagingPost} from "@/modules/device-manager-ui/api/product";

const {t: $t} = useI18n();
const emit = defineEmits(['update:modelValue', 'change']);

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  },
});

const params = ref({});
const tableRef = ref()

const statusMap = new Map();
statusMap.set('online', 'processing');
statusMap.set('offline', 'error');
statusMap.set('notActive', 'warning');

const columns = [
  {
    title: 'ID',
    key: 'id',
    dataIndex: 'id',
    fixed: 'left',
    width: 200,
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('Save.SelectDevices.386303-5'),
    key: 'name',
    dataIndex: 'name',
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('Instance.index.133466-2'),
    dataIndex: 'productName',
    key: 'productName',
    ellipsis: true,
    search: {
      type: 'select',
      rename: 'productId',
      options: () =>
          new Promise((resolve) => {
            queryNoPagingPost({ paging: false }).then((resp) => {
              resolve(
                  resp.result.map((item) => ({
                    label: item.name,
                    value: item.id,
                  })),
              );
            });
          }),
    },
  },
  {
    title: $t('Save.SelectDevices.386303-7'),
    key: 'createTime',
    dataIndex: 'createTime',
    search: {
      type: 'date',
    },
    width: 200,
    scopedSlots: true,
  },
  {
    title: $t('Save.SelectDevices.386303-8'),
    dataIndex: 'state',
    key: 'state',
    scopedSlots: true,
    search: {
      type: 'select',
      options: [
        {label: $t('Save.SelectDevices.386303-9'), value: 'online'},
        {label: $t('Save.SelectDevices.386303-10'), value: 'offline'},
        {label: $t('Save.SelectDevices.386303-11'), value: 'notActive'},
      ],
    },
    width: 150,
  },
]
const handleSearch = (e) => {
  params.value = e
};
</script>

<style lang="less" scoped>
</style>
