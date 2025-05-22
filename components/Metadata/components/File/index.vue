<template>
  <PopoverModal
      v-model:visible="visible"
      :placement="placement"
      @ok="onOk"
      @cancel="onCancel"
  >
    <template #content>
      <div style="width: 250px">
        <a-form ref="formRef" :model="formData" layout="vertical">
          <Type v-model:value="formData.bodyType" name="bodyType"/>
          <a-form-item
              name="mediaType"
              :rules="[{ required: true, message: $t('Export.index.225315-5') }]"
              :label="$t('Export.index.225315-4')"
          >
            <JTreeSelect
                v-model:value="formData.mediaType"
                :options="typeOptions"
                :placeholder="$t('Export.index.225315-5')"
            />
          </a-form-item>
        </a-form>
      </div>
    </template>
    <slot>
      <a-button type="link" :disabled="disabled" style="padding: 0">
        <template #icon>
          <AIcon type="EditOutlined" :class="{'table-form-required-aicon': !value}"/>
        </template>
      </a-button>
    </slot>
  </PopoverModal>
</template>

<script setup name="MetadataFile">
import Type from './Type.vue'
import {PopoverModal} from '../index'
import {Form} from "ant-design-vue";
import {getFileType} from "@/modules/device-manager-ui/api/product";
import JTreeSelect from './JTreeSelect.vue';

const emit = defineEmits(['update:value', 'confirm', 'cancel']);
const props = defineProps({
  value: {
    type: Object,
    default: () => ({bodyType: undefined, mediaType: undefined}),
  },
  placement: {
    type: String,
    default: 'top',
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const formItemContext = Form.useInjectFormItemContext();
const formRef = ref();
const formData = reactive({
  bodyType: undefined,
  mediaType: undefined
});

const visible = ref(false)

const typeOptions = ref([])

const onOk = async () => {
  const data = await formRef.value.validate()
  if (data) {
    visible.value = false
    const dt = {...props.value, ...formData}
    emit('update:value', dt)
    emit('onOk', dt)
    formItemContext.onFieldChange()
  }
}

const onCancel = () => {
  formRef.value?.resetFields();
  formData.bodyType = props.value.bodyType;
  formData.mediaType = props.value.mediaType;
  emit('cancel');
}

const queryList = () => {
  getFileType().then((resp) => {
    if(resp.success){
      typeOptions.value = resp.result.map((item) => {
        return {
          value: item.text,
          mediaType: item.mediaType,
          options: item.suffix?.map((it) => {
            return {
              mediaType: item.mediaType,
              value: it,
            }
          })
        }
      })
    }
  })
}

watch(
    () => visible.value,
    (val) => {
      if(val){
        if(typeOptions.value.length === 0){
          queryList();
        }
        formData.bodyType = props.value.bodyType;
        formData.mediaType = props.value.mediaType;
      }
    },
    {
      immediate: true
    }
);
</script>

<style scoped>

</style>
