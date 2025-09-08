<template>
  <a-modal
      :open="true"
      :title="t('DeviceRelationship.OrganizationEditModal.532167-0')"
      width="1200px"
      @cancel="handleCancel"
      @ok="handleOk"
      :confirm-loading="loading"
      class="organization-modal"
  >
    <div class="modal-content">
      <div class="info-section">
        <div class="info-item">
          <AIcon type="InfoCircleOutlined" class="anticon"/>
          <span>{{ t('DeviceRelationship.OrganizationEditModal.532167-1') }}</span>
        </div>
        <div class="batch-actions">
          <span>{{ t('DeviceRelationship.OrganizationEditModal.532167-2') }}</span>
          <a-checkbox-group v-model:value="batchActions" :options="actionOptions"/>
          <a-switch
              v-model:checked="enableBatchActions"
              size="small"
          />
        </div>
      </div>

      <div class="content-sections">
        <div class="left-section">
          <div class="section-header">
            <a-input
                v-model:value="searchText"
                :placeholder="t('DeviceRelationship.OrganizationEditModal.532167-3')"
            >
              <template #suffix>
                <AIcon type="SearchOutlined"/>
              </template>
            </a-input>
          </div>
          <div class="tree-container">
            <a-tree
                v-model:checkedKeys="checkedKeys"
                :tree-data="organizationTree"
                :field-names="{ children: 'children', title: 'name', key: 'id' }"
                checkable
                :show-icon="false"
            >
              <template #title="{ name }">
                <span>{{ name }}</span>
              </template>
            </a-tree>
          </div>
        </div>

        <div class="right-section">
          <div class="section-title">{{ t('DeviceRelationship.OrganizationEditModal.532167-4') }}</div>
          <div class="selected-items">
            <div
                v-for="item in selectedGroups"
                :key="item.id"
                class="selected-item"
            >
              <div>
                <div style="margin-bottom: 10px">{{ item.name }}</div>
                <a-checkbox-group
                    v-model:value="item.actions"
                    :options="actionOptions"
                />
              </div>
              <div class="item-actions">
                <a-button
                    type="text"
                    size="small"
                    @click="removeItem(item.id)"
                >
                  <template #icon>
                    <AIcon type="CloseOutlined"/>
                  </template>
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script lang="ts" setup>
import {ref, reactive, computed, watch} from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits(['close', 'save'])

const loading = ref(false)
const searchText = ref('')
const checkedKeys = ref<string[]>(['1'])
const batchActions = ref<string[]>(['view', 'edit'])
const enableBatchActions = ref(true)

const actionOptions = computed(() => [
  {label: t('DeviceRelationship.index.710824-8'), value: 'view'},
  {label: t('DeviceRelationship.index.710824-9'), value: 'edit'},
  {label: t('DeviceRelationship.index.710824-10'), value: 'delete'},
  {label: t('DeviceRelationship.index.710824-11'), value: 'share'}
])

const organizationTree = ref([
  {
    id: '1',
    name: '产品研发部',
    children: [
      {
        id: '2',
        name: '开发部'
      },
      {
        id: '3',
        name: '项目部',
        children: [
          {
            id: '4',
            name: '东北项目部',
            children: []
          },
          {
            id: '5',
            name: '西南项目部',
            children: [
              {id: '6', name: '规则分部门'},
              {id: '7', name: 'Tree item'},
              {id: '8', name: 'Tree item'},
              {id: '9', name: 'Tree item'},
              {id: '10', name: 'Tree item'},
              {id: '11', name: 'Tree item'},
              {id: '12', name: 'Tree item'}
            ]
          }
        ]
      }
    ]
  },
  {
    id: '13',
    name: '总管理经办',
    children: [
      {id: '14', name: 'Tree item'}
    ]
  }
])

const selectedGroups = ref([
  {
    id: '1',
    name: '物联网基地',
    actions: ['view', 'edit']
  },
  {
    id: '2',
    name: '传感器设备',
    actions: ['view', 'edit']
  },
  {
    id: '3',
    name: '物联网基地',
    actions: ['view', 'edit']
  },
  {
    id: '4',
    name: '物联网基地',
    actions: ['view', 'edit']
  }
])

const handleCancel = () => {
  emit('close')
}

const handleOk = async () => {
  loading.value = true

  try {
    // 模拟保存请求
    await new Promise(resolve => setTimeout(resolve, 1000))

    emit('save', {
      checkedKeys: checkedKeys.value,
      selectedGroups: selectedGroups.value,
      batchActions: batchActions.value
    })
  } finally {
    loading.value = false
  }
}

const removeItem = (id: string) => {
  const index = selectedGroups.value.findIndex(item => item.id === id)
  if (index > -1) {
    selectedGroups.value.splice(index, 1)
  }
}

// 监听树选择变化，更新已选分组
watch(checkedKeys, (newKeys) => {
  // 这里可以根据选中的节点更新右侧已选分组
  // 实际项目中需要根据具体业务逻辑处理
}, {deep: true})
</script>

<style lang="less" scoped>
.organization-modal {
  .modal-content {
    .info-section {
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;

      .info-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding: 6px 12px;
        background-color: #F5F5F5;
        border-radius: 6px;
        border: 1px solid #cccccc;
        color: #1A1A1A;

        .anticon {
          color: @primary-color;
        }
      }

      .batch-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;

        span {
          color: #000;
          font-weight: 500;
        }
      }
    }

    .content-sections {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      height: 500px;

      .left-section {
        .section-header {
          margin-bottom: 16px;
        }

        .tree-container {
          height: calc(100% - 60px);
          overflow-y: auto;
        }
      }

      .right-section {

        .section-title {
          margin-bottom: 16px
        }

        .selected-items {
          height: calc(100% - 50px);
          overflow-y: auto;

          .selected-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #e8e9ea;

            .item-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }
          }
        }
      }
    }
  }
}

:deep(.ant-checkbox-group) {
  display: flex;
  gap: 8px;

  .ant-checkbox-wrapper {
    font-size: 12px;

    &.ant-checkbox-wrapper-checked {
      .ant-checkbox-wrapper span:last-child {
        color: #1890ff;
      }
    }
  }
}
</style>
