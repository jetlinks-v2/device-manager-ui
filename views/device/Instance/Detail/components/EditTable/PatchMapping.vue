<template>
  <a-modal
      width="1000px"
      :title="$t('EditTable.PatchMapping.974352-0')"
      visible
      @ok="handleClick"
      @cancel="handleClose"
      :confirmLoading="_loading"
  >
    <div class="map-tree">
      <div class="map-tree-top">
        {{ $t('EditTable.PatchMapping.974352-1') }}
      </div>
      <div style="margin-top: 16px">
              <span style="margin-right: 12px">
                {{$t('EditTable.PatchMapping.974352-10')}}<a-tooltip :title="$t('EditTable.PatchMapping.974352-11')"><AIcon
                  type="QuestionCircleOutlined"/></a-tooltip>
              </span>
        <a-switch v-model:checked="checked"/>
      </div>
      <a-spin :spinning="loading">
        <div class="map-tree-content">
          <a-card class="map-tree-content-card">
            <template #title>
              <div class="map-tree-header">
                <span>{{ $t('EditTable.PatchMapping.974352-2') }}</span>
                <div>
                  <a-input :placeholder="$t('EditTable.PatchMapping.974352-3')" v-model:value="searchValue"
                           @change="onSearch">
                    <template #suffix>
                      <AIcon type="SearchOutlined"/>
                    </template>
                  </a-input>
                </div>
              </div>
            </template>
            <a-tree
                v-if="dataSource.length"
                checkable
                v-model:expandedKeys="expandedKeys"
                :height="300"
                :tree-data="dataSource"
                :checkedKeys="checkedKeys"
                @check="onCheck"
                :selectable="false"
            >
              <template #title="{ title }">
                                <j-ellipsis v-if="title.indexOf(searchValue) > -1">
                                    {{
                                    title.substring(
                                        0,
                                        title.indexOf(searchValue),
                                    )
                                  }}
                                    <span style="color: #f50">{{
                                        searchValue
                                      }}</span>
                                    {{
                                    title.substring(
                                        title.indexOf(searchValue) +
                                        searchValue.length,
                                    )
                                  }}
                                </j-ellipsis>
                <j-ellipsis v-else>{{ title }}</j-ellipsis>
              </template>
            </a-tree>
            <j-empty v-else style="margin-top: 16px"></j-empty>
          </a-card>
          <div>
            <a-button
                :disabled="rightList.length >= leftList.length"
                @click="onRight"
            >{{ $t('EditTable.PatchMapping.974352-4') }}
            </a-button
            >
          </div>
          <a-card class="map-tree-content-card" :title="$t('EditTable.PatchMapping.974352-5')">
            <a-list
                size="small"
                :data-source="rightList"
                class="map-tree-content-card-list"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <j-ellipsis>{{ item.title }}</j-ellipsis>
                  <template #actions>
                    <ConfirmModal
                        :title="$t('EditTable.PatchMapping.974352-6')"
                        :onConfirm="() => _delete(item.key)"
                    >
                      <AIcon type="DeleteOutlined" />
                    </ConfirmModal>
                  </template>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import {treeMapping, saveMapping} from '../../../../../../api/instance';
import {onlyMessage} from '@/utils/comm';
import {useInstanceStore} from "../../../../../../store/instance";
import {cloneDeep, debounce, map} from 'lodash-es';
import {useI18n} from 'vue-i18n';
import {randomString} from "@jetlinks-web/utils";
import {
  asyncUpdateMetadata,
  updateMetadata
} from "@/modules/device-manager-ui/views/device/components/Metadata/metadata";

const {t: $t} = useI18n();

const _props = defineProps({
  type: {
    type: String,
    default: 'MODBUS_TCP',
  },
  metaData: {
    type: Array,
    default: () => [],
  },
  deviceId: {
    type: String,
    default: '',
  },
});
const _emits = defineEmits(['close', 'save']);

const instanceStore = useInstanceStore();
const checkedKeys = ref<string[]>([]);
const searchValue = ref()
const leftList = ref<any[]>([]);
const rightList = ref<any[]>([]);
const expandedKeys = ref<any[]>([]);
const dataSource = ref<any[]>([]);
const loading = ref<boolean>(false);
const _loading = ref<boolean>(false);
const checked = ref(false)
let dataSourceCache;

const handleData = (data: any[], type: string, provider?: string) => {
  data.forEach((item) => {
    item.key = item.id;
    item.title = item.name;
    item.checkable = type === 'collectors';

    if (provider) {
      item.provider = provider
    }

    if (
        item.collectors &&
        Array.isArray(item.collectors) &&
        item.collectors.length
    ) {
      item.children = handleData(
          item.collectors,
          'collectors',
          item.provider,
      );
    }

    if (item.points && Array.isArray(item.points) && item.points.length) {
      item.children = handleData(item.points, 'points');
    } else {
      item.disableCheckbox = true;
    }
  });
  return data as any[];
};

const handleSearch = async () => {
  loading.value = true;

  const params = {}

  const resp = await treeMapping(params);
  loading.value = false;
  if (resp.status === 200) {
    const _data = handleData(resp.result as any[], 'channel');
    dataSourceCache = JSON.stringify(_data)
    dataSource.value = _data
  }
}

