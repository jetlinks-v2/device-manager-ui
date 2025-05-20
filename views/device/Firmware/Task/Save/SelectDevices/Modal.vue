<template>
  <a-modal
      visible
      :title="$t('Save.SelectDevices.386303-1')"
      :ok-text="$t('Save.SelectDevices.386303-2')"
      :cancel-text="$t('Save.SelectDevices.386303-3')"
      :visible="true"
      width="80%"
      @cancel="handleCancel"
      @ok="handleOk"
  >
    <j-card-select :showImage="false" v-model:value="activeKey" :options="options" :column="3" />

    <div style="margin-top: 24px;">
      <Org v-if="activeKey === 'org'" :data="data" :product-id="productId" />
      <Table v-else :data="data" :product-id="productId" />
    </div>
  </a-modal>
</template>
<script setup name="SelectDevicesModal">
import { useI18n } from 'vue-i18n';
import Table from './Table.vue';
import Org from './Org.vue';

const { t: $t } = useI18n();
const emit = defineEmits(['save', 'close']);

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
const activeKey = ref('')

const options = [
  {
    label: '自定义',
    value: 'self',
  },
  {
    label: '全部',
    value: 'all',
  },
  {
    label: '按组织',
    value: 'org',
  }
]

const handleOk = () => {

};

const handleCancel = () => {

};
</script>
