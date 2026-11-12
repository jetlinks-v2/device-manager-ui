<template>
  <ContentPanel class="product-summary" fill>
    <DetailHeader variant="summary" :title="name">
      <template #icon><AIcon type="AppstoreOutlined" /></template>
      <template #titleExtra>
        <StatusTag :status="product.state === 1 ? 'success' : 'disabled'" :text="product.state === 1 ? $t('Detail.index.478940-2') : $t('Detail.index.478940-3')" />
        <AppTag :title="deviceType">{{ deviceType || $t('comm.table.empty') }}</AppTag>
      </template>
      <template #meta>
        <DetailMetaItem kind="id" :label="$t('Product.detail.id')" :tooltip="product.id ? $t('DetailMetaItem.copyTooltip', { id: product.id }) : undefined">
          <a-button type="text" class="product-summary__value" @click="copyProductId">{{ product.id || $t('comm.table.empty') }}<AIcon type="CopyOutlined" /></a-button>
        </DetailMetaItem>
        <DetailMetaItem kind="category" :label="$t('BasicInfo.indev.028379-1')" :value="classification || $t('comm.table.empty')" :tooltip="classification" />
        <DetailMetaItem kind="count" :label="$t('Detail.index.478940-5')">
          <j-permission-button v-if="canViewDevices && hasDevices" type="link" class="product-summary__value" :hasPermission="canViewDevices" @click="emit('view-devices')">
            {{ product.count || 0 }}
          </j-permission-button>
          <span v-else>{{ product.count || 0 }}</span>
        </DetailMetaItem>
        <DetailMetaItem kind="brand" :label="$t('Product.detail.brand')" :value="manufacturer || $t('comm.table.empty')" :tooltip="manufacturer" />
        <DetailMetaItem kind="model" :label="$t('Product.detail.model')" :value="model || $t('comm.table.empty')" :tooltip="model" />
      </template>
      <template #actions>
      <j-permission-button v-if="canUpdate" type="default" :hasPermission="canUpdate" @click="emit('edit')">
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('Product.index.660348-13') }}
      </j-permission-button>
      <j-permission-button
        v-if="canDelete"
        type="default"
        danger
        :hasPermission="canDelete"
        :disabled="product.state !== 0"
        :tooltip="{ title: product.state !== 0 ? $t('Product.index.660348-21') : $t('Product.index.660348-20') }"
        :popConfirm="{ title: $t('Product.index.660348-22'), onConfirm: () => emit('delete') }"
      >
        <template #icon><AIcon type="DeleteOutlined" /></template>
        {{ $t('Product.index.660348-20') }}
      </j-permission-button>
      <j-permission-button
        type="primary"
        :hasPermission="canAction"
        :popConfirm="{ title: product.state === 1 ? $t('Detail.index.478940-0') : $t('Detail.index.478940-1'), onConfirm: () => emit('toggle-state') }"
      >
        {{ product.state === 1 ? $t('Detail.index.478940-3') : $t('Product.index.660348-16') }}
      </j-permission-button>
      </template>
    </DetailHeader>
  </ContentPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useClipboard from 'vue-clipboard3'
import { onlyMessage } from '@jetlinks-web/utils'
import type { ProductItem } from '../../typings'
import { getI18nText } from '../../../../../utils/i18n'
import DetailHeader from '@jetlinks-web-core/components/DetailHeader/index.vue'
import DetailMetaItem from '@jetlinks-web-core/components/DetailMetaItem'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'

const props = defineProps<{ product: Partial<ProductItem>; canUpdate: boolean; canAction: boolean; canDelete: boolean; canViewDevices: boolean }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'edit'): void; (e: 'toggle-state'): void; (e: 'delete'): void; (e: 'view-devices'): void }>()
const { t: $t } = useI18n()
const { toClipboard } = useClipboard()
const name = computed(() => getI18nText(props.product, 'name') || props.product.id || '-')
const classification = computed(() => getI18nText(props.product, 'classifiedName'))
const deviceType = computed(() => props.product.deviceType?.text || '')
const manufacturer = computed(() => getI18nText(props.product, 'manufacturer'))
const model = computed(() => getI18nText(props.product, 'model'))
/** 设备数量为零时不提供无结果的设备列表跳转。 */
const hasDevices = computed(() => Number(props.product.count ?? 0) > 0)
/** 复制产品 ID，并与设备详情保持一致地反馈复制结果。 */
async function copyProductId() {
  if (!props.product.id) return
  await toClipboard(props.product.id)
  onlyMessage($t('IotDeviceDetail.accessDetail.copied'))
}
</script>

<style scoped>
.product-summary { margin-block: var(--space-4); }
.product-summary__value.ant-btn { max-width: 100%; height: auto; padding: 0; font-size: inherit; line-height: inherit; text-align: left; }
.product-summary__value.ant-btn :deep(> span:first-child) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
