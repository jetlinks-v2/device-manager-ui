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
            <a-switch size="small" />
            <a-dropdown>
              <AIcon type="MoreOutlined" />
              <template #overlay>
                <a-menu>
                  <a-menu-item key="1">
                    <AIcon type="EditOutlined" />
                    编辑
                  </a-menu-item>
                  <a-menu-item key="2">
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
      123
      <div class="title">推送示例</div>
      123
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

const tabList = ref([
  { title: 'Tab 1', content: 'Content of Tab 1', key: '1' },
  { title: 'Tab 2', content: 'Content of Tab 2', key: '2' },
  { title: 'Tab 3', content: 'Content of Tab 3', key: '3', closable: false },
])
const activeKey = ref();
const onAdd = () => {

}

const onEdit = (targetKey, action) => {
  console.log(action, targetKey)
};

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
</style>
