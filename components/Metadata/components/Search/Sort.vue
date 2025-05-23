<template>
  <a-popover
    trigger="click"
    placement="bottom"
    :overlayStyle="{
      'zIndex': 1050
    }"
    :getPopupContainer="(node) => tableWrapperRef || node"
    @visibleChange="visibleChange"
  >
    <template #content>
      <div class="table-sort-content">
        <div class="table-sort-title">
          {{ $t('Search.Sort.467776-0') }}
        </div>
        <div class="table-sort-body">
          <a-table
            v-if="visible"
            size="small"
            :columns="columns"
            :dataSource="dataSource"
            :row-selection="{ selectedRowKeys: mySelectedRowKeys, onChange: onSelectChange }"
            :pagination="false"
            :scroll="dataSource.length > 5 ? { y: 200 } : undefined"
          >

          </a-table>
        </div>
        <div class="table-sort-footer">
          <a-space :size="16">
            <a-button type="primary" @click="cleanParams" :disabled="!mySelectedRowKeys.length">{{ $t('Search.Sort.467776-1') }}</a-button>
            <a-button type="primary" ghost @click="onAsc">{{ $t('Search.Sort.467776-2') }}</a-button>
            <a-button type="primary" ghost @click="onDesc">{{ $t('Search.Sort.467776-3') }}</a-button>
          </a-space>
        </div>
      </div>
    </template>
    <AIcon type="icon-paixu" :class="{ 'table-sort-icon': true, 'active': props.active }" />
  </a-popover>
</template>

<script setup name="MetadataTableSort">
import {useTableTool, useTableWrapper} from "../../context";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps({
  dataSource: {
    type: [Function, Array],
    default: () => []
  },
  sortKey: {
    type: [String, Array],
    default: undefined
  },
  dataIndex: {
    type: [Number, String],
    default: undefined
  },
  selectedRowKeys: {
    type: Array,
    default: () => []
  },
  active: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const tableWrapperRef = useTableWrapper()
const tableTool = useTableTool()

const visible = ref(false)
const dataSource = ref([])
const mySelectedRowKeys = ref([])

const columns = [
  {
    dataIndex: 'name',
    title: $t('Search.Sort.467776-4')
  },
  {
    dataIndex: 'total',
    title: $t('Search.Sort.467776-5'),
    width: 70
  }
]

const visibleChange = (e) => {
  if (e) {
    mySelectedRowKeys.value = props.selectedRowKeys
    dataSource.value = (props.dataSource?.() || []).map((item, index) => Object.assign(item, { __index: index + 1}))
  }

  if (!e) {
    setTimeout(() => {
      visible.value = e
    }, 300)
  } else {
    visible.value = e
  }
}

const onSelectChange = (keys) => {
  mySelectedRowKeys.value = keys
}

const cleanParams = () => {
  mySelectedRowKeys.value = []
  tableTool.cleanOrder()
}

const handleSortRowKeys = () => {
  return dataSource.value
    .filter(item => mySelectedRowKeys.value.includes(item.key))
    .sort((a, b) => b.__index - a.__index)
    .map(item => item.key)
}

const onAsc = () => {
  tableTool.order('asc', props.sortKey, handleSortRowKeys(), props.dataIndex)
  emit('click')
}

const onDesc = () => {
  tableTool.order('desc', props.sortKey, handleSortRowKeys(), props.dataIndex)
  emit('click')
}

</script>

<style scoped lang="less">
.table-sort-content {
  width: 300px;

  .table-sort-title {

  }

  .table-sort-body {
    margin: 12px 0;
  }
}

.table-sort-icon {
  color: rgba(0,0,0, 0.25);
  font-size: 16px;

  &.active {
    color: @primary-color;
  }
}
</style>