const onCheck = (keys: string[], e: any) => {
  checkedKeys.value = [...keys];
  leftList.value = e?.checkedNodes || [];
};

const onRight = () => {
  leftList.value.forEach((i: any) => {
    i.disableCheckbox = true;
  });
  rightList.value = leftList.value;
};

const _delete = (_key: string) => {
  const _index = rightList.value.findIndex((i) => i.key === _key);
  leftList.value[_index].disableCheckbox = false;
  rightList.value.splice(_index, 1);
  checkedKeys.value = rightList.value.map((i) => i.key);
  leftList.value = rightList.value;
};

// 匹配物模型
const handleMetadata = (metadata: any[], point: any[]) => {
  const _metadata = cloneDeep(metadata);
  return point.map(element => {
    const _index = _metadata.findIndex((i: any) => i.name === element.name);
    const obj = {...element}
    if(_index !== -1){
      // 删除被用掉的物模型
      obj.metadataId =  _metadata[_index]?.id;
      metadata.splice(_index, 1)
    }
    return obj
  })
}

const handleClick = async () => {
  if (!rightList.value.length) {
    onlyMessage($t('EditTable.PatchMapping.974352-7'), 'warning');
  } else {
    // 被使用的物模型属性，不会被再次使用, 一个名称的物模型被使用后就需要去除，下次在遇到名称名称相同的就需要另一个名称相同的匹配
    const metadata = cloneDeep(_props.metaData || []);

    const params: any[] = []; // 没有匹配的物模型
    const filterParams: any[] = [] // 有匹配的物模型
    rightList.value.forEach((item: any) => {
      (item.children || []).map((element: any) => {
        const obj = {
          channelId: item.parentId,
          collectorId: element.collectorId,
          pointId: element.id,
          metadataType: 'property',
          metadataId: undefined,
          provider: item.provider,
          state: instanceStore.current.state.value == 'notActive' ? 'disabled' : null,
        }
        const _index = metadata.findIndex((i: any) => i.name === element.name);
        if(_index !== -1){
          obj.metadataId = metadata[_index]?.metadataId;
          // 删除被用掉的物模型
          metadata.splice(_index, 1)
          filterParams.push({...obj})
        } else {
          params.push({...obj, name: element.name, dataType: element.codecInfo?.dataType || {}})
        }
      });
    });
    // 开启checked，则自动创建物模型
    if(checked.value){
      const _metadataList = params.map((i: any) => {
        return {
          id: randomString(8),
          name: i.name,
          expands: {
            source: 'device',
            group: undefined,
            type: ['report']
          },
          valueType: {
            type: (i.dataType?.type && i.dataType?.type !== 'short') ? i.dataType?.type : 'int',
            expands: {}
          }
        }
      })
      const properties = JSON.parse(instanceStore.current?.metadata || '{}')?.properties || [];
      // 新建物模型属性
      const newData: any[] = [...properties,..._metadataList]
      let _data = updateMetadata('properties', newData, instanceStore.current);
      _loading.value = true
      const result = await asyncUpdateMetadata('device', _data).catch(() => {
        _loading.value = false
      })
      if (result?.success) {
        // 保存数据
        const _params = handleMetadata(_metadataList, params)
        const res = await saveMapping(
            _props.deviceId,
            _props.type,
            [..._params, ...filterParams],
        ).catch(() => {
          _loading.value = false
        })
        if (res.success) {
          onlyMessage($t('EditTable.PatchMapping.974352-8'));
          _emits('save');
        }
        _loading.value = false
      }
    } else {
      if (filterParams?.length !== 0) {
        _loading.value = true
        const res = await saveMapping(
            _props.deviceId,
            _props.type,
            filterParams,
        ).finally(() => {
          _loading.value = false
        })
        if (res.success) {
          onlyMessage($t('EditTable.PatchMapping.974352-8'));
          _emits('save');
        }
      } else {
        onlyMessage($t('EditTable.PatchMapping.974352-9'), 'error');
      }
    }
  }
};
const handleClose = () => {
  _emits('close');
};

const treeFilter = (data: any[], value: any, key: string = 'name'): any[] => {
  if (!data) return []

  return data.filter((item) => {
    if (item[key].includes(value)) {
      if (item.parentId) {
        !expandedKeys.value.includes(item.parentId) &&
        expandedKeys.value.push(item.parentId);
      }
      return true;
    }

    // 排除点位的搜索
    if (
        item.children &&
        item.children.length &&
        !item.hasOwnProperty('points')
    ) {
      item.children = treeFilter(item.children || [], value, key);
      return !!item.children.length;
    }

    return false;
  });
}

const onSearch = debounce((e) => {
  // handleSearch()
  const _data = JSON.parse(dataSourceCache || '[]');
  const text = e.target.value;
  dataSource.value = text
      ? treeFilter(_data, e.target.value, 'title')
      : _data;
}, 300);

watchEffect(() => {
  if (_props.type) {
    handleSearch();
  }
});
</script>

<style lang="less" scoped>
.map-tree-content {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .map-tree-content-card {
    width: 350px;
    height: 400px;

    .map-tree-content-card-list {
      overflow-y: auto;
      height: 300px;
    }
  }
}

.map-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.map-tree-top {
  background-color: rgba(0, 0, 0, .1);
  padding: 6px;
}
</style>
