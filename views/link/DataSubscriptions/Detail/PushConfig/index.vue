<template>
  <div v-if="!tabList.length" class="empty-box">
    <j-empty>
      <template #description>
        <div class="text">暂无数据</div>
        <div class="desc">点击打开「新增推动地址」对话框</div>
      </template>
      <a-button type="primary" @click="onAdd">新增</a-button>
    </j-empty>
  </div>
  <div v-else class="push-config-content">
    <div class="title">推送地址</div>
    <a-tabs v-model:activeKey="activeKey" type="editable-card" @edit="onEdit">
      <a-tab-pane v-for="item in tabList" :key="item.key" :closable="false">
        <template #tab>
          <div class="tab-item">
            <div>{{item.title}}</div>
            <a-tag>HTTP</a-tag>
            <a-popconfirm :title="item.state ? '确认禁用？' : '确认启用？'" @confirm="onAction(item.state)">
              <a-switch :checked="item.state" size="small" />
            </a-popconfirm>
            <a-dropdown>
              <AIcon type="MoreOutlined" />
              <template #overlay>
                <a-menu @click="(e) => handleMenuClick(e, item)">
                  <a-menu-item key="edit">
                    <AIcon type="EditOutlined" />
                    编辑
                  </a-menu-item>
                  <a-menu-item key="delete">
                    <AIcon type="DeleteOutlined" />
                    删除
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </template>
      </a-tab-pane>
    </a-tabs>
    <div>
      <div class="title">详情信息</div>
      <div class="desc">
        <div class="desc-item">
          <div class="desc-item-label">地址</div>
          <div class="desc-item-value">192.168.135.223</div>
        </div>
        <div class="desc-item">
          <div class="desc-item-label">推送地址</div>
          <div class="desc-item-value">POST</div>
        </div>
        <div class="desc-item">
          <div class="desc-item-label">说明</div>
          <div class="desc-item-value">--</div>
        </div>
      </div>
      <div class="title">推送示例<a-tooltip title="根据上方随选推送方式动态变化"><AIcon
          type="QuestionCircleOutlined"
          style="color: #a6a6a6; margin-left: 10px"
      /></a-tooltip></div>
      123
    </div>
  </div>
  <Save v-if="current.visible" @close="current.visible = false" @save="onSave" />
</template>

<script setup>
import Save from './Save.vue'
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

const tabList = ref([
  { title: 'Tab 1', key: '1', state: true },
  { title: 'Tab 2', key: '2', state: false },
  { title: 'Tab 3', key: '3', state: true },
])
const activeKey = ref();
const current = reactive({
  visible: false,
  data: {}
})
const onAdd = () => {
  current.visible = true
  current.data = {}
}

const onEdit = (targetKey, action) => {
  if(action === 'add'){
    onAdd()
  }
};

const onSave = () => {
  current.visible = false
}

const handleMenuClick = (e, item) => {
  if(e.key === 'delete'){

  }
  if(e.key === 'edit'){
    current.visible = false
    current.data = item
  }
}

const onAction = (state) => {
  if(state){

  }
}
</script>

<style lang="less" scoped>
.empty-box {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .text {
    font-size: 16px;
    color: #1A1A1A;
  }

  .desc {
    color: #777777;
    margin: 8px 0;
  }
}

.title {
  color: #1A1A1A;
  font-weight: 500;
  margin: 8px 0;
}

.push-config-content {
  :deep(.ant-tabs-tab-active){
    background-color: #F1F7FF;

    .ant-tabs-tab-btn {
      color: #1A1A1A;
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
      color: #1A1A1A;
    }
  }
}
</style>
