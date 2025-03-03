<template>
  <div class="metrics-item-value">
    <PopoverModal
        v-model:visible="visible"
        :show-cancel="false"
        body-style="width: 300px"
        @ok="confirm"
    >
      <template #content>
        <a-form ref="formRef" :model="formData">
          <a-form-item v-if="range === false" :rules="[{ validator: typeValidator}]" name="value">
            <Item v-model:value="formData.value" :options="options" />
          </a-form-item>
          <div v-else class="data-table-boolean-item">
            <div class="data-table-boolean-item--value">
              <a-form-item :name="['rangeValue', 0]" :rules="[{ required: true, message: $t('Metrics.ValueItem.740699-0')}]">
                <Item v-model:value="formData.rangeValue[0]" />
              </a-form-item>
            </div>
            <div style="line-height: 32px">-</div>
            <div class="data-table-boolean-item--value">
              <a-form-item :name="['rangeValue', 1]" :rules="[{ required: true, message: $t('Metrics.ValueItem.740699-0')}, { validator: validator}]">
                <Item v-model:value="formData.rangeValue[1]" />
              </a-form-item>
            </div>
          </div>
        </a-form>
      </template>
      <a-button type="link" style="padding: 0">
        <template #icon>
          <AIcon type="SettingOutlined"/>
        </template>
        {{ $t('Metrics.ValueItem.740699-1') }}
      </a-button>
    </PopoverModal>
  </div>
</template>

<script setup lang="ts" name="MetricValueItems">
import { reactive } from 'vue';
import type { PropType } from 'vue';
import Item from './item.vue'
import {Form} from "ant-design-vue";
import { cloneDeep } from "lodash-es";
import { PopoverModal } from '../../../../../../../../components/Metadata';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

type ValueType = number | Array<number | undefined> | undefined;

type Emit = {
  (e: 'update:value', value: ValueType): void;
};

const props = defineProps({
  value: {
    type: Object as PropType<any>,
    default: undefined,
  },
  options: {
    type: Array,
    default: () => []
  },
  range: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits<Emit>();
const formItemContext = Form.useInjectFormItemContext();
const type = inject<string>('metricsType')

const visible = ref(false)

const formData = reactive<{
  value: ValueType;
  rangeValue: ValueType;
}>({
  value: props.range === false ? props.value : undefined,
  rangeValue: props.range === true
      ? cloneDeep(props.value) || [undefined, undefined]
      : [undefined, undefined],
});

const formRef = ref()

const showText = computed(() => {
  if (props.range === false) {
    switch (type) {
      case 'date':
        return props.value;
      case 'boolean':
        const _value = props.value
        const item = props.options.find(item => item.value === props.value)
        if (item) {
          return item.label
        }else if (_value) {
          return _value === 'true' ? $t('Metrics.ValueItem.740699-2') : $t('Metrics.ValueItem.740699-3')
        } else {
          return ''
        }
      default:
        return props.value
    }
  } else {
    return props.value?.[0] ? props.value.join('-') : ''
  }
})

const validatorTip = () =>{
  let tip = $t('Metrics.ValueItem.740699-4')
  if (['boolean', 'date'].includes(type!)) {
    tip = $t('Metrics.ValueItem.740699-5')
  }
  return $t('Metrics.ValueItem.740699-6', [tip])
}

const validator = (_: any, value: any) => {

  if (props.range && formData.rangeValue![0] >= formData.rangeValue![1]) {
    return Promise.reject($t('Metrics.ValueItem.740699-7'))
  }
  return Promise.resolve()
}

const typeValidator = (_: any, value: any) => {
  if (value === undefined || value === null) {
    return  Promise.reject(validatorTip())
  }
  if (type === 'string' && value?.length > 64) {
    return Promise.reject($t('Metrics.ValueItem.740699-8'))
  }
  return Promise.resolve()
}

const handleValueByType = (value: any, isRange: boolean = false) => {
  if (isRange) {
    return (value as number[]).map(item => {
      const itemStr = String(item)
      const index = String(item).indexOf('.')

      return index === -1 ? item : Number(itemStr.substring(0, index))
    })
  } else {
    const itemStr = String(value)
    const index = String(value).indexOf('.')
    return index === -1 ? value : Number(itemStr.substring(0, index))
  }
}

const confirm = () => {
  return new Promise((resolve, reject) => {
    formRef.value.validate().then((res) => {
      let value = props.range === true ? formData.rangeValue : formData.value

      if (['int', 'long'].includes(type)) {
        value = handleValueByType(value, props.range)
      }
      visible.value = false

      emit('update:value', value);
      formItemContext.onFieldChange()
      resolve(true)
    }).catch(() => {
      reject()
    })
  })

};

watch(() => props.range, (value, oldValue) => {
  if (value !== oldValue  ) {
    formData.rangeValue = value ? cloneDeep(props.value) || [undefined, undefined] : undefined
  }
}, { immediate: true})
</script>

<style scoped lang="less">
.metrics-item-value {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;

  .metrics-item-text {
    flex: 1;
  }
}

.data-table-boolean-item {
  display: flex;
  gap: 12px;
}
</style>
