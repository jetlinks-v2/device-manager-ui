<template>
  <div style="height: 100%">
    <j-pro-table
      ref="tableRef"
      :columns="columns"
      :request="queryProductList"
      :defaultParams="{
        sorts: [{ name: 'createTime', order: 'desc' }]
      }"
      :params="params"
      :bodyStyle="{ padding: 0 }"
      :modeValue="modeValue"
      :mode="mode"
      :gridColumns="gridColumns"
      :alertShow="selectType !== 'radio'"
      :rowSelection="
        isSelected
          ? {
              type: selectType,
              selectedRowKeys: _selectedRowKeys,
              onSelect,
              onSelectAll,
              onChange
            }
          : false
      "
    >
      <template #card="slotProps">
        <CardBox
          :value="slotProps"
          :active="_selectedRowKeys.includes(slotProps.id)"
          :status="slotProps.state"
          :statusText="slotProps.state === 1 ? $t('Product.index.660348-2') : $t('Product.index.660348-3')"
          :statusNames="{
            1: 'processing',
            0: 'error'
          }"
          @click="handleClick(slotProps)"
        >
          <template #img>
            <img :src="slotProps.photoUrl || device.deviceProduct" />
          </template>
          <template #content>
            <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 18px">
              <span style="font-weight: 600; font-size: 16px">
                {{ slotProps.name }}
              </span>
            </j-ellipsis>
            <a-row>
              <a-col :span="12">
                <div class="card-item-content-text">
                  {{ $t('Product.index.660348-4') }}
                </div>
                <div>{{ slotProps?.deviceType?.text }}</div>
              </a-col>
              <a-col :span="12">
                <div class="card-item-content-text">
                  {{ $t('Product.index.660348-5') }}
                </div>
                <j-ellipsis>
                  <div>
                    {{ slotProps?.accessName ? slotProps?.accessName : $t('Product.index.660348-6') }}
                  </div>
                </j-ellipsis>
              </a-col>
            </a-row>
          </template>
        </CardBox>
      </template>
      <!--插槽-->
      <template
        v-for="(_, slotKey) in slots"
        :key="slotKey"
        v-slot:[slotKey]="slotProps"
      >
        <slot
          :name="slotKey"
          v-bind="slotProps"
        ></slot>
      </template>
    </j-pro-table>
  </div>
</template>

<script setup>
import { queryProductList } from '../../api/product'
import { useI18n } from 'vue-i18n'
import { device } from '@device-manager-ui/assets'

const { t: $t } = useI18n()
const emit = defineEmits(['update:value', 'change'])

const props = defineProps({
  value: {
    type: Array,
    default: []
  },
  params: {
    type: Object,
    default: () => ({})
  },
  columns: {
    type: Array,
    default: []
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  modeValue: {
    type: String,
    default: 'CARD'
  },
  mode: {
    type: String,
    default: undefined
  },
  gridColumns: {
    type: Array,
    default: () => [2]
  },
  selectType: {
    type: String,
    default: 'checkbox'
  }
})

const tableRef = ref()
const _selectedRowKeys = ref([])
const _selectedRows = ref([])
const slots = useSlots()

const columns = computed(() => {
  return props.columns.length
    ? props.columns
    : [
        {
          title: 'ID',
          key: 'id',
          dataIndex: 'id',
          fixed: 'left',
          width: 200,
          ellipsis: true,
          search: {
            type: 'string'
          }
        },
        {
          title: $t('Save.SelectDevices.386303-5'),
          key: 'name',
          dataIndex: 'name',
          ellipsis: true,
          search: {
            type: 'string'
          }
        }
      ]
})

const onSelectChange = () => {
  emit('update:value', _selectedRowKeys.value)
  emit('change', _selectedRowKeys.value, _selectedRows.value)
}

const changeRowValue = (list = [], flag) => {
  list.map((item) => {
    if (flag) {
      if (!_selectedRows.value.some((i) => i.id === item.id)) {
        _selectedRows.value.push(item)
      }
    } else {
      _selectedRows.value = _selectedRows.value.filter((i) => i.id !== item.id)
    }
  })
  _selectedRowKeys.value = _selectedRows.value.map((item) => item.id)
  onSelectChange()
}

const handleClick = (dt) => {
  if (props.isSelected) {
    if (props.selectType === 'radio') {
      _selectedRowKeys.value = [dt.id]
      _selectedRows.value = [dt]
      onSelectChange()
    } else {
      const selected = _selectedRowKeys.value.includes(dt.id)
      changeRowValue([dt], !selected)
    }
  }
}

const onSelect = (record, selected) => {
  if (props.selectType === 'radio') {
    _selectedRowKeys.value = [record.id]
    _selectedRows.value = [record]
    onSelectChange()
  } else {
    changeRowValue([record], selected)
  }
}

const onSelectAll = (selected, selectedRows) => {
  changeRowValue(selectedRows, selected)
}

const onChange = (_keys) => {
  if (_keys.length === 0) {
    _selectedRowKeys.value = []
    _selectedRows.value = []
    onSelectChange()
  }
}

onMounted(() => {
  _selectedRowKeys.value = Array.isArray(props.value) ? props.value : props.value ? [props.value] : []
  if (_selectedRowKeys.value.length) {
    _selectedRows.value = _selectedRowKeys.value.map((item) => ({ id: item }))
  }
})
</script>

<style lang="less" scoped>
</style>
