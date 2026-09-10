<template>
  <section class="product-summary">
    <a-button class="product-summary__back" type="text" @click="emit('back')">
      <template #icon><AIcon type="LeftOutlined" /></template>
      {{ $t('IotDeviceDetail.common.back') }}
    </a-button>
    <div class="product-summary__icon">
      <a-avatar :size="52" shape="square" :src="product.photoUrl">
        <AIcon type="AppstoreOutlined" />
      </a-avatar>
    </div>
    <div class="product-summary__main">
      <div class="product-summary__headline">
        <a-tooltip :title="name">
          <h1>{{ name }}</h1>
        </a-tooltip>
        <IotDeviceStatusPill
          :label="product.state === 1 ? $t('Detail.index.478940-2') : $t('Detail.index.478940-3')"
          :tone="product.state === 1 ? 'ok' : 'muted'"
        />
      </div>
      <div class="product-summary__details">
        <div class="product-summary__line">
          <div class="product-summary__row product-summary__row--id">
            <span class="product-summary__label">{{ $t('Product.detail.id') }}</span>
            <span class="product-summary__id-content">
              <a-tooltip :title="product.id">
                <span class="product-summary__value">{{ product.id || '--' }}</span>
              </a-tooltip>
              <a-tooltip :title="$t('IotDeviceDetail.accessConfig.copy')">
                <a-button type="text" size="small" class="product-summary__copy" @click="copyProductId">
                  <AIcon type="CopyOutlined" />
                </a-button>
              </a-tooltip>
            </span>
          </div>
          <div class="product-summary__row">
            <span class="product-summary__label">{{ $t('BasicInfo.indev.028379-1') }}</span>
            <a-tooltip :title="classification || '--'">
              <span class="product-summary__value">{{ classification || '--' }}</span>
            </a-tooltip>
          </div>
          <div class="product-summary__row">
            <span class="product-summary__label">{{ $t('Product.index.660348-4') }}</span>
            <a-tooltip :title="deviceType || '--'">
              <span class="product-summary__value">{{ deviceType || '--' }}</span>
            </a-tooltip>
          </div>
        </div>
        <div class="product-summary__line">
          <div class="product-summary__row">
            <span class="product-summary__label">{{ $t('Detail.index.478940-5') }}</span>
            <button type="button" class="product-summary__value product-summary__count" @click="emit('view-devices')">
              {{ product.count || 0 }}
            </button>
          </div>
          <div class="product-summary__row">
            <span class="product-summary__label">{{ $t('Product.detail.brand') }}</span>
            <a-tooltip :title="manufacturer || '--'">
              <span class="product-summary__value">{{ manufacturer || '--' }}</span>
            </a-tooltip>
          </div>
          <div class="product-summary__row">
            <span class="product-summary__label">{{ $t('Product.detail.model') }}</span>
            <a-tooltip :title="model || '--'">
              <span class="product-summary__value">{{ model || '--' }}</span>
            </a-tooltip>
          </div>
        </div>
      </div>
    </div>
    <div class="product-summary__actions">
      <j-permission-button v-if="canUpdate" type="default" :hasPermission="canUpdate" @click="emit('edit')">
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('Product.index.660348-13') }}
      </j-permission-button>
      <j-permission-button
        type="primary"
        :hasPermission="canAction"
        :popConfirm="{ title: product.state === 1 ? $t('Detail.index.478940-0') : $t('Detail.index.478940-1'), onConfirm: () => emit('toggle-state') }"
      >
        {{ product.state === 1 ? $t('Detail.index.478940-3') : $t('Product.index.660348-16') }}
      </j-permission-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useClipboard from 'vue-clipboard3'
import type { ProductItem } from '../../typings'
import { getI18nText } from '../../../../../utils/i18n'
import IotDeviceStatusPill from '../../../list/components/IotDeviceStatusPill.vue'

