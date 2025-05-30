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
        modeValue="TABLE"
        :columns="columns"
        :request="query"
        :defaultParams="{
            sorts: [{ name: 'createTime', order: 'desc' }, { name: 'name', order: 'desc'}],
        }"
        :params="params"
        :bodyStyle="{padding: 0}"
        :rowSelection="{
          selectedRowKeys: _selectedRowKeys,
          onSelect: onSelectChange,
          onSelectAll: onSelectAllChange,
          onChange: onChange,
        }"
        :gridColumns="[3,3,3]"
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
      <template #card="slotProps">
        <CardBox
            :value="slotProps"
            @click="handleClick"
            :active="_selectedRowKeys.includes(slotProps.id)"
            :status="slotProps.state?.value"
            :statusText="slotProps.state?.text"
            :statusNames="{
                online: 'processing',
                offline: 'error',
                notActive: 'warning',
            }"
        >
          <template #img>
            <img
                :width="80"
                :height="80"
                :src="
                    slotProps?.photoUrl ||
                    device.deviceCard
                "
            />
          </template>
          <template #content>
            <j-ellipsis
                style="
                    width: calc(100% - 100px);
                    margin-bottom: 18px;
                "
            >
                <span style="font-size: 16px; font-weight: 600">
                    {{ slotProps.name }}
                </span>
            </j-ellipsis>
            <a-row>
              <a-col :span="12">
                <div class="card-item-content-text">
                  ID
                </div>
                <j-ellipsis style="width: 100%">{{ slotProps.id }}</j-ellipsis>
              </a-col>
              <a-col :span="12">
                <div class="card-item-content-text">
                  {{ $t('Instance.index.133466-2') }}
                </div>
                <j-ellipsis style="width: 100%">
                  {{ slotProps.productName }}
                </j-ellipsis>
              </a-col>
            </a-row>
          </template>
        </CardBox>
      </template>
    </j-pro-table>
  </div>
</template>

<script setup>
import {useI18n} from 'vue-i18n';
import dayjs from "dayjs";
import {onlyMessage} from "@jetlinks-web/utils";
import {device} from "@device/assets";
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
const _selectedRowKeys = ref([]);
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
];

const handleClick = (dt) => {
  if (_selectedRowKeys.value.includes(dt.id)) {
    const _index = _selectedRowKeys.value.findIndex((i) => i === dt.id);
    _selectedRowKeys.value.splice(_index, 1);
  } else {
    _selectedRowKeys.value = [..._selectedRowKeys.value, dt.id];
  }
}

const getSelectedRowsKey = (selectedRows) => {
  return selectedRows.map((item) => item?.id).filter((i) => !!i);
}

const getSetRowKey = (selectedRows) => {
  return new Set([..._selectedRowKeys.value, ...getSelectedRowsKey(selectedRows)])
};
const onSelectChange = (record, selected, selectedRows) => {
  if (selected) {
    _selectedRowKeys.value = [...getSetRowKey(selectedRows)]
  } else {
    _selectedRowKeys.value = _selectedRowKeys.value.filter((item) => item !== record?.id);
  }
};

const onSelectAllChange = (selected, selectedRows, changeRows) => {
  const unRowsKeys = getSelectedRowsKey(changeRows);
  _selectedRowKeys.value = selected
      ? [...getSetRowKey(selectedRows)]
      : _selectedRowKeys.value
          .concat(unRowsKeys)
          .filter((item) => !unRowsKeys.includes(item));
};


const onChange = (selectedRowKeys) => {
  if (selectedRowKeys.length === 0) {
    _selectedRowKeys.value = [];
  }
};

const handleSearch = (e) => {
  params.value = e
};

const onSave = () => {
  return new Promise((resolve) => {
    // 判断设备数据，并返回
    if (_selectedRowKeys.value.length > 0) {
      resolve(_selectedRowKeys.value)
    } else {
      onlyMessage($t('Save.SelectDevices.386303-19'), 'error')
      resolve(false)
    }
  });
};

defineExpose({onSave})
</script>

<style lang="less" scoped>
</style>
