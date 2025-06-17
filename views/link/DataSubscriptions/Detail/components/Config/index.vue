<template>
  <a-modal
      visible
      :title="$t('DataSubscriptions.Detail.index.697323-7')"
      :width="1200"
      @cancel="emits('close')"
      @ok="handleOk"
      :confirm-loading="loading"
  >
    <h3>{{ $t('DataSubscriptions.Detail.index.697323-8') }}</h3>
    <TabsCard :options="options" v-model:active-key="activeKey" @change="onChange"/>
    <div class="config-content">
      <component :is="components[activeKey]" ref="componentRef" :value="_value"/>
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
import {subscriptionMode} from "@device/views/link/DataSubscriptions/data";
import {useI18n} from "vue-i18n";
import {modify} from "@/modules/device-manager-ui/api/link/dataSubscriptions";
import {onlyMessage} from "@jetlinks-web/utils";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  subscriptionMode: {
    type: String,
  },
  termsValue: {
    type: Array,
    default: () => []
  }
})
const emits = defineEmits(['close', 'save']);
const activeKey = ref(props.data.provider === 'device' ? '_Self' : 'All')
const {t: $t} = useI18n();
const componentRef = ref()
const loading = ref(false)
const _value = ref(props.termsValue)

const options = computed(() => {
  return subscriptionMode[props.data.provider || "device"]
})

const components = {
  _Self,
  All,
  Org,
  Product,
  AlarmType,
  AlarmLevel,
}

const handleOk = async () => {
  const resp = await componentRef.value?.onSave?.()
  if (resp) {
    loading.value = true
    const resp1 = await modify(props.data.id, {
      configuration: {
        ...props.data.configuration,
        terms: resp.terms,
        options: {
          ...props.data.configuration?.options,
          ...resp.options,
          subscriptionMode: activeKey.value,
        }
      }
    }).finally(() => {
      loading.value = false
    })
    if (resp1.success) {
      onlyMessage($t('Product.index.660348-18'))
      emits('save')
    }
  }
};

const onChange = () => {
  _value.value = []
}

watch(() => props.subscriptionMode, (val) => {
  activeKey.value = val || (props.data.provider === 'device' ? '_Self' : 'All')
}, {
  immediate: true,
})

watch(() => props.termsValue, (val) => {
  _value.value = val
}, {
  immediate: true,
  deep: true,
})
</script>

<style lang="less" scoped>
.config-content {
  margin-top: 16px;
  display: flex;
  height: 450px;
  flex-direction: column;
}
</style>