const props = defineProps<{ product: Partial<ProductItem>; canUpdate: boolean; canAction: boolean }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'edit'): void; (e: 'toggle-state'): void; (e: 'view-devices'): void }>()
const { t: $t } = useI18n()
const { toClipboard } = useClipboard()
const name = computed(() => getI18nText(props.product, 'name') || props.product.id || '-')
const classification = computed(() => getI18nText(props.product, 'classifiedName'))
const deviceType = computed(() => props.product.deviceType?.text || '')
const manufacturer = computed(() => getI18nText(props.product, 'manufacturer'))
const model = computed(() => getI18nText(props.product, 'model'))
function copyProductId() {
  if (props.product.id) {
    return toClipboard(props.product.id)
  }
}
</script>

<style scoped lang="less">
.product-summary { display:grid; grid-template-columns:auto minmax(0, 1fr) auto; gap:var(--space-3); align-items:center; min-height:5rem; margin-bottom:0.875rem; padding:var(--space-3) var(--space-4); border:0.0625rem solid var(--jet-theme-border-secondary); border-radius:var(--r-6); background:var(--bg-trans-8); }
.product-summary__back.ant-btn { grid-column:1 / -1; justify-self:start; height:auto; padding:0; color:var(--jet-theme-text-secondary); }
.product-summary__back.ant-btn:hover, .product-summary__back.ant-btn:focus { color:var(--jet-theme-primary); background:transparent; }
.product-summary__icon { display:grid; place-items:center; width:3.25rem; height:3.25rem; overflow:hidden; border-radius:0.75rem; background:var(--jet-theme-primary-soft); color:var(--jet-theme-primary); }
.product-summary__icon :deep(.ant-avatar) { display:grid; place-items:center; width:100% !important; height:100% !important; border-radius:inherit; background:transparent; color:inherit; }
.product-summary__icon :deep(svg) { width:1.625rem; height:1.625rem; }
.product-summary__icon :deep(img) { width:100%; height:100%; object-fit:cover; border-radius:inherit; }
.product-summary__main, .product-summary__details { display:grid; min-width:0; }
.product-summary__main { gap:var(--space-2); }
.product-summary__headline { display:flex; align-items:center; gap:var(--space-2); min-width:0; overflow:hidden; }
.product-summary__headline :deep(.ant-tooltip-open) { min-width:0; }
.product-summary__headline h1 { min-width:0; margin:0; overflow:hidden; color:var(--jet-theme-text); font-size:var(--fs-18); font-weight:700; line-height:1.3; text-overflow:ellipsis; white-space:nowrap; }
.product-summary__details { gap:var(--space-1); }
.product-summary__line { display:grid; grid-template-columns:minmax(0, 16rem) minmax(0, 16rem) minmax(0, 24rem); align-items:center; justify-content:start; min-width:0; column-gap:var(--space-3); row-gap:var(--space-1); }
.product-summary__row { display:inline-flex; align-items:center; width:100%; min-width:0; line-height:1.6; }
.product-summary__label { flex:0 0 3.75rem; margin-right:var(--space-2); color:var(--jet-theme-text-disabled); font-size:var(--fs-14); font-weight:400; text-align:left; }
.product-summary__value { display:inline-block; flex:1 1 auto; max-width:100%; min-width:0; overflow:hidden; color:var(--jet-theme-text-secondary); font-size:var(--fs-14); font-weight:400; text-overflow:ellipsis; vertical-align:bottom; white-space:nowrap; }
.product-summary__id-content { display:flex; flex:1 1 auto; align-items:center; min-width:0; }
.product-summary__copy { flex:0 0 auto; margin-left:0.125rem; color:var(--jet-theme-text-secondary); }
.product-summary__count { border:0; padding:0; background:transparent; color:var(--jet-theme-primary); cursor:pointer; text-align:left; }
.product-summary__actions { display:flex; flex:0 0 auto; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:var(--space-2); }
@media (max-width:64rem) { .product-summary { grid-template-columns:auto minmax(0, 1fr); } .product-summary__actions { grid-column:1 / -1; justify-content:flex-start; } }
@media (max-width:40rem) { .product-summary { grid-template-columns:minmax(0, 1fr); } .product-summary__icon { display:none; } .product-summary__line { grid-template-columns:minmax(0, 1fr); gap:var(--space-1); } .product-summary__value { max-width:100%; } .product-summary__label { flex-basis:3.75rem; text-align:left; } }
</style>
