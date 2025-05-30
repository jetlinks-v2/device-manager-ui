<template>
  <a-drawer :width="500" visible title="新增数据订阅" @close="emits('close')">
    <template v-if="!selectType">
      <div v-for="item in list" :key="item.id" class="card-item" @click="onSelected(item.id)"
           :class="{disabled: item.disabled}">
        <div class="card-item-left">
          <h3>{{ item.name }}</h3>
          <p>{{ item.desc }}</p>
        </div>
        <div class="card-item-img">
          <img :src="item.img"/>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="alert">
        <AIcon type="InfoCircleFilled" style="color: #2F54EB;"/>
        <div>订阅模式</div>
        <div style="color: #1A1A1A">{{ list.find(i => i.id === selectType)?.name}}</div>
        <a-button type="link" @click="onReload">重新选择</a-button>
      </div>
      <a-form layout="vertical" :model="modelRef" ref="formRef">
        <a-form-item
            :label="$t('Save.index.902471-6')"
            name="name"
            :rules="[
                {
                    required: true,
                    message: $t('Save.index.902471-7'),
                },
                {
                    max: 64,
                    message: $t('Save.index.902471-3'),
                },
            ]"
        >
          <a-input
              v-model:value="modelRef.name"
              :placeholder="$t('Save.index.902471-7')"
          />
        </a-form-item>
        <a-form-item
            :label="$t('Save.index.902471-12')"
            name="describe"
            :rules="[
                {
                    max: 200,
                    message: $t('Save.index.902471-13')
                },
            ]"
        >
          <a-textarea
              v-model:value="modelRef.describe"
              :placeholder="$t('Save.index.902471-14')"
              showCount
              :maxlength="200"
          />
        </a-form-item>
      </a-form>
    </template>
    <template #footer v-if="!!selectType">
      <a-space>
        <a-button :loading="loading" @click="onSave" type="primary">保存</a-button>
        <a-button @click="emits('close')">取消</a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script setup>
import {dataSubscriptions} from '@device/assets/data-subscriptions';
import {useI18n} from "vue-i18n";

const props = defineProps({})
const emits = defineEmits(['close', 'save'])

const {t: $t} = useI18n();
const list = [
  {
    id: 'device',
    name: '设备数据',
    desc: '主动推送属性/功能/事件/状态变化数据到第三方平台',
    img: dataSubscriptions.deviceImg,
  },
  {
    id: 'alarm',
    name: '告警数据',
    desc: '主动推送告警异常数据到第三方平台',
    img: dataSubscriptions.alarmImg,
  },
  {
    id: 'more',
    name: '敬请期待',
    desc: '更多订阅类型开发中',
    img: dataSubscriptions.moreImg,
    disabled: true
  }
]
const selectType = ref()
const formRef = ref()
const loading = ref()

const modelRef = reactive({
  name: undefined,
  describe: '',
})
const onSelected = (id) => {
  selectType.value = id
}

const onReload = () => {
  selectType.value = undefined
}

const onSave = () => {
  formRef.value.validate(async (dt) => {
    console.log(dt)
  })
}
</script>

<style lang="less" scoped>
.card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F5F5F5;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
  gap: 16px;

  &.disabled {
    cursor: not-allowed;
  }

  &-left {
    flex: 1;

    h3 {
      color: #1A1A1A;
      font-size: 16px;
    }

    p {
      color: #777777;
    }
  }
}

.alert {
  background: #F5F5F5;
  border: 1px solid #CCCCCC;
  border-radius: 6px;
  padding: 4px 16px;
  gap: 8px;
  display: flex;
  align-items: center;
  color: #777777;
  margin-bottom: 16px;
}
</style>
