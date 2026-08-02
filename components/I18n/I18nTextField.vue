<template>
  <div v-if="!textarea" class="i18n-input-field">
    <a-input
      v-bind="$attrs"
      :value="value"
      @update:value="emit('update:value', $event)"
    />
    <I18nInputTrigger class="i18n-input-field__trigger" @configure="visible = true" />
  </div>
  <div v-else class="i18n-textarea-field">
    <a-textarea
      v-bind="$attrs"
      :value="value"
      @update:value="emit('update:value', $event)"
    />
    <I18nInputTrigger class="i18n-textarea-field__trigger" @configure="visible = true" />
  </div>
  <a-form-item-rest>
    <I18nTextDialog
      v-if="visible"
      :visible="visible"
      :title="dialogTitle"
      :data="fieldI18nMessages"
      :display-value="value"
      :max-length="i18nMaxLength"
      :textarea="textarea"
      @update:visible="visible = $event"
      @confirm="saveI18nMessages"
    />
  </a-form-item-rest>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import I18nInputTrigger from './I18nInputTrigger.vue'
import I18nTextDialog from './I18nTextDialog.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  value?: string
  i18nMessages?: Record<string, Record<string, string>>
  field: string
  label: string
  i18nMaxLength?: number
  textarea?: boolean
}>(), {
  value: '',
  i18nMessages: () => ({}),
  i18nMaxLength: 200,
  textarea: false,
})

const emit = defineEmits<{
  (e: 'update:value', value: string): void
  (e: 'update:i18nMessages', value: Record<string, Record<string, string>>): void
}>()

const { t } = useI18n()
const visible = ref(false)
const fieldI18nMessages = computed(() => props.i18nMessages?.[props.field] ?? {})
const dialogTitle = computed(() => `${t('I18n.configure')} - ${props.label}`)

function saveI18nMessages(messages: Record<string, string>) {
  emit('update:i18nMessages', {
    ...(props.i18nMessages ?? {}),
    [props.field]: messages,
  })
}
</script>

<style scoped lang="less">
.i18n-textarea-field {
  position: relative;
}

.i18n-input-field {
  position: relative;
}

.i18n-input-field__trigger {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  z-index: 1;
  transform: translateY(-50%);
}

.i18n-input-field :deep(.ant-input) {
  padding-right: var(--space-8);
}

.i18n-input-field :deep(.ant-input-clear-icon) {
  margin-right: var(--space-5);
}

.i18n-textarea-field__trigger {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.i18n-textarea-field :deep(.ant-input-textarea-show-count::after) {
  padding-right: var(--space-5);
}
</style>
