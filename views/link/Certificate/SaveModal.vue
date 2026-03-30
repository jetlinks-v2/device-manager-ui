<template>
  <a-modal
    :open="open"
    :maskClosable="false"
    :destroyOnClose="true"
    :footer="null"
    width="1100px"
    :title="title"
    @cancel="emit('update:open', false)"
  >
    <CertificateForm
      :id="id"
      :showCancel="true"
      padding="0"
      @cancel="emit('update:open', false)"
      @success="handleSuccess"
    />
  </a-modal>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CertificateForm from './Detail/CertificateForm.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    id?: string;
  }>(),
  {
    id: ':id',
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}>();

const { t: $t } = useI18n();

const title = computed(() =>
  props.id === ':id' ? $t('Certificate.index.646549-0') : $t('Certificate.index.646549-6'),
);

const handleSuccess = () => {
  emit('success');
  emit('update:open', false);
};
</script>
