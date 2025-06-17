<template>
  <!--  <a-alert :message="$t('Save.SelectDevices.386303-18', [deviceCount])"/>-->
  <pro-search
      :columns="columns"
      @search="handleSearch"
      type="simple"
      style="padding: 0; margin: 16px 0"
  />
  <div style="min-height: 0; flex: 1">
    <j-pro-table
        mode="TABLE"
        type="TREE"
        :columns="columns"
        :request="getTreeData_api"
        :bodyStyle="{padding: 0}"
        :params="params"
        :rowSelection="{
          selectedRowKeys: _selectedRowKeys,
          onSelect: onSelectChange,
          onSelectAll: onSelectAllChange,
          onChange: onChange,
      }"
    />
  </div>
</template>

<script setup>
import {getTreeData_api} from "@/api/system/department";
import {useI18n} from "vue-i18n";
import {onlyMessage} from "@jetlinks-web/utils";
import {queryDetailList} from "@device/api/firmware";
import {map} from "lodash-es";

const props = defineProps({
  value: {
    type: Array,
    default: () => []
  },
});

const {t: $t} = useI18n();
const columns = [
  {
    title: $t('Save.index.902471-6'),
    dataIndex: 'name',
    key: 'name',
    search: {
      type: 'string',
    },
    ellipsis: true,
  },
  {
    title: $t('Search.Sort.467776-0'),
    dataIndex: 'sortIndex',
    key: 'sortIndex',
    width: 200
  },
]
const _selectedRowKeys = ref([])
const _selectedRowRows = ref([])
const params = ref({});
const handleSearch = (e) => {
  params.value = e
}

const onSelectChange = (record, selected, selectedRows) => {
  if (selected) {
    _selectedRowRows.value = selectedRows
  } else {
    _selectedRowRows.value = _selectedRowRows.value.filter((item) => item.id !== record?.id);
  }
  _selectedRowKeys.value = map(_selectedRowRows.value, 'id')
};

const onSelectAllChange = (selected, selectedRows, changeRows) => {
  if(selected){
    _selectedRowRows.value = [..._selectedRowRows.value, ...selectedRows]
  } else {
    _selectedRowRows.value = _selectedRowRows.value.filter((item) => !map(changeRows, 'id').includes(item.id))
  }
  _selectedRowKeys.value = map(_selectedRowRows.value, 'id')
};


const onChange = (selectedRowKeys) => {
  if (selectedRowKeys.length === 0) {
    _selectedRowKeys.value = [];
    _selectedRowRows.value = [];
  }
};

watch(() => props.value, (val) => {
  _selectedRowKeys.value = val
}, {
  immediate: true,
  deep: true,
})

const onSave = () => {
  return new Promise((resolve) => {
    if (_selectedRowKeys.value.length > 0) {
      resolve({
        terms: [{
          column: "id$dim-assets",
          value: JSON.stringify({
            assetType: 'device',
            targets: [
              {
                type: 'org',
                id: _selectedRowKeys.value
              },
            ],
          })
        }],
        options: {
          orgName: ''
        }
      })
    } else {
      onlyMessage($t('DataSubscriptions.Detail.index.697323-60'), 'error')
      resolve(false)
    }
  });
};

defineExpose({onSave})
</script>

<style lang="less" scoped>

</style>
