<template>
  <div v-if="isEmpty" class="empty-box">
    <j-empty>
      <template #description>
        <div class="text">{{ $t('DataSubscriptions.Detail.index.697323-5') }}</div>
        <div class="desc">{{ $t('DataSubscriptions.Detail.index.697323-6') }}</div>
      </template>
      <a-button type="primary" @click="onConfig">{{ $t('DataSubscriptions.Detail.index.697323-7') }}</a-button>
    </j-empty>
  </div>
  <div v-else style="display: flex; flex-direction: column; height: 100%; gap: 16px; ">
    <div class="sub-content">
      <a-space>
        <AIcon style="color: #1677FF" type="InfoCircleFilled"/>
        <div style="color: #777777;">{{ $t('DataSubscriptions.Detail.index.697323-8') }}</div>
        <div>{{ _subscriptionMode?.label || '--' }}</div>
        <a-button type="link" @click="onConfig">{{ $t('DataSubscriptions.Detail.index.697323-9') }}</a-button>
      </a-space>
      <div>{{ description || '--' }}</div>
    </div>
    <div v-if="data.provider === 'device'" style="flex: 1; min-height: 0; display: flex; flex-direction: column">
      <SelectDevice :data="data"/>
    </div>
  </div>
  <Config
      v-if="visible"
      @close="visible = false"
      @save="onSave"
      :data="data"
      :subscriptionMode="_configuration.options?.subscriptionMode"
      :termsValue="termsValue"
  />
</template>

<script setup>
import Config from '../components/Config/index.vue';
import SelectDevice from './SelectDevice.vue'
import {useI18n} from "vue-i18n";
import {getSubscriptionModeDesc, subscriptionMode} from "@/modules/device-manager-ui/views/link/DataSubscriptions/data";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({provider: 'device'}),
  },
})
const emits = defineEmits(['refresh'])

const visible = ref(false)

const {t: $t} = useI18n();

const _configuration = computed(() => {
  return props.data.configuration || {}
})

const isEmpty = computed(() => {
  return !_configuration.value?.options?.subscriptionMode
})

const _subscriptionMode = computed(() => {
  return subscriptionMode[props.data.provider || "device"].find(item => item.value === _configuration.value.options?.subscriptionMode)
})

const termsValue = computed(() => {
  const _terms = _configuration.value.terms
  const _mode = _configuration.value.options?.subscriptionMode
  if (!!_mode) {
    if (['_Self', 'Product', 'AlarmType', 'AlarmLevel'].includes(_mode)) { // 自定义
      return _terms?.[0]?.value || []
    }
    if (_mode === 'Org') {
      return JSON.parse(_terms?.[0]?.value || '{}').targets?.[0]?.id || []
    }
  }
  return []
})

const description = computed(() => {
  return getSubscriptionModeDesc(props.data.provider, _subscriptionMode.value.value, _configuration.value?.options?.productName, termsValue.value.length)
})

const onSave = () => {
  visible.value = false
  emits('refresh')
}

const onConfig = () => {
  visible.value = true
}
</script>

<style lang="less" scoped>
.empty-box {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .text {
    font-size: 16px;
    color: #1A1A1A;
  }

  .desc {
    color: #777777;
    margin: 8px 0;
  }
}

.sub-content {
  border-radius: 6px;
  background: #F5F5F5;
  border: 1px solid #CCCCCC;
  padding: 8px 16px;
}
</style>
