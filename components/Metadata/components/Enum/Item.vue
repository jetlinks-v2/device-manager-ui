<template>
  <a-form-item :name="name" :rules="rules" :validate-first="true">
    <template #label>
      {{ $t('Enum.Item.997342-0') }}
      <span style="color: #ff4d4f; padding-right: 4px; padding-top: 2px">*</span>
    </template>
    <Content ref="tableRef" v-model:value="dataSource" @change="change" />
  </a-form-item>
</template>

<script setup name="MetadataEnumItem">
import Content from './ItemContent.vue'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const emit = defineEmits(['update:value'])
const props = defineProps({
  value: {
    type: Array,
    default: () => [],
  },
  type: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: 'elements',
  },
});


const dataSource = ref(props.value || [])
const tableRef = ref()

const rules = [
  {
    validator: async (_, value) =>{
      console.log(value, dataSource.value)
      if (!dataSource.value?.length) {
        return Promise.reject($t('Enum.Item.997342-1'));
      }
      // console.log(tableRef, tableRef.value)
      // const data = await tableRef.value?.validate?.()
      // if (!data) {
      //   return Promise.reject('');
      // }
      return Promise.resolve();
    },
  },
];

const change = () => {
  emit('update:value', dataSource.value)
}

const validate = async () => {
  const res = await tableRef.value?.validate()
  return res
}

defineExpose({
  validate
})

watch(
  () => JSON.stringify(props.value),
  (val) => {
    dataSource.value = val ? JSON.parse(val) : [];
  },
);
</script>

<style scoped>

</style>
