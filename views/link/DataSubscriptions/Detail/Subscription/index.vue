<template>
  <div v-if="isEmpty" class="empty-box">
    <j-empty>
      <template #description>
        <div class="text">暂无数据</div>
        <div class="desc">请点击[配置]按钮配置订阅数据</div>
      </template>
      <a-button type="primary" @click="onConfig">配置</a-button>
    </j-empty>
  </div>
  <div v-else style="display: flex; flex-direction: column; height: 100%; gap: 16px; ">
    <div class="sub-content">
      <a-space>
        <AIcon style="color: #1677FF" type="InfoCircleFilled"/>
        <div style="color: #777777;">订阅模式</div>
        <div>{{'自定义'}}</div>
        <a-button type="link" @click="onConfig">重新配置</a-button>
      </a-space>
      <div>该模式下仅推送下列设备数据，，设备列表固定，不随设备增减自动更新，需手动维护</div>
    </div>
    <div v-if="data.type !== 'device'" style="flex: 1; min-height: 0; display: flex; flex-direction: column">
      <SelectDevice :data="data" />
    </div>
  </div>
  <Config v-if="visible" @close="visible = false" />
</template>

<script setup>
import Config from '../components/Config/index.vue';
import SelectDevice from './SelectDevice.vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({type: 'device'}),
  },
})

const isEmpty = ref(false)
const visible = ref(false)

const onConfig = () => {
  visible.value = true
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

.sub-content {
  border-radius: 6px;
  background: #F5F5F5;
  border: 1px solid #CCCCCC;
  padding: 8px 16px;
}
</style>
