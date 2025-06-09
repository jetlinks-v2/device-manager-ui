<template>
  <a-modal visible :title="$t('DataSubscriptions.Detail.index.697323-7')" :width="1200" @cancel="emits('close')">
    <h3>{{ $t('DataSubscriptions.Detail.index.697323-8') }}</h3>
    <TabsCard :options="options" v-model:active-key="activeKey" />
    <div class="config-content">
      <component :is="components[activeKey]" />
    </div>
  </a-modal>
</template>

<script setup>
import _Self from './_Self.vue'
import All from './All.vue'
import Org from './Org.vue'
import Product from './Product.vue'
import AlarmType from './AlarmType.vue'
import AlarmLevel from './AlarmLevel.vue'
import {subscriptionMode} from "@device/views/link/DataSubscriptions/Detail/data";
import {useI18n} from "vue-i18n";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emits = defineEmits(['close', 'save']);
const activeKey = ref('_Self')
const {t: $t} = useI18n();

const options = computed(() => {
  return subscriptionMode[props.data.type || "device"]
})

const components = {
  _Self,
  All,
  Org,
  Product,
  AlarmType,
  AlarmLevel,
}
</script>

<style lang="less" scoped>
.config-content {
  margin-top: 16px;
  display: flex;
  height: 450px;
  flex-direction: column;
}
</style>
