<template>
  <div style="display: flex; flex-direction: column; height: 100%; gap: 16px;">

    <div class="top-num">{{ $t('DataSubscriptions.Detail.index.697323-39') }} <span>34346</span></div>
    <div class="list-title">{{ $t('DataSubscriptions.Detail.index.697323-40') }}
      <a-tag>345</a-tag>
    </div>
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
        <template #action="slotProps">
          <j-permission-button
              :tooltip="{
                                   title: $t('DataSubscriptions.Detail.index.697323-53')
                                }"
              @click="onClick(slotProps)"
              type="link"
              style="padding: 0 5px"
          >
            <template #icon>
              <AIcon type="EyeOutlined" />
            </template>
          </j-permission-button>
        </template>
      </j-pro-table>
    </div>
  </div>
  <Detail :data="current.data" v-if="current.visible" @close="current.visible = false" />
</template>

<script setup>
import {useI18n} from 'vue-i18n';
import dayjs from "dayjs";
import Detail from "./Detail.vue";
import {query} from "@device/api/instance";

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
const current = reactive({
  visible: false,
  data: {},
})

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
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('DataSubscriptions.Detail.index.697323-41'),
    key: 'name',
    dataIndex: 'name',
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('DataSubscriptions.Detail.index.697323-32'),
    dataIndex: 'productName',
    key: 'productName',
    ellipsis: true,
    search: {
      type: 'string',
    }
  },
  {
    title: $t('DataSubscriptions.Detail.index.697323-36'),
    key: 'createTime',
    dataIndex: 'createTime',
    search: {
      type: 'date',
    },
    ellipsis: true,
    scopedSlots: true,
  },
  {
    title: $t('DataSubscriptions.Detail.index.697323-44'),
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
  {
    title: $t('DataSubscriptions.Detail.index.697323-42'),
    dataIndex: 'createTime',
    key: 'createTime',
    search: {
      type: 'date',
    },
    ellipsis: true,
    scopedSlots: true,
  },
  {
    title: $t('Product.index.660348-11'),
    key: 'action',
    fixed: 'right',
    width: 100,
    scopedSlots: true,
  },
]
const handleSearch = (e) => {
  params.value = e
};

const onClick = (dt) => {
  current.data = dt
  current.visible = true
}
</script>

<style lang="less" scoped>
.top-num {
  background: #F8FAFB;
  padding: 16px;
  border: 1px solid #E7E9EF;
  border-radius: 6px;

  span {
    font-size: 20px;
    font-weight: bold;
    color: #777777;
  }
}

.list-title {
  margin: 16px 0;
}
</style>
