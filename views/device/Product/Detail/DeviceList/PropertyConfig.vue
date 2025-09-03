<template>
  <a-drawer
      :open="true"
      title="属性配置"
      :visible="true"
      :width="600"
      placement="right"
      @close="handleClose"
  >
    <template #extra>
      <a-space>
        <j-permission-button
            :tooltip="{
                title: '重置'
            }"
            danger
            type="link"
            :popConfirm="{
            title: '确定重置？',
            onConfirm: () => {
              handleReset()
            }
          }"
        >
          重置
        </j-permission-button>

        <a-button type="primary" @click="handleSave">保存</a-button>
      </a-space>
    </template>

    <div class="property-config-content">
      <div class="search-section">
        <a-input-search
            v-model:value="searchText"
            placeholder="搜索属性"
            style="width: 200px;"
            allowClear
            @search="handleSearch"
        />
        <div class="enabled-count">
          已开启: {{ enabledCount }} / 20
        </div>
      </div>

      <div class="property-list">
        <VirtualScroll :data="filteredProperties" :itemHeight="80">
          <template #renderItem="property">
            <div
                :key="property.id"
                class="property-card"
            >
              <div class="property-info">
                <div class="property-name">
                  <j-ellipsis>{{ property.name }}</j-ellipsis>
                </div>
                <div class="property-id">
                  <j-ellipsis>{{ property.id }}</j-ellipsis>
                </div>
              </div>
              <div class="property-actions">
                <Item :property="property" :list="localProperties" :disabled="enabledCount >= 20" @change="(val) => onChange(val, property)" />
                <j-permission-button
                    type="link"
                    @click="handleToggleTop(property)"
                >
                  置顶
                </j-permission-button>
              </div>
            </div>
          </template>
        </VirtualScroll>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import Item from "./Item.vue";
import {onlyMessage} from "@jetlinks-web/utils";
import {useI18n} from "vue-i18n";

const props = defineProps({
  properties: {
    type: Array,
    default: () => []
  },
  showProperties: {
    type: Array,onConfirm: () => {
    }
  }
});
const emits = defineEmits(['save', 'close']);
const { t: $t } = useI18n();
const searchText = ref('');
const _searchText = ref('');
const localProperties = ref([]);

// 已启用属性数量
const enabledCount = computed(() => localProperties.value.filter(prop => prop.enabled).length);

// 过滤后的属性列表
const filteredProperties = computed(() => {
  if (!searchText.value) {
    return localProperties.value;
  }
  return localProperties.value.filter(i =>
      i.name.includes(_searchText.value) ||
      i.id.includes(_searchText.value)
  );
});

// 监听外部属性变化，同步到本地
watch(() => props.showProperties, (newProperties) => {
  localProperties.value = props.properties.map(i => {
    const showProperty = newProperties.find(j => j.id === i.id)
    if (showProperty) {
      i.enabled = showProperty.enabled
    }
    return i
  })
}, {immediate: true, deep: true});

// 关闭抽屉
const handleClose = () => {
  emits('close')
};
const onChange = (val, property) => {
  localProperties.value = localProperties.value.map(i => {
    if (i.id === property.id) {
      i.enabled = val
    }
    return i
  })
}

// 搜索属性
const handleSearch = (val) => {
  _searchText.value = val
};

// 置顶切换
const handleToggleTop = (property) => {
  localProperties.value = localProperties.value.filter(item => item.id !== property.id);
  localProperties.value.unshift(property);
};

// 重置属性配置
const handleReset = () => {
  localProperties.value = props.properties.map(i => {
    return {
      ...i,
      enabled: false
    }
  })
  onlyMessage($t("Product.index.660348-18"));
};

// 保存属性配置
const handleSave = () => {
  const arr = localProperties.value.filter(i => i.enabled)
  emits('save', arr);
  onlyMessage($t("Product.index.660348-18"));
};
</script>

<style scoped lang="less">
.property-config-content {
  height: 100%;
  display: flex;
  flex-direction: column;

  .search-section {
    margin-bottom: 16px;
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: space-between;

    .enabled-count {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
  }

  .property-list {
    flex: 1;
    min-height: 0;

    .property-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: #f8f9fa;
      border-radius: 6px;
      transition: all 0.3s;

      &:hover {
        background: #e8f4fd;
      }

      .property-info {
        flex: 1;

        .property-name {
          font-size: 16px;
          font-weight: 500;
          color: #262626;
          margin-bottom: 4px;
        }

        .property-id {
          font-size: 12px;
          color: #8c8c8c;
        }
      }

      .property-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }
  }
}
</style>
