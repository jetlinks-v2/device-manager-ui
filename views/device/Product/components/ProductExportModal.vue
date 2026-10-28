<template>
  <a-modal
    :open="open"
    :title="$t('Product.transfer.001-1')"
    :width="640"
    :confirm-loading="loading"
    :ok-button-props="{ disabled: !selectedType }"
    :ok-text="$t('Product.transfer.001-8')"
    :mask-closable="false"
    @ok="confirm"
    @cancel="close"
  >
    <div class="product-transfer-options" role="radiogroup">
      <button
        v-for="option in exportOptions"
        :key="option.type"
        type="button"
        class="product-transfer-options__card"
        :class="{ 'is-selected': selectedType === option.type }"
        :aria-pressed="selectedType === option.type"
        @click="selectedType = option.type"
      >
        <span class="product-transfer-options__icon"><AIcon :type="option.icon" /></span>
        <span class="product-transfer-options__content">
          <strong>{{ $t(option.label) }}</strong>
          <small>{{ $t(option.description) }}</small>
        </span>
        <AIcon v-if="selectedType === option.type" type="CheckCircleFilled" class="product-transfer-options__check" />
      </button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProductTransferType } from '../hooks/useProductTransfer'

const props = defineProps<{
  open: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  export: [type: ProductTransferType]
}>()

const { t: $t } = useI18n()
const selectedType = ref<ProductTransferType>()
const exportOptions = computed(() => [
  {
    type: 'basic' as const,
    label: 'Product.transfer.001-2',
    description: 'Product.transfer.001-4',
    icon: 'FileTextOutlined',
  },
  {
    type: 'resource' as const,
    label: 'Product.transfer.001-3',
    description: 'Product.transfer.001-5',
    icon: 'FolderOpenOutlined',
  },
])

const close = () => emit('update:open', false)

const confirm = () => {
  if (selectedType.value) emit('export', selectedType.value)
}

watch(() => props.open, visible => {
  if (visible) selectedType.value = 'basic'
})
</script>

<style scoped>
.product-transfer-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.product-transfer-options__card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  min-height: 88px;
  padding: 16px;
  border: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09));
  border-radius: 8px;
  background: var(--color-jet-fill, #fff);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.product-transfer-options__card:hover { border-color: var(--jet-theme-primary); }
.product-transfer-options__card.is-selected { border-color: var(--jet-theme-primary); background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.06)); }
.product-transfer-options__icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.08)); color: var(--jet-theme-primary); font-size: 18px; }
.product-transfer-options__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.product-transfer-options__content strong { font-weight: 500; }
.product-transfer-options__content small { color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); line-height: 1.5; }
.product-transfer-options__check { color: var(--jet-theme-primary); font-size: 18px; }
@media (max-width: 640px) { .product-transfer-options { grid-template-columns: 1fr; } }
</style>
