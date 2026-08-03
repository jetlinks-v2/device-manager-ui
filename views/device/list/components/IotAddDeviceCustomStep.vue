<template>
  <section class="add-device__custom">
    <div class="add-device__custom-head">
      <div>
        <h4>{{ $t('IotDeviceList.add.customTitle') }}</h4>
        <p>{{ $t('IotDeviceList.add.customDesc') }}</p>
      </div>
      <a-button @click="$emit('back')">
        <template #icon>
          <AIcon type="AppstoreOutlined" aria-hidden="true" />
        </template>
        {{ $t('IotDeviceList.add.backToLibrary') }}
      </a-button>
    </div>

    <IotAddDeviceProductStep
      :open="open"
      :available-products="availableProducts"
      :library-products="libraryProducts"
      :selected-product-key="selectedProductKey"
      :selected-template-key="selectedTemplateKey"
      :template-open="templateOpen"
      :product-message="productMessage"
      :library-message="libraryMessage"
      :category-label="categoryLabel"
      :product-loading="productLoading"
      :template-loading="templateLoading"
      :show-product-selector="true"
      :show-template-create="true"
      @select-product="$emit('select-product', $event)"
      @select-template="$emit('select-template', $event)"
      @update:template-open="$emit('update:template-open', $event)"
      @add-template="$emit('add-template', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import IotAddDeviceProductStep from './IotAddDeviceProductStep.vue'

defineProps({
  open: { type: Boolean, default: false },
  availableProducts: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  libraryProducts: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  selectedProductKey: { type: String, required: true },
  selectedTemplateKey: { type: String, required: true },
  templateOpen: { type: Boolean, default: false },
  productMessage: { type: String, default: '' },
  libraryMessage: { type: String, default: '' },
  productLoading: { type: Boolean, default: false },
  templateLoading: { type: Boolean, default: false },
  categoryLabel: { type: Function as PropType<(categoryKey: string) => string>, required: true },
})

defineEmits<{
  (e: 'back'): void
  (e: 'select-product', productId: string): void
  (e: 'select-template', templateId: string): void
  (e: 'update:template-open', value: boolean): void
  (e: 'add-template', templateId: string): void
}>()

const { t: $t } = useI18n()
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
