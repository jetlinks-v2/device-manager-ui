<template>
  <a-modal visible :title="data.id ? '新增推送地址' : '编辑推送地址'" @cancel="emit('close')" @ok="onSave" :confirm-loading="loading">
    <a-form ref="formRef" :model="formData" layout="vertical">
      <a-form-item
          label="名称"
          name="name"
          :rules="[
             {required: true, message: '请输入名称'},
             {
                max: 64,
                message: $t('Save.index.5349810-3'),
             },
          ]"
      >
        <a-input v-model:value="formData.name" placeholder="请输入名称"/>
      </a-form-item>
      <a-form-item label="推送方式" name="way">
        <a-select
            v-model:value="formData.way"
            placeholder="请选择推送方式"
            option-label-prop="label"
        >
          <a-select-option value="HTTP" label="HTTP">
            <div aria-label="HTTP" class="way-item">
              <AIcon type="MacCommandOutlined" class="icon" />
              <div>HTTP</div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="推送类型" name="type" :rules="[{required: true, message: '请选择推送类型'}]">
        <a-select
            v-model:value="formData.type"
            placeholder="请选择推送类型"
            allow-clear
        >
          <a-select-option value="get">GET</a-select-option>
          <a-select-option value="post">POST</a-select-option>
          <a-select-option value="patch">PATCH</a-select-option>
          <a-select-option value="delete">DELETE</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item
          label="地址"
          name="address"
          :rules="[
              {required: true, message: '请输入地址'},
              {
                max: 256,
                message: '256',
             },
          ]"
      >
        <a-input v-model:value="formData.address" placeholder="请输入地址" />
      </a-form-item>
      <a-form-item
          label="token"
          name="token"
          :rules="[
             {required: true, message: '请输入token'},
             {
                max: 32,
                message: '32',
             },
          ]"
      >
        <a-input v-model:value="formData.token" placeholder="请输入token" />
      </a-form-item>
      <a-form-item
          label="说明"
          name="description"
          :rules="[
             {
                max: 200,
                message: '200',
             }
          ]"
      >
        <a-textarea placeholder="请输入说明" v-model:value="formData.description"/>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import {useI18n} from "vue-i18n";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['close', 'save'])
const {t: $t} = useI18n();

const loading = ref(false)
const formRef = ref()
const formData = reactive({
  name: undefined,
  way: 'HTTP',
  type: undefined,
  address: undefined,
  token: undefined,
  description: undefined,
})

const onSave = async () => {
  const resp = await formRef.value.validate()
  if(resp){
    loading.value = true
    emit('save', formData)
  }
}

watch(() => JSON.stringify(props.data), () => {
  Object.assign(formData, props.data)
}, {
  immediate: true,
})
</script>

<style lang="less" scoped>
.way-item {
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #D9D9D9;
  padding: 6px;
  .icon {
    font-size: 24px;
  }
}
</style>
