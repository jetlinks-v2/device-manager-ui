<template>
  <div class="device-relationship">
    <div class="sections-container">
      <!-- 正向关系部分 -->
      <div class="section-card">
        <div class="section-header">
          <div class="header-left">
            <div class="section-title">
              <TitleComponent data="正向关系">
                <template #extra>
                  <AIcon type="QuestionCircleOutlined" class="help-icon"/>
                </template>
              </TitleComponent>
            </div>
          </div>
          <AIcon type="FormOutlined" class="edit-icon" @click="handleEditRelationship"/>
        </div>
        <div class="section-content">
          <div class="relation-count"><div>已配置关系</div> <div class="count-num">{{ relationCount }}</div></div>
          <div class="relation-list">
            <div
              v-for="item in relationshipData"
              :key="item.objectId"
              class="relation-item"
            >
              <div class="relation-label">{{ item.relationName }}</div>
              <div class="relation-value">{{ item.relation }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 组织部分 -->
      <div class="section-card">
        <div class="section-header">
          <div class="header-left">
            <div class="section-title">
              <TitleComponent data="组织"/>
            </div>
          </div>
          <AIcon type="FormOutlined" class="edit-icon" @click="handleEditOrganization"/>
        </div>
        <div class="section-content">
          <TreeList
            :data="organizationTreeData"
            :loading="loading.organizations"
            @view-change="handleOrganizationViewChange"
          >
            <template #extra-controls>
              <AIcon type="UnorderedListOutlined" class="list-icon"/>
            </template>
            <template #header-extra>
              <div class="organization-count">已加入组织节点 <span class="count-num">{{ organizationCount }}</span></div>
            </template>
            <template #actions="{ item, level }">
              <a-tag
                v-for="action in item.actions || getDefaultActions()"
                :key="action.type"
              >
                {{ action.label }}
              </a-tag>
            </template>
            <template #empty>
              <div class="empty-text">暂无组织数据</div>
            </template>
          </TreeList>
        </div>
      </div>

      <!-- 分组部分 -->
      <div class="section-card">
        <div class="section-header">
          <div class="header-left">
            <div class="section-title">
              <TitleComponent data="分组">
                <template #extra>
                  <AIcon type="QuestionCircleOutlined" class="help-icon"/>
                </template>
              </TitleComponent>
            </div>
          </div>
          <AIcon type="FormOutlined" class="edit-icon" @click="handleEditGroup"/>
        </div>
        <div class="section-content">
          <TreeList
            :data="groupTreeData"
            :loading="loading.groups"
            @view-change="handleGroupViewChange"
          >
            <template #header-extra>
              <div class="group-count">已加入组织节点 <span class="count-num">{{ groupCount }}</span></div>
            </template>
            <template #actions="{ item, level }">
              <a-button type="text" size="small" class="action-view">
                查看
              </a-button>
            </template>
            <template #empty>
              <div class="empty-text">暂无分组数据</div>
            </template>
          </TreeList>
        </div>
      </div>
    </div>
  </div>

  <RelationshipEditModal
      v-if="showRelationshipModal"
      @close="showRelationshipModal = false"
      @save="handleSaveRelationship"
  />

  <OrganizationEditModal
      v-if="showOrganizationModal"
      @close="showOrganizationModal = false"
      @save="handleSaveOrganization"
  />

  <GroupEditModal
      v-if="showGroupModal"
      @close="showGroupModal = false"
      @save="handleSaveGroup"
  />

</template>

<script lang="ts" setup>
import RelationshipEditModal from './components/RelationshipEditModal.vue'
import OrganizationEditModal from './components/OrganizationEditModal.vue'
import GroupEditModal from './components/GroupEditModal.vue'
import TreeList from './components/TreeList.vue'
import {useInstanceStore} from "@device/store/instance";

const instanceStore = useInstanceStore();
const treeView = ref('tree')
const groupTreeView = ref(true)
const showRelationshipModal = ref(false)
const showOrganizationModal = ref(false)
const showGroupModal = ref(false)

// 数据状态
const loading = reactive({
  relations: false,
  organizations: false,
  groups: false
})

const organizationData = ref<any[]>([])
const groupData = ref<any[]>([])

// 树形数据结构
const organizationTreeData = computed(() => [
  {
    id: '1',
    name: '产品开发部',
    actions: [
      { type: 'view', label: '查看' },
      { type: 'edit', label: '编辑' },
      { type: 'delete', label: '删除' },
      { type: 'share', label: '共享' }
    ],
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
            actions: [
              { type: 'view', label: '查看' },
              { type: 'share', label: '共享' }
            ]
          },
          {
            id: '5',
            name: '西南项目部',
            children: [
              {
                id: '6',
                name: '四川分部门',
                actions: [
                  { type: 'view', label: '查看' },
                  { type: 'share', label: '共享' },
                  { type: 'delete', label: '删除' }
                ]
              },
              {
                id: '7',
                name: '重庆分部门',
                actions: [
                  { type: 'view', label: '查看' },
                  { type: 'share', label: '共享' },
                  { type: 'delete', label: '删除' }
                ]
              },
              {
                id: '8',
                name: '云南分部门',
                actions: [
                  { type: 'view', label: '查看' },
                  { type: 'share', label: '共享' },
                  { type: 'delete', label: '删除' }
                ]
              },
              {
                id: '9',
                name: '贵州分部门',
                actions: [
                  { type: 'view', label: '查看' },
                  { type: 'share', label: '共享' },
                  { type: 'delete', label: '删除' }
                ]
              },
              {
                id: '10',
                name: '广西分部门',
                actions: [
                  { type: 'view', label: '查看' }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
])

const groupTreeData = computed(() => [
  {
    id: '1',
    name: '智慧工厂',
    children: [
      {
        id: '2',
        name: '重庆/月亮湾项目'
      },
      {
        id: '3',
        name: '重庆月亮湾项目'
      }
    ]
  },
  {
    id: '4',
    name: '物联网产品基地/A栋/5楼'
  }
])

// 统计数据
const relationshipData = computed(() => instanceStore.current?.relations)
const relationCount = computed(() => 0)
const organizationCount = computed(() => 8) // 根据实际数据计算
const groupCount = computed(() => 2) // 根据实际数据计算

// 视图切换事件
const handleOrganizationViewChange = (view: 'tree' | 'flat') => {
  treeView.value = view
}

const handleGroupViewChange = (view: 'tree' | 'flat') => {
  groupTreeView.value = view === 'tree'
}

// 默认操作按钮
const getDefaultActions = () => [
  { type: 'view', label: '查看' },
  { type: 'edit', label: '编辑' },
  { type: 'delete', label: '删除' },
  { type: 'share', label: '共享' }
]

const handleEditRelationship = () => {
  showRelationshipModal.value = true
}

const handleEditOrganization = () => {
  showOrganizationModal.value = true
}

const handleEditGroup = () => {
  showGroupModal.value = true
}

const handleSaveRelationship = () => {
  showRelationshipModal.value = false
}

const handleSaveOrganization = () => {
  showOrganizationModal.value = false
}

const handleSaveGroup = () => {
  showGroupModal.value = false
}

// 数据获取方法
const fetchDeviceInfo = async () => {
  // try {
  //   loading.relations = true
  //   const response = await detail(props.deviceId)
  //   if (response.success) {
  //     deviceInfo.value = response.result
  //     // 处理设备关系数据
  //     parseRelationshipData(response.result)
  //   }
  // } catch (error) {
  //   console.error('获取设备信息失败:', error)
  // } finally {
  //   loading.relations = false
  // }
}

const fetchOrganizationData = async () => {
  try {
    loading.organizations = true
    // 获取设备组织绑定信息
    // const response = await getBindingsPermission('device', [props.deviceId])
    // if (response.success && response.result) {
    //   organizationData.value = response.result.map((item: any) => ({
    //     id: item.targetId,
    //     name: item.targetName || item.target,
    //     type: item.targetType,
    //     actions: parseActions(item.permissions || [])
    //   }))
    // }
  } catch (error) {
    console.error('获取组织数据失败:', error)
  } finally {
    loading.organizations = false
  }
}

const fetchGroupData = async () => {
  try {
    loading.groups = true
    // 模拟获取分组数据，实际应根据API调整
    // 这里可以调用具体的分组API
    groupData.value = [
      { id: '1', name: '智慧工厂-重庆/月亮湾项目' },
      { id: '2', name: '智慧工厂-重庆月亮湾项目' },
      { id: '3', name: '物联网产品基地/A栋/5楼' }
    ]
  } catch (error) {
    console.error('获取分组数据失败:', error)
  } finally {
    loading.groups = false
  }
}

// 初始化数据
onMounted(() => {
  if (instanceStore.current?.id) {
    fetchDeviceInfo()
    fetchOrganizationData()
    fetchGroupData()
  }
})
</script>

<style lang="less" scoped>
.device-relationship {
  background: #fff;
  height: 100%;

  .sections-container {
    display: flex;
    gap: 16px;
    height: 100%;

    .section-card {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;

        .header-left {
          display: flex;
          align-items: center;
          gap: 6px;

          .section-title {
            color: #1890ff;

            :deep(.title) {
              margin-bottom: 0;
            }
          }

          .help-icon {
            color: #999;
          }
        }

        .edit-icon {
          color: #999;
          font-size: 14px;
          cursor: pointer;

          &:hover {
            color: #1890ff;
          }
        }
      }

      .section-content {
        padding: 12px 16px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        background-color: #F7F8FA;
        display: flex;
        flex-direction: column;
      }
    }

    // 正向关系样式
    .section-card:first-child {
      .relation-count {
        margin-bottom: 12px;
        color: #191C27;
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .count-num {
          background-color: #EFF0F1;
          color: #1F2429;
          margin-left: 10px;
          padding: 4px;
        }
      }

      .relation-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        .relation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background-color: #F1F7FF;
          border: 1px solid #BAE0FF;

          &:not(:last-child) {
            margin-bottom: 10px;
          }

          .relation-label {
            color: #777777;
            max-width: 50%;
          }

          .relation-value {
            color: #1A1A1A;
            text-align: right;
            flex: 1;
          }
        }
      }
    }

    // 组织部分样式
    .section-card:nth-child(2) {
      .view-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .ant-btn-sm {
          height: 24px;
          padding: 0 8px;
          border-radius: 2px;
        }

        .list-icon {
          color: #999;
          font-size: 14px;
          margin-left: 4px;
        }
      }

      .organization-count {
        margin-bottom: 12px;
        color: #191C27;
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .count-num {
          background-color: #EFF0F1;
          color: #1F2429;
          margin-left: 10px;
          padding: 4px;
        }
      }

      .organization-content {
        .org-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
          line-height: 20px;

          &.sub-item {
            padding-left: 16px;
          }

          &.sub-sub-item {
            padding-left: 32px;
            background: #f0f8ff;
            border-left: 3px solid #1890ff;
            margin: 2px 0;
            padding-right: 8px;
            border-radius: 0 4px 4px 0;
          }

          .expand-icon {
            width: 12px;
            height: 12px;
            margin-right: 4px;
            color: #999;
            font-size: 10px;
            transform: translateY(0);

            &.expanded {
              color: #1890ff;
            }
          }

          .org-name {
            flex: 1;
            color: #333;
          }

          .org-actions {
            display: flex;
            gap: 2px;

            .ant-btn {
              height: 20px;
              padding: 0 4px;
              border: none;
              border-radius: 2px;

              &.action-view {
                color: #1890ff;
                background: #f0f8ff;
              }

              &.action-edit {
                color: #52c41a;
                background: #f6ffed;
              }

              &.action-delete {
                color: #ff4d4f;
                background: #fff2f0;
              }

              &.action-share {
                color: #722ed1;
                background: #f9f0ff;
              }

              &:hover {
                opacity: 0.8;
              }
            }
          }
        }
      }
    }

    // 分组部分样式
    .section-card:last-child {
      .view-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .ant-btn-sm {
          height: 24px;
          padding: 0 8px;
          border-radius: 2px;
        }
      }

      .group-count {
        margin-bottom: 8px;
        color: #666;

        .count-num {
          color: #1890ff;
          font-weight: 500;
        }
      }

      .group-list {
        .group-item {
          padding: 6px 8px;
          margin-bottom: 4px;
          background: #f8f9fa;
          border-radius: 4px;
          color: #333;
        }
      }
    }

    // 通用样式
    .list-icon {
      color: #999;
      font-size: 14px;
      margin-left: 4px;
    }

    .organization-count,
    .group-count {
      color: #191C27;
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .count-num {
        background-color: #EFF0F1;
        color: #1F2429;
        margin-left: 10px;
        padding: 4px;
        border-radius: 2px;
      }
    }

    .empty-text {
      color: #999;
      font-size: 14px;
      text-align: center;
      padding: 20px;
    }

    // 操作按钮样式
    :deep(.ant-btn) {
      &.action-view {
        color: #1890ff;
        background: #f0f8ff;
        border: none;
        height: 20px;
        padding: 0 4px;
        border-radius: 2px;
      }

      &.action-edit {
        color: #52c41a;
        background: #f6ffed;
        border: none;
        height: 20px;
        padding: 0 4px;
        border-radius: 2px;
      }

      &.action-delete {
        color: #ff4d4f;
        background: #fff2f0;
        border: none;
        height: 20px;
        padding: 0 4px;
        border-radius: 2px;
      }

      &.action-share {
        color: #722ed1;
        background: #f9f0ff;
        border: none;
        height: 20px;
        padding: 0 4px;
        border-radius: 2px;
      }

      &:hover {
        opacity: 0.8;
      }
    }
  }
}
</style>
