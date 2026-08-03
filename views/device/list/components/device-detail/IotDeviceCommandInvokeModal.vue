<template>
  <a-modal
    :open="open"
    :confirm-loading="busy"
    :ok-text="$t('IotDeviceDetail.commandInvokeModal.okText')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    @update:open="emit('update:open', $event)"
    @ok="submitInvoke"
  >
    <template #title>
      <a-space>
        <div class="command-modal-title-icon">
          <AIcon type="CodeOutlined" />
        </div>
        <div class="command-modal-title">
          <span>{{ invokeTitle }}</span>
          <code v-if="command?.identifier" class="command-modal-title__identifier">{{ command.identifier }}</code>
        </div>
      </a-space>
    </template>
    <p v-if="command" class="invoke-summary">{{ command.description || $t('IotDeviceDetail.commandInvokeModal.summary') }}</p>
    <a-form v-if="command" layout="vertical" class="invoke-form">
      <a-form-item
        v-for="param in command.inputParams"
        :key="param.key"
        :extra="param.description || param.placeholder"
        :rules="{ required: param.required }"
      >
        <template #label>
          <span class="invoke-form-label">
            <span>{{ param.name }}</span>
            <code v-if="param.key" class="invoke-form-label__identifier">{{ param.key }}</code>
          </span>
        </template>
        <j-value-item
          v-model:modelValue="invokeForm[param.key]"
          :item-type="valueItemType(param)"
          :options="valueItemOptions(param)"
          :value-format="param.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : undefined"
          :placeholder="valueItemPlaceholder(param)"
          :extra-props="valueItemExtraProps(param)"
        />
      </a-form-item>
    </a-form>
    <CloudEmpty v-else :description="$t('IotDeviceDetail.commandInvokeModal.emptyHint')" />
    <div v-if="invokeError" class="invoke-error">{{ invokeError }}</div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IotDeviceCommandDefinition, IotDeviceCommandParam } from '../../types'

const props = defineProps<{
  open: boolean
  command: IotDeviceCommandDefinition | null
  busy: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  execute: [commandId: string, params: Record<string, any>]
}>()

const invokeError = ref('')
const invokeForm = reactive<Record<string, any>>({})
const { t: $t } = useI18n()
const invokeTitle = computed(() => props.command ? $t('IotDeviceDetail.commandInvokeModal.titleWithName', { name: props.command.name }) : $t('IotDeviceDetail.commandInvokeModal.title'))

watch(
  () => props.command,
  (command) => {
    Object.keys(invokeForm).forEach((key) => delete invokeForm[key])
    invokeError.value = ''
    command?.inputParams.forEach((param) => {
      invokeForm[param.key] = defaultValue(param)
    })
  },
)

function defaultValue(param: IotDeviceCommandParam) {
  if (param.defaultValue !== undefined) return param.defaultValue
  if (param.type === 'number') return 0
  if (param.type === 'boolean') return false
  if (param.type === 'enum') return param.options?.[0]?.value
  if (param.type === 'array') return '[]'
  if (param.type === 'object') return '{}'
  return ''
}

function valueItemType(param: IotDeviceCommandParam) {
  if (param.type === 'number') return 'double'
  if (param.type === 'datetime') return 'date'
  if (param.type === 'array') return 'object'
  return param.type
}

function valueItemOptions(param: IotDeviceCommandParam) {
  if (param.type === 'enum') return param.options ?? []
  if (param.type === 'boolean') return [
    { label: $t('IotDeviceDetail.common.yes'), value: true },
    { label: $t('IotDeviceDetail.common.no'), value: false },
  ]
  return undefined
}

function valueItemPlaceholder(param: IotDeviceCommandParam) {
  if (param.placeholder) return param.placeholder
  if (param.type === 'array') return $t('IotDeviceDetail.commands.inputJsonPlaceholder')
  if (param.type === 'object') return $t('IotDeviceDetail.commands.inputObjectPlaceholder')
  return undefined
}

function valueItemExtraProps(param: IotDeviceCommandParam) {
  return {
    style: { width: '100%' },
    ...(param.unit && param.type === 'number' ? { addonAfter: param.unit } : {}),
  }
}

function normalizePayload(command: IotDeviceCommandDefinition) {
  const out: Record<string, any> = {}
  command.inputParams.forEach((param) => {
    const value = invokeForm[param.key]
    if (param.required && (value === undefined || value === null || value === '')) throw new Error($t('IotDeviceDetail.commandInvokeModal.required', { name: param.name }))
    out[param.key] = (param.type === 'object' || param.type === 'array') && typeof value === 'string'
      ? JSON.parse(value || (param.type === 'array' ? '[]' : '{}'))
      : value
  })
  return out
}

function submitInvoke() {
  if (!props.command) return
  try {
    emit('execute', props.command.id, normalizePayload(props.command))
    emit('update:open', false)
  } catch (error) {
    invokeError.value = error instanceof Error ? error.message : $t('IotDeviceDetail.commandInvokeModal.invalidParams')
  }
}
</script>

<style scoped src="./IotDeviceCommandCenterTab.css"></style>
