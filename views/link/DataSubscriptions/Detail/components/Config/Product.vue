<template>
    <pro-search
        :columns="columns"
        target="product-manage"
        @search="handleSearch"
        style="padding: 0"
    />
    <div style="flex: 1; min-height: 0">
      <JProTable
          :columns="columns"
          :request="queryProductList"
          ref="tableRef"
          :defaultParams="{
            sorts: [{ name: 'createTime', order: 'desc' }],
          }"
          modeValue="TABLE"
          :params="params"
          :gridColumns="[3]"
          :bodyStyle="{padding: 0}"
          :rowSelection="{
            selectedRowKeys: _selectedRowKeys,
            onSelect: onSelectChange,
            onSelectAll: onSelectAllChange,
            onChange: onChange,
          }"
      >
        <template #deviceType="slotProps">
          <div>{{ slotProps.deviceType.text }}</div>
        </template>
        <template #card="slotProps">
          <CardBox
              :value="slotProps"
              v-bind="slotProps"
              :active="_selectedRowKeys.includes(slotProps.id)"
              :status="slotProps.state"
              @click="handleClick(slotProps)"
              :statusText="
              slotProps.state === 1
                ? $t('Product.index.660348-2')
                : $t('Product.index.660348-3')
            "
              :statusNames="{
                1: 'processing',
                0: 'error',
              }"
          >
            <template #img>
              <slot name="img">
                <img
                    :src="slotProps.photoUrl || device.deviceProduct"
                    class="productImg"
                />
              </slot>
            </template>
            <template #content>
              <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 18px"
              ><span style="font-weight: 600; font-size: 16px">
                  {{ slotProps.name }}
                </span></j-ellipsis
              >
              <a-row>
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t("Product.index.660348-4") }}
                  </div>
                  <div>{{ slotProps?.deviceType?.text }}</div>
                </a-col>
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t("Product.index.660348-5") }}
                  </div>
                  <j-ellipsis>
                    <div>
                      {{
                        slotProps?.accessName
                            ? slotProps?.accessName
                            : $t("Product.index.660348-6")
                      }}
                    </div>
                  </j-ellipsis>
                </a-col>
              </a-row>
            </template>
          </CardBox>
        </template>
        <template #state="slotProps">
          <j-badge-status
              :text="
              slotProps.state === 1
                ? $t('Product.index.660348-2')
                : $t('Product.index.660348-3')
            "
              :status="slotProps.state"
              :statusNames="{
              1: 'processing',
              0: 'error',
            }"
          />
        </template>
      </JProTable>
    </div>
</template>

<script setup>
import {
  queryProductList,
} from "@device/api/product";
import { useAuthStore } from "@/store";
import { device } from "@device/assets";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();

const params = ref({});
const tableRef = ref({});
const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    scopedSlots: true,
    width: 200,
    ellipsis: true,
  },
  {
    title: $t("Product.index.660348-7"),
    dataIndex: "name",
    key: "name",
    width: 220,
    ellipsis: true,
  },
  {
    title: $t("Product.index.660348-5"),
    dataIndex: "accessName",
    key: "accessName",
    width: 220,
    ellipsis: true,
  },
  {
    title: $t("Product.index.660348-4"),
    dataIndex: "deviceType",
    key: "deviceType",
    scopedSlots: true,
    ellipsis: true,
    width: 120,
  },
  {
    title: $t("Product.index.660348-9"),
    dataIndex: "state",
    key: "state",
    scopedSlots: true,
    ellipsis: true,
    width: 90,
  },
  {
    title: $t("Product.index.660348-10"),
    dataIndex: "describe",
    key: "describe",
    ellipsis: true,
  },
];
const permission = useAuthStore().hasPermission(`device/Product:import`);
const _selectedRowKeys = ref([]);

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

/**
 * 刷新数据
 */
const refresh = () => {
  tableRef.value?.reload();
};

const handleSearch = (e) => {
  params.value = e;
};
</script>

<style lang="less" scoped>
.productImg {
  width: 80px;
  height: 80px;
}
</style>
