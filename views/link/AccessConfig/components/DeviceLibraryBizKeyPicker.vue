<template>
  <a-form-item v-if="!isCompositeChild" name="bizKey" :label="label">
    <a-input
      class="biz-key-input"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="128"
      allow-clear
      @update:value="emit('update:modelValue', $event)"
    />
  </a-form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineProps({
  modelValue: { type: String, default: '' },
  provider: { type: String, required: true },
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const { t } = useI18n()
const route = useRoute()
const isCompositeChild = computed(() => Boolean(route.query.provider))

const label = computed(() => t('AccessConfig.bizKey.label'))
const placeholder = computed(() => t('AccessConfig.bizKey.placeholder'))

</script>

<style scoped lang="less">
.biz-key-input {
  width: 100%;
}
</style>
