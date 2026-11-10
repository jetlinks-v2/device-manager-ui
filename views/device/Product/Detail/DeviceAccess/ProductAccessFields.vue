<template>
  <div v-for="(group, index) in groups" :key="index">
    <Title v-if="group.name" :data="group.name" class="config">
      <template #extra>
        <a-tooltip :title="$t('DeviceAccess.index.594346-11')">
          <AIcon type="QuestionCircleOutlined" style="margin-left: 2px" />
        </a-tooltip>
      </template>
    </Title>
    <a-form ref="forms" :model="modelValue" layout="vertical" :disabled="disabled">
      <a-form-item v-for="item in group.properties || []" :key="item.property"
        :name="item.property" :rules="getRules(item)">
        <template #label>
          {{ item.name }}
          <a-tooltip v-if="item.description" :title="item.description">
            <AIcon type="QuestionCircleOutlined" />
          </a-tooltip>
        </template>
        <j-value-item :itemType="item.type.type" :model-value="modelValue[item.property]"
          :disabled="disabled" :options="getOptions(item)"
          @update:modelValue="$emit('update:modelValue', { ...modelValue, [item.property]: $event })" />
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'
import type { FormInstance } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { ConfigMetadata, ConfigProperty } from '../../typings'
import Title from '../Title/index.vue'

defineProps({
  groups: { type: Array as PropType<ConfigMetadata[]>, default: () => [] },
  modelValue: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  disabled: Boolean,
})
defineEmits<{ (event: 'update:modelValue', value: Record<string, unknown>): void }>()
const { t } = useI18n()
const forms = ref<FormInstance[]>([])

/** 协议字段的枚举和布尔值沿用共享 ValueItem 的 options 契约。 */
function getOptions(item: ConfigProperty) {
  if (item.type.type === 'enum') return (item.type.elements || []).map(value => ({ label: value.text, value: value.value }))
  if (item.type.type === 'boolean') {
    const type = item.type as ConfigProperty['type'] & { falseText?: string; falseValue?: boolean; trueText?: string; trueValue?: boolean }
    return [{ label: type.falseText, value: type.falseValue }, { label: type.trueText, value: type.trueValue }]
  }
}

/** 普通网关和复合网关统一按协议定义校验必填项与长度。 */
function getRules(item: ConfigProperty) {
  const rules = []
  if (item.type.expands?.required) rules.push({ required: true, message: `${t(['enum', 'boolean'].includes(item.type.type) ? 'DeviceAccess.index.594346-12' : 'DeviceAccess.index.594346-13')}${item.name}` })
  if (item.type.expands?.maxLength) rules.push({ max: item.type.expands.maxLength })
  return rules
}

/** 对父页面暴露该配置区所有表单的校验。 */
defineExpose({ validate: () => Promise.all(forms.value.map(form => form.validate())) })
</script>
