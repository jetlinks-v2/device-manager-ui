<template>
  <a-modal visible :title="data.id ? $t('DataSubscriptions.Detail.index.697323-55') : $t('DataSubscriptions.Detail.index.697323-56')" @cancel="emit('close')" @ok="onSave" :confirm-loading="loading">
    <a-form ref="formRef" :model="formData" layout="vertical">
      <a-form-item
          :label="$t('Save.index.912481-4')"
          name="name"
          :rules="[
             {required: true, message: $t('Save.index.912481-5')},
             {
                max: 64,
                message: $t('Save.index.5349810-3'),
             },
          ]"
      >
        <a-input v-model:value="formData.name" :placeholder="$t('Save.index.912481-5')"/>
      </a-form-item>
      <a-form-item :label="$t('DataSubscriptions.Detail.index.697323-36')" name="way">
        <a-select
            v-model:value="formData.way"
            :placeholder="$t('Save.index.646914-10')"
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
      <a-form-item :label="$t('DataSubscriptions.Detail.index.697323-37')" name="type" :rules="[{required: true, message: $t('DataSubscriptions.Detail.index.697323-37-1')}]">
        <a-select
            v-model:value="formData.type"
            :placeholder="$t('DataSubscriptions.Detail.index.697323-37-1')"
            allow-clear
        >
          <a-select-option value="get">GET</a-select-option>
          <a-select-option value="post">POST</a-select-option>
          <a-select-option value="patch">PATCH</a-select-option>
          <a-select-option value="delete">DELETE</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item
          :label="$t('DataSubscriptions.Detail.index.697323-38')"
          name="address"
          :rules="[
              {required: true, message: $t('DataSubscriptions.Detail.index.697323-38-1')},
              {
                max: 256,
                message: $t('Form.rules.242792-0', 256),
             },
          ]"
      >
        <a-input v-model:value="formData.address" :placeholder="$t('DataSubscriptions.Detail.index.697323-38-1')" />
      </a-form-item>
      <a-form-item
          label="token"
          name="token"
          :rules="[
             {required: true, message: $t('DataSubscriptions.Detail.index.697323-57')},
             {
                max: 32,
                message: $t('Form.rules.242792-0', 32),
             },
          ]"
      >
        <a-input v-model:value="formData.token" :placeholder="$t('DataSubscriptions.Detail.index.697323-57')" />
      </a-form-item>
      <a-form-item
          :label="$t('DataSubscriptions.index.411661-5')"
          name="description"
          :rules="[
             {
                max: 200,
                message: $t('Save.index.902471-13'),
             }
          ]"
      >
        <a-textarea :placeholder="$t('Save.index.902471-14')" v-model:value="formData.description"/>
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
