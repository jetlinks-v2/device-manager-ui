<template>
  <a-form-item
    :label="$t('Double.ScaleItem.628033-0')"
    :name="name"
  >
    <a-input-number
      v-model:value="scale"
      style="width: 100%"
      :precision="0"
      :min="0"
      :max="99"
      :placeholder="$t('Double.ScaleItem.628033-1')"
      @change="change"
    />
  </a-form-item>
</template>

<script setup name="MetadataScaleItem">
const emit = defineEmits(['update:value']);

const props = defineProps({
  value: {
    type: Number,
    default: 0,
  },
  name: {
    type: String,
    default: 'scale',
  },
});

const scale = ref(props.value);

const change = () => {
  emit('update:value', scale.value);
};

watch(
  () => props.value,
  () => {
    scale.value = props.value;
  });

</script>

<style scoped>

</style>
