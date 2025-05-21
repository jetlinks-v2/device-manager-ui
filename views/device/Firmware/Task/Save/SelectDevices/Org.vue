<template>
  <a-alert :message="$t('Save.SelectDevices.386303-18', [deviceCount])"/>
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
        :alertShow="false"
        :rowSelection="{
          selectedRowKeys: _selectedRowKeys,
          onChange: onChange,
          type: 'radio'
      }"
    />
  </div>
</template>

<script setup>
import {getTreeData_api} from "@/api/system/department";
import {useI18n} from "vue-i18n";
import {getDeviceNumber} from "@device/api/instance";
import {onlyMessage} from "@jetlinks-web/utils";

const { t: $t } = useI18n();
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
    ellipsis: true,
  },
]
const _selectedRowKeys = ref([])
const deviceCount = ref(0)
const params = ref({});
const handleSearch = (e) => {
  params.value = e
}

const onChange = (e) => {
  _selectedRowKeys.value = e
  deviceCount.value = 0
  // 查询组织下面的设备数量
  if(e.length > 0){
    getDeviceNumber({
      terms: [
        {
          column: "id$dim-assets",
          value: JSON.stringify({
            assetType: 'device',
            targets: [
              {
                type: 'org',
                id: e?.[0],
              },
            ],
          })
        }
      ]
    }).then(res => {
      if(res.success){
        deviceCount.value = res?.result || 0
      }
    })
  }
}

const onSave = () => {
  return new Promise((resolve) => {
    // 判断设备的数量
    if(deviceCount.value > 0){
      resolve(_selectedRowKeys.value?.[0]);
    } else {
      onlyMessage($t('Save.SelectDevices.386303-19'), 'error')
    }
  });
};

defineExpose({ onSave })
</script>

<style lang="less" scoped>

</style>
