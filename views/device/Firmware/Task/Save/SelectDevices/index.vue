<template>
  <a-input
      :placeholder="$t('Save.SelectDevices.386303-0')"
      v-model:value="checkAble"
      :disabled="true"
  >
    <template #addonAfter>
      <AIcon
          :class="data.view ? 'disabled' : ''"
          type="EditOutlined"
          @click="onVisible"
      />
    </template>
  </a-input>
  <Modal v-if="visible" :data="data" :product-id="productId" />
</template>
<script lang="ts" setup name="SelectDevicesPage">
import { useI18n } from 'vue-i18n';
import Modal from './Modal.vue';

const { t: $t } = useI18n();
const emit = defineEmits(['update:modelValue', 'change']);

const props = defineProps({
  data: {
    type: Object,
    default: () => {},
  },
  productId: {
    type: String,
    default: '',
  },
});
const visible = ref(false);
const checkAble = ref();
const onVisible = () => {
  if(!props.data.view){
    visible.value = true
  }
};

</script>

<style lang="less" scoped>
.disabled {
  pointer-events: auto !important;
  cursor: not-allowed !important;
}
</style>
