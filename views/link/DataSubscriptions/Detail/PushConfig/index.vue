<template>
  <div v-if="!tabList.length" class="empty-box">
    <j-empty>
      <template #description>
        <div class="text">
          {{ $t("DataSubscriptions.Detail.index.697323-5") }}
        </div>
        <div class="desc">
          {{ $t("DataSubscriptions.Detail.index.697323-6") }}
        </div>
      </template>
      <a-button type="primary" @click="onAdd">{{
        $t("Product.index.660348-0")
      }}</a-button>
    </j-empty>
  </div>
  <div v-else class="push-config-content">
    <div class="title">
      {{ $t("DataSubscriptions.Detail.index.697323-32") }}
    </div>
    <a-tabs v-model:activeKey="activeKey" type="editable-card" @edit="onEdit">
      <a-tab-pane
        v-for="item in tabList"
        :key="item.index"
        :closable="false"
      >
        <template #tab>
          <div class="tab-item">
            <div>{{ item.name }}</div>
            <a-tag>{{
              providerList.find((i) => i.provider === item.provider)?.name ||
              item.provider
            }}</a-tag>
            <a-popconfirm
              :title="
                item.state === 'enabled' || item.state?.value === 'enabled'
                  ? $t('Detail.index.478940-0')
                  : $t('Detail.index.478940-1')
              "
              @confirm="onAction(item)"
            >
              <a-switch
                :checked="
                  item.state === 'enabled' || item.state?.value === 'enabled'
                "
                size="small"
              />
            </a-popconfirm>
            <a-dropdown>
              <AIcon type="MoreOutlined" />
              <template #overlay>
                <a-menu @click="(e) => handleMenuClick(e, item)">
                  <a-menu-item key="edit">
                    <AIcon type="EditOutlined" />
                    {{ $t("Product.index.660348-13") }}
                  </a-menu-item>
                  <a-menu-item key="delete">
                    <AIcon type="DeleteOutlined" />
                    {{ $t("Product.index.660348-20") }}
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </template>
      </a-tab-pane>
    </a-tabs>
    <div>
      <div class="title">
        {{ $t("DataSubscriptions.Detail.index.697323-33") }}
      </div>
      <div class="desc">
        <div class="desc-item">
          <div class="desc-item-label">
            {{ $t("DataSubscriptions.Detail.index.697323-38") }}
          </div>
          <div class="desc-item-value">{{_item?.url || '--'}}</div>
        </div>
        <div class="desc-item">
          <div class="desc-item-label">
            {{ $t("DataSubscriptions.index.411661-4") }}
          </div>
          <div class="desc-item-value">{{_item?.type || '--'}}</div>
        </div>
        <div class="desc-item">
          <div class="desc-item-label">
            {{ $t("DataSubscriptions.index.411661-5") }}
          </div>
          <div class="desc-item-value">
            <j-ellipsis>{{_item?.description || '--'}}</j-ellipsis>
          </div>
        </div>
      </div>
      <div class="title">
        {{ $t("DataSubscriptions.Detail.index.697323-34")
        }}<a-tooltip :title="$t('DataSubscriptions.Detail.index.697323-35')"
          ><AIcon
            type="QuestionCircleOutlined"
            style="color: #a6a6a6; margin-left: 10px"
        /></a-tooltip>
      </div>
      <div style="padding: 16px; border: 1px solid #B9B9B9; border-radius: 6px;">
        <j-markdown :source="data.providerInfo?.document?.http || ''"></j-markdown>
      </div>
    </div>
  </div>
  <Save
    v-if="current.visible"
    @close="current.visible = false"
    @save="onSave"
    :data="current.data"
    :providerList="providerList"
  />
</template>

<script setup>
import Save from "./Save.vue";
import { useI18n } from "vue-i18n";
import {
  queryWriterProviders,
  modify,
} from "@device/api/link/dataSubscriptions";
import {onlyMessage} from "@jetlinks-web/utils";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});
const emits = defineEmits(["refresh"]);

const { t: $t } = useI18n();
const activeKey = ref(0);
const current = reactive({
  visible: false,
  data: {},
});
const providerList = ref([]);
const tabList = ref([])

const _item = computed(() => {
  return tabList.value.find(item => item.index === activeKey.value)
})

const onAdd = () => {
  current.visible = true;
  current.data = {index: tabList.value.length};
};

const onEdit = (_, action) => {
  if (action === "add") {
    onAdd();
  }
};

const saveData = async (val) => {
  const obj = {
    id: props.data.id,
    configuration: {
      ...props.data.configuration,
      writers: val.map((i, index) => ({...i, index: index}))
    }
  };
  const resp = await modify(props.data.id, obj);
  if (resp.success) {
    onlyMessage($t("Product.index.660348-18"));
    emits("refresh");
    return true;
  }
  return false;
};

const onSave = async (dt, flag) => {
  const _data = [...tabList.value];
  if (flag) {
    const _index = tabList.value.findIndex(i => i.index === dt.index)
    if(_index !== -1){
      _data[_index] = dt
    }
  } else {
    _data.push(dt);
  }
  const resp = await saveData(_data);
  if (resp) {
    current.visible = false;
    activeKey.value = dt.index || 0;
    return true;
  }
  return false;
};

const handleMenuClick = (e, item) => {
  if (e.key === "delete") {
    const _index = tabList.value.findIndex(i => i.index === item.index)
    if(_index !== -1){
      tabList.value.splice(_index, 1)
    }
    saveData(tabList.value)
    activeKey.value = 0
  }
  if (e.key === "edit") {
    current.visible = true;
    current.data = item;
  }
};

const onAction = (item) => {
  if (item) {
    const _index = tabList.value.findIndex(i => i.index === item.index)
    if(_index !== -1){
      tabList.value[_index] = {...item, state: item.state === 'enabled' ? 'disabled' : 'enabled'}
      saveData(tabList.value)
    }
  }
};

onMounted(() => {
  queryWriterProviders().then((res) => {
    if (res.success) {
      providerList.value = res.result;
    }
  });
});

watch(
    () => JSON.stringify(props.data),
    () => {
      tabList.value = props.data.configuration?.writers || []
    },
    {
      immediate: true,
    }
);
</script>

<style lang="less" scoped>
.empty-box {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .text {
    font-size: 16px;
    color: #1a1a1a;
  }

  .desc {
    color: #777777;
    margin: 8px 0;
  }
}

.title {
  color: #1a1a1a;
  font-weight: 500;
  margin: 8px 0;
}

.push-config-content {
  :deep(.ant-tabs-tab-active) {
    background-color: #f1f7ff;

    .ant-tabs-tab-btn {
      color: #1a1a1a;
    }
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desc {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 0;

  .desc-item {
    display: flex;
    align-items: center;
    gap: 16px;

    &-label {
      color: #777777;
    }

    &-value {
      color: #1a1a1a;
    }
  }
}
</style>
