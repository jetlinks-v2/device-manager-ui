<template>
  <section class="add-device add-device--products">
    <p v-if="productMessage" class="add-device__inline-message">{{ productMessage }}</p>

    <section v-if="showProductSelector" class="add-device__type-card">
      <a-form-item
        class="add-device__field add-device__field--compact"
        :label="$t('IotDeviceList.add.product')"
        required
      >
        <a-select
          :value="selectedProductKey || undefined"
          class="add-device__type-select"
          show-search
          allow-clear
          :loading="productLoading"
          option-filter-prop="label"
          :options="productSelectOptions"
          :placeholder="$t('IotDeviceList.add.productPlaceholder')"
          @update:value="emit('select-product', String($event ?? ''))"
        />
      </a-form-item>
    </section>

    <div
      v-if="showProductSelector || showTemplateCreate"
      class="add-device__assist"
      :class="{ 'is-expanded': templateOpen && showTemplateCreate }"
    >
      <span class="add-device__assist-icon">
        <AIcon type="QuestionCircleOutlined" aria-hidden="true" />
      </span>
      <div class="add-device__assist-copy">
        <strong>{{ $t('IotDeviceList.add.noProductTitle') }}</strong>
        <span>{{ $t('IotDeviceList.add.noProductDesc') }}</span>
      </div>
      <div class="add-device__assist-actions">
        <a-button
          v-if="showTemplateCreate"
          size="small"
          :type="templateOpen ? 'primary' : 'default'"
          :ghost="templateOpen"
          class="add-device__assist-action"
          @click="emit('update:template-open', !templateOpen)"
        >
          <template #icon>
            <AIcon :type="templateOpen ? 'UpOutlined' : 'PlusOutlined'" aria-hidden="true" />
          </template>
          {{ templateOpen ? $t('IotDeviceList.add.collapseTemplateCreate') : $t('IotDeviceList.add.createProductFromTemplate') }}
        </a-button>
      </div>
    </div>

    <section v-if="templateOpen && showTemplateCreate" class="add-device__library" :aria-label="$t('IotDeviceList.add.createProductFromTemplate')">
      <div class="add-device__library-head">
        <div>
          <strong>{{ $t('IotDeviceList.add.createProductFromTemplate') }}</strong>
          <span>{{ $t('IotDeviceList.add.createProductFromTemplateDesc') }}</span>
        </div>
      </div>

      <div class="add-device__template-create">
        <a-form-item class="add-device__field add-device__field--compact" :label="$t('IotDeviceList.add.deviceTemplate')">
          <a-select
            :value="selectedTemplateKey || undefined"
            class="add-device__template-select"
            show-search
            allow-clear
            :loading="templateLoading"
            option-filter-prop="label"
            :options="templateSelectOptions"
            :placeholder="$t('IotDeviceList.add.templatePlaceholder')"
            @update:value="emit('select-template', String($event ?? ''))"
          />
        </a-form-item>
        <a-button type="primary" :disabled="!selectedTemplateKey" @click="emit('add-template', selectedTemplateKey)">
          <template #icon>
            <AIcon type="PlusOutlined" aria-hidden="true" />
          </template>
          {{ $t('IotDeviceList.add.createProduct') }}
        </a-button>
      </div>

      <p v-if="libraryMessage" class="add-device__inline-message">{{ libraryMessage }}</p>
      <p v-if="!templateLoading && !libraryProducts.length" class="add-device__empty">{{ $t('IotDeviceList.add.noTemplateForProduct') }}</p>

      <article v-if="selectedTemplate" class="add-device__template-preview">
        <strong>{{ selectedTemplate.name }}</strong>
        <span>{{ selectedTemplate.summary }}</span>
        <small>{{ selectedTemplate.accessName }} · {{ categoryLabel(selectedTemplate.category) }} · {{ selectedTemplate.supportedManufacturers.slice(0, 3).join(' / ') }}</small>
      </article>
    </section>

    <article v-if="selectedProduct" class="add-device__selected-product">
      <div>
        <strong>{{ selectedProduct.name }}</strong>
        <span>{{ selectedProduct.summary }}</span>
      </div>
      <small>
        <AIcon type="DisconnectOutlined" aria-hidden="true" />{{ selectedProduct.accessName }}
        <span>·</span>
        <AIcon type="TagOutlined" aria-hidden="true" />{{ categoryLabel(selectedProduct.category) }}
      </small>
    </article>

    <p v-else-if="showProductEmpty && !productLoading" class="add-device__empty">
      {{ $t('IotDeviceList.add.noSelectedProduct') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'

const props = defineProps({
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
  selectedProductOverride: { type: Object as PropType<IotDeviceProductTemplate | null>, default: null },
  showProductSelector: { type: Boolean, default: true },
  showTemplateCreate: { type: Boolean, default: true },
})

const showProductEmpty = computed(() => props.showProductSelector || props.showTemplateCreate)
const { t: $t } = useI18n()

const productSelectOptions = computed(() =>
  props.availableProducts.map((product) => ({
    label: product.name,
    value: product.id,
  })),
)

const templateSelectOptions = computed(() =>
  props.libraryProducts.map((product) => ({
    label: product.name,
    value: product.id,
  })),
)

const selectedProduct = computed(() =>
  props.selectedProductOverride
  ?? props.availableProducts.find((product) => product.id === props.selectedProductKey)
  ?? null,
)

const selectedTemplate = computed(() =>
  props.libraryProducts.find((product) => product.id === props.selectedTemplateKey) ?? null,
)

const emit = defineEmits<{
  (e: 'select-product', productId: string): void
  (e: 'select-template', templateId: string): void
  (e: 'update:template-open', value: boolean): void
  (e: 'add-template', productId: string): void
}>()

watch(
  () => props.open,
  (open) => {
    if (open && props.showProductSelector) emit('update:template-open', false)
  },
)
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
