<template>
  <a-modal
    :mask-closable="false"
    :width="960"
    centered
    :open="true"
    :body-style="{ maxHeight: 'calc(100dvh - 11rem)', overflowY: 'auto' }"
    @ok="handleOk"
    @cancel="emit('close')"
  >
    <template #title>
      <IotAddDeviceModalTitle :title-text="$t('Export.index.225315-0')" help-text="" icon="ExportOutlined" />
    </template>
    <a-alert type="info" show-icon :message="$t('Export.index.225315-1')" />
    <div class="device-export-product">
      <div v-if="productId" class="device-export-product__label">
        <span>{{ selectedProductName }}</span>
        <a-button v-if="productId" type="link" @click="productId = ''">
          {{ $t('IotDeviceExport.clearProduct') }}
        </a-button>
      </div>
      <Product v-model:row-key="productId" :enabled-only="false" :show-hint="false" @change="selectedProductName = $event.name" />
    </div>
    <template #footer>
      <div class="device-export-footer">
        <div class="device-export-footer__format">
          <span id="device-export-format-label">{{ $t('Export.index.225315-4') }}</span>
          <a-radio-group v-model:value="fileType" aria-labelledby="device-export-format-label" button-style="solid">
            <a-radio-button value="xlsx">XLSX</a-radio-button>
            <a-radio-button value="csv">CSV</a-radio-button>
          </a-radio-group>
        </div>
        <a-space>
          <a-button @click="emit('close')">{{ $t('Import.modal.422832-2') }}</a-button>
          <a-button type="primary" @click="handleOk">{{ $t('Export.index.225315-0') }}</a-button>
        </a-space>
      </div>
    </template>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Product from '../Import/product.vue'
import IotAddDeviceModalTitle from '../../list/components/IotAddDeviceModalTitle.vue'
import { useDeviceExport } from './useDeviceExport'

const emit = defineEmits<{ (e: 'close'): void }>()
const props = defineProps<{ data?: Record<string, unknown> }>()
const { t: $t } = useI18n()
const productId = ref('')
const selectedProductName = ref('')
const fileType = ref<'xlsx' | 'csv'>('xlsx')
const { exportDevices } = useDeviceExport()

function handleOk() {
  exportDevices(productId.value, fileType.value, props.data)
  emit('close')
}
</script>

<style scoped>
.device-export-product {
  margin-block: var(--space-4);
}

.device-export-product__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2rem;
  margin-bottom: var(--space-2);
}

.device-export-product__label > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-export-footer,
.device-export-footer__format {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.device-export-footer {
  justify-content: space-between;
}

.device-export-footer__format {
  text-align: start;
}
</style>
