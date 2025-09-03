<template>
  <div style="height: 100%" :key="`${productStore.current?.id}-${map(showProperties, 'id').join('-')}`">
    <JProTable
        v-if="productStore.current?.id"
        ref="tableRef"
        :columns="dynamicColumns"
        :request="query"
        :defaultParams="{
                    sorts: [{ name: 'createTime', order: 'desc' }],
                    terms: [
                    {
                        column: 'productId',
                        value: productStore.current?.id || '',
                        termType: 'eq',
                    },
                ],
                }"
        :params="params"
        mode="TABLE"
        style="padding: 0"
    >
      <template #headerLeftRender>
        <a-space>
          <a-input-search
              v-model:value="searchText"
              placeholder="搜索属性"
              style="width: 300px"
              @search="onSearch"
              allowClear
          />
        </a-space>
      </template>
      <template #headerRightRender>
        <a-space>
          <a-button type="primary" @click="showPropertyConfig">
            <template #icon>
              <AIcon type="SettingOutlined"/>
            </template>
            属性配置
          </a-button>
        </a-space>
      </template>
      <template #name="slotProps">
        <a @click="onClick(slotProps)">{{ slotProps.name }}</a>
      </template>
      <template #state="slotProps">
        <j-badge-status
            :status="slotProps.state?.value"
            :text="slotProps.state?.text"
            :statusNames="{
                            online: 'processing',
                            offline: 'error',
                            notActive: 'warning',
                        }"
        />
      </template>
      <template #propertiesList>
        <div style="color: rgba(0, 0, 0, .6)">
          暂无数据
        </div>
      </template>
      <template v-for="i in showProperties" :key="i.id" #[i.id]="slotProps">
        <div @click="onClick(slotProps, i)" style="cursor: pointer;">
          <ValueRender
              :data="i"
              :value="propertyValue[`${slotProps.id}-${i.id}`]"
          />
        </div>
      </template>
    </JProTable>
  </div>
  <!-- 属性配置抽屉组件 -->
  <PropertyConfigDrawer
      v-if="drawerVisible"
      :properties="properties"
      :showProperties="showProperties"
      @save="handlePropertySave"
      @close="drawerVisible = false"
  />
</template>

<script setup lang="ts">
import PropertyConfigDrawer from './PropertyConfig.vue';
import {query} from '@device/api/instance';
import {useProductStore} from "@device/store/product";
import {useMenuStore} from "@/store";
import {dashboard} from "@device/api/dashboard";
import {groupBy, toArray} from "lodash-es";
import ValueRender from "./ValueRender.vue";
import {map} from 'lodash-es'

const tableRef = ref();
const params = ref<Record<string, any>>({});
const searchText = ref('');
const drawerVisible = ref(false);
const productStore = useProductStore();
const showProperties = ref([])
const _showProperties = ref([])

// 基础列配置
const baseColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 200,
    ellipsis: true,
  },
  {
    title: '设备名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    scopedSlots: true,
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'state',
    key: 'state',
    width: 120,
    scopedSlots: true,
  },
];
const menuStory = useMenuStore();
const propertyValue = reactive<Record<string, any>>({});

const properties = computed(() => {
  const metadata = JSON.parse(productStore.current?.metadata || '{}')
  return metadata?.properties || []
});

// 动态列配置
const dynamicColumns = computed(() => {
  const propertyColumns = showProperties.value.map(item => ({
    title: `${item.name}(${item.id})`,
    dataIndex: item.id,
    key: item.id,
    width: 120,
    ellipsis: true,
    scopedSlots: true,
  }));

  const list = [...baseColumns]
  if (propertyColumns.length === 0) {
    list.push({
      title: '属性列表',
      dataIndex: 'propertiesList',
      key: 'propertiesList',
      width: 200,
      scopedSlots: true,
    },)
  } else {
    list.push(...propertyColumns)
  }
  return list
});

const onSearch = (val: string) => {
  showProperties.value = _showProperties.value.filter(i => !val || i.name.includes(val));

  (tableRef.value.dataSource || []).forEach((item: any) => {
    getDashboard(item)
  })
};

// 显示属性配置抽屉
const showPropertyConfig = () => {
  drawerVisible.value = true;
};

// 处理属性配置保存
const handlePropertySave = (_properties = []) => {
  showProperties.value = _properties
  _showProperties.value = _properties
  drawerVisible.value = false;
  (tableRef.value.dataSource || []).forEach((item: any) => {
    getDashboard(item)
  })
};

watch(() => tableRef.value?.dataSource, (newDataSource) => {
  if (newDataSource && showProperties.value.length > 0) {
    newDataSource.forEach((item: any) => {
      getDashboard(item);
    });
  }
}, {
  immediate: true
})

const getDashboard = async (device: any) => {
  if (!device.id || !showProperties.value?.length) {
    return;
  }

  const param = [
    {
      dashboard: 'device',
      object: device.productId,
      measurement: 'properties',
      dimension: 'history',
      params: {
        deviceId: device.id,
        history: 1,
        properties: showProperties.value.map((i: any) => i.id),
      },
    },
  ];
  const resp: Record<string, any> = await dashboard(param);
  if (resp.success) {
    const t1 = (resp.result || []).map((item: any) => {
      return {
        timeString: item.data?.timeString,
        timestamp: item.data?.timestamp,
        ...item?.data?.value,
      };
    });

    const obj = {};
    toArray(groupBy(t1, 'property'))
        .map((item) => {
          return {
            list: item.sort((a, b) => b.timestamp - a.timestamp),
            property: item[0].property,
          };
        })
        .forEach((i) => {
          const key = `${device.id}-${i.property}`;
          obj[key] = i.list[0];
        });

    // 直接更新 reactive 对象的属性
    Object.keys(obj).forEach(key => {
      propertyValue[key] = obj[key];
    });
  }

};

const onClick = (dt: any, item: any) => {
  menuStory.jumpPage("device/Instance/Detail", {params: {id: dt.id, tab: 'Running', property: item?.id}});
}
</script>

<style scoped lang="less">

</style>
