<template>
  <section class="command-tab" :aria-label="$t('IotDeviceDetail.commands.aria')">
    <div class="command-layout">
      <aside class="command-sidebar" :aria-label="$t('IotDeviceDetail.commands.sidebarAria')">
        <header class="command-sidebar__head">
          <div>
            <AIcon type="SendOutlined" aria-hidden="true" />
            <strong>{{ $t('IotDeviceDetail.commandCenter.tab.function') }}</strong>
          </div>
          <span>{{ $t('IotDeviceDetail.common.itemCount', { count: commands.length }) }}</span>
        </header>

        <a-input
          v-model:value="keyword"
          class="command-search"
          :placeholder="$t('IotDeviceDetail.commands.searchPlaceholder')"
          allow-clear >
          <template #prefix>
            <AIcon type="SearchOutlined" aria-hidden="true" />
          </template>
        </a-input>


        <div v-if="filteredCommands.length" class="command-list">
          <div
            v-for="command in filteredCommands"
            :key="command.id"
            class="command-item"
            :class="{ 'is-active': command.id === selectedCommandId }"
            @click="selectCommand(command.id)">
            <span class="command-item__icon" :data-tone="categoryMeta(command.category).tone">
              <AIcon :type="categoryMeta(command.category).icon" aria-hidden="true" />
            </span>
            <span class="command-item__main">
              <strong>{{ command.name }}</strong>
              <em>{{ command.identifier }}</em>
            </span>
          </div>
        </div>

        <CloudEmpty v-else class="command-empty" :description="$t('IotDeviceDetail.commands.noMatch')" />
      </aside>

      <section class="command-config" :aria-label="$t('IotDeviceDetail.commands.configAria')">
        <template v-if="selectedCommand">
          <header class="command-config__head">
            <div>
              <span class="command-config__eyebrow">{{ categoryMeta(selectedCommand.category).label }}</span>
              <h3>{{ selectedCommand.name }}</h3>
              <p>{{ selectedCommand.description }}</p>
            </div>
          </header>

          <dl class="command-meta">
            <div class="command-meta__item">
              <dt>{{ $t('IotDeviceDetail.commands.meta.identifier') }}</dt>
              <dd>{{ selectedCommand.identifier }}</dd>
            </div>
            <div class="command-meta__item">
              <dt>{{ $t('IotDeviceDetail.commands.meta.callMode') }}</dt>
              <dd>{{ selectedCommand.callMode === 'async' ? $t('IotDeviceDetail.commands.callMode.async') : $t('IotDeviceDetail.commands.callMode.sync') }}</dd>
            </div>
            <div class="command-meta__item">
              <dt>{{ $t('IotDeviceDetail.commands.meta.output') }}</dt>
              <dd>{{ selectedCommand.outputDescription }}</dd>
            </div>
          </dl>

          <div class="command-params">
            <div class="command-params__head">
              <strong>{{ $t('IotDeviceDetail.commands.inputParams') }}</strong>
              <a-segmented
                v-if="selectedCommand.inputParams.length"
                v-model:value="inputMode"
                size="small"
                :options="[
                  { label: $t('IotDeviceDetail.commands.inputMode.form'), value: 'form' },
                  { label: 'JSON', value: 'json' },
                ]"
              />
              <span v-else>{{ $t('IotDeviceDetail.commands.noInputParams') }}</span>
            </div>

            <div v-if="selectedCommand.inputParams.length && inputMode === 'form'" class="param-table">
              <div class="param-row param-row--head">
                <span>{{ $t('IotDeviceDetail.commands.paramName') }}</span>
                <span>{{ $t('IotDeviceDetail.commands.paramType') }}</span>
                <span>{{ $t('IotDeviceDetail.commands.paramValue') }}</span>
              </div>
              <label v-for="param in selectedCommand.inputParams" :key="param.key" class="param-row">
                <span>
                  <strong>{{ param.name }}</strong>
                  <em>{{ param.key }}{{ param.required ? ` · ${$t('IotDeviceDetail.common.required')}` : '' }}</em>
                </span>
                <span>{{ paramTypeLabel(param.type) }}</span>
                <span>
                  <a-select
                    v-if="param.type === 'enum'"
                    class="command-param-control"
                    :value="selectParamValue(param.key)"
                    :options="param.options ?? []"
                    @change="(value) => setParamValue(param.key, value as string)"
                  />
                  <a-checkbox
                    v-else-if="param.type === 'boolean'"
                    :checked="Boolean(commandParams[param.key])"
                    @change="(event) => setParamValue(param.key, event.target.checked)"
                  >
                    {{ $t('IotDeviceDetail.common.enabled') }}
                  </a-checkbox>
                  <a-textarea
                    v-else-if="param.type === 'object' || param.type === 'array'"
                    class="command-param-control"
                    :value="jsonParamValue(param.key)"
                    :rows="3"
                    :placeholder="param.type === 'array' ? $t('IotDeviceDetail.commands.inputJsonPlaceholder') : $t('IotDeviceDetail.commands.inputObjectPlaceholder')"
                    @update:value="(value) => setParamValue(param.key, value)"
                  />
                  <a-input-number
                    v-else-if="param.type === 'number'"
                    class="command-param-control"
                    :value="Number(commandParams[param.key] ?? 0)"
                    :placeholder="param.placeholder"
                    @update:value="(value) => setParamValue(param.key, Number(value ?? 0))"
                  />
                  <a-input
                    v-else
                    class="command-param-control"
                    :value="textParamValue(param.key)"
                    :placeholder="param.placeholder"
                    @update:value="(value) => setParamValue(param.key, value)"
                  />
                  <small v-if="param.unit">{{ param.unit }}</small>
                </span>
              </label>
            </div>

            <div v-else-if="selectedCommand.inputParams.length && inputMode === 'json'" class="command-json-editor">
              <a-textarea
                v-model:value="commandJson"
                :rows="12"
                spellcheck="false"
                :placeholder="$t('IotDeviceDetail.commands.inputParamsPlaceholder')"
              />
            </div>

            <div v-else class="command-no-params">
              {{ $t('IotDeviceDetail.commands.noParamsHint') }}
            </div>
          </div>

          <div v-if="executeError" class="command-error">
            {{ executeError }}
          </div>

          <footer class="command-actions">
            <span>{{ $t('IotDeviceDetail.commands.executeHint') }}</span>
            <a-button @click="resetParams">{{ $t('IotDeviceDetail.common.clear') }}</a-button>
            <a-button
              type="primary"
              :disabled="!canExecute"
              @click="executeSelectedCommand"
            >
              <template #icon>
                <AIcon type="PlayCircleOutlined" aria-hidden="true" />
              </template>
              {{ busy ? $t('IotDeviceDetail.commands.executing') : $t('IotDeviceDetail.commands.execute') }}
            </a-button>
          </footer>
        </template>

        <CloudEmpty v-else class="empty-state">
          <template #description>
            <strong>{{ $t('IotDeviceDetail.commands.emptyTitle') }}</strong>
            <span>{{ $t('IotDeviceDetail.commands.emptyDescription') }}</span>
          </template>
        </CloudEmpty>
      </section>

      <aside class="command-result" :aria-label="$t('IotDeviceDetail.commands.resultAria')">
        <header class="command-result__head">
          <div>
            <AIcon type="LineChartOutlined" aria-hidden="true" />
            <strong>{{ $t('IotDeviceDetail.commands.resultTitle') }}</strong>
          </div>
          <span v-if="result" :data-tone="statusMeta(result.status).tone">
            {{ statusMeta(result.status).label }}
          </span>
        </header>

        <template v-if="result">
          <div class="result-summary" :data-tone="statusMeta(result.status).tone">
            <AIcon :type="statusMeta(result.status).icon" aria-hidden="true" />
            <div class="result-summary__main">
              <strong>{{ result.summary }}</strong>
              <span>{{ result.requestId }} · {{ result.duration }}</span>
            </div>
          </div>

          <ol class="result-steps">
            <li v-for="step in result.steps" :key="step.id" :data-status="step.status">
              <span />
              <div class="result-step__body">
                <strong>{{ step.title }}</strong>
                <em>{{ step.node }} · {{ step.happenedAt }}</em>
                <p>{{ step.content }}</p>
              </div>
            </li>
          </ol>

          <details class="payload-panel">
            <summary>{{ $t('IotDeviceDetail.commands.requestPayload') }}</summary>
            <pre>{{ result.requestPayload }}</pre>
          </details>
          <details class="payload-panel">
            <summary>{{ $t('IotDeviceDetail.commands.responsePayload') }}</summary>
            <pre>{{ result.responsePayload }}</pre>
          </details>
        </template>

        <CloudEmpty v-else class="command-result__empty">
          <template #description>
            <strong>{{ $t('IotDeviceDetail.commands.noResultTitle') }}</strong>
            <span>{{ $t('IotDeviceDetail.commands.noResultDescription') }}</span>
          </template>
        </CloudEmpty>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getIotDeviceCommandCategoryMeta,
  getIotDeviceCommandStatusMeta,
} from '../../hooks/useIotDeviceCommandMeta'
import type {

  IotDevice,
  IotDeviceCommandCategory,
  IotDeviceCommandDefinition,
  IotDeviceCommandExecution,
  IotDeviceCommandParamType,
} from '../../types'

type CategoryFilter = 'all' | IotDeviceCommandCategory

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  commands: {
    type: Array as PropType<IotDeviceCommandDefinition[]>,
    default: () => [],
  },
  result: {
    type: Object as PropType<IotDeviceCommandExecution | null>,
    default: null,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  execute: [commandId: string, params: Record<string, any>]
}>()

const { t: $t } = useI18n()
const keyword = ref('')
const activeCategory = ref<CategoryFilter>('all')
const selectedCommandId = ref('')
const commandParams = ref<Record<string, any>>({})
const inputMode = ref<'form' | 'json'>('form')
const commandJson = ref('{}')
const executeError = ref('')

const selectedCommand = computed(() => props.commands.find((item) => item.id === selectedCommandId.value) ?? props.commands[0])

const categoryOptions = computed(() => {
  const categories: CategoryFilter[] = ['all', 'control', 'security', 'query', 'maintenance']
  return categories.map((key) => ({
    key,
    label: key === 'all' ? $t('IotDeviceDetail.common.all') : categoryMeta(key).label,
    count: key === 'all' ? props.commands.length : props.commands.filter((item) => item.category === key).length,
  }))
})

const filteredCommands = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return props.commands.filter((command) => {
    const matchesCategory = activeCategory.value === 'all' || command.category === activeCategory.value
    const matchesKeyword = !value || [
      command.name,
      command.identifier,
      command.description,
    ].join(' ').toLowerCase().includes(value)
    return matchesCategory && matchesKeyword
  })
})

const canExecute = computed(() => {
  if (!selectedCommand.value) return false
  if (props.busy) return false
  return true
})

watch(
  () => props.commands,
  (commands) => {
    if (!commands.length) {
      selectedCommandId.value = ''
      commandParams.value = {}
      return
    }
    if (!commands.some((item) => item.id === selectedCommandId.value)) {
      selectedCommandId.value = commands[0].id
    }
  },
  { immediate: true },
)

watch(selectedCommand, () => {
  resetParams()
  inputMode.value = 'form'
  executeError.value = ''
})

function categoryMeta(value: IotDeviceCommandCategory | CategoryFilter) {
  return getIotDeviceCommandCategoryMeta(value)
}

function statusMeta(value: IotDeviceCommandExecution['status']) {
  return getIotDeviceCommandStatusMeta(value)
}

function selectCommand(commandId: string) {
  selectedCommandId.value = commandId
}

function setParamValue(key: string, value: any) {
  commandParams.value = {
    ...commandParams.value,
    [key]: value,
  }
  syncCommandJsonFromParams()
  executeError.value = ''
}

function selectParamValue(key: string): string | number | undefined {
  const value = commandParams.value[key]
  return typeof value === 'boolean' ? undefined : value
}

function textParamValue(key: string): string | number | undefined {
  const value = commandParams.value[key]
  return typeof value === 'boolean' ? String(value) : value
}

function jsonParamValue(key: string): string {
  const value = commandParams.value[key]
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value ?? '', null, 2)
  } catch {
    return String(value ?? '')
  }
}

function resetParams() {
  const command = selectedCommand.value
  if (!command) {
    commandParams.value = {}
    return
  }
  commandParams.value = Object.fromEntries(command.inputParams.map((param) => [param.key, param.defaultValue ?? defaultValueForParam(param)]))
  syncCommandJsonFromParams()
}

function defaultValueForParam(param: IotDeviceCommandDefinition['inputParams'][number]) {
  if (param.type === 'number') return 0
  if (param.type === 'boolean') return param.options?.[1]?.value ?? false
  if (param.type === 'enum') return param.options?.[0]?.value ?? ''
  if (param.type === 'array') return []
  if (param.type === 'object') return {}
  return ''
}

function syncCommandJsonFromParams() {
  const payload = buildParamsFromForm(false)
  commandJson.value = JSON.stringify(payload, null, 2)
}

function buildParamsFromForm(includeEmpty: boolean) {
  const payload: Record<string, any> = {}
  for (const param of selectedCommand.value?.inputParams ?? []) {
    const raw = commandParams.value[param.key]
    if (!includeEmpty && (raw === undefined || raw === null || raw === '')) continue
    if ((param.type === 'object' || param.type === 'array') && typeof raw === 'string') {
      if (!raw.trim()) continue
      payload[param.key] = JSON.parse(raw)
    } else {
      payload[param.key] = raw
    }
  }
  return payload
}

function paramTypeLabel(type: IotDeviceCommandParamType) {
  const map: Record<IotDeviceCommandParamType, string> = {
    string: $t('IotDeviceDetail.commands.paramTypeText.string'),
    number: $t('IotDeviceDetail.commands.paramTypeText.number'),
    boolean: $t('IotDeviceDetail.commands.paramTypeText.boolean'),
    enum: $t('IotDeviceDetail.commands.paramTypeText.enum'),
    datetime: $t('IotDeviceDetail.commands.paramTypeText.datetime'),
    object: $t('IotDeviceDetail.commands.paramTypeText.object'),
    array: $t('IotDeviceDetail.commands.paramTypeText.array'),
  }
  return map[type]
}

function executeSelectedCommand() {
  const command = selectedCommand.value
  if (!command) return
  let payload: Record<string, any>
  try {
    payload = inputMode.value === 'json'
      ? JSON.parse(commandJson.value.trim() || '{}')
      : buildParamsFromForm(false)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('invalid')
    }
  } catch {
    executeError.value = inputMode.value === 'json'
      ? $t('IotDeviceDetail.commands.validation.jsonObject')
      : $t('IotDeviceDetail.commands.validation.objectOrArrayJson')
    return
  }

  if (inputMode.value === 'form') {
    const missing = command.inputParams.filter((param) => {
      if (!param.required) return false
      const value = payload[param.key]
      return value === undefined || value === null || value === ''
    })
    if (missing.length) {
      executeError.value = $t('IotDeviceDetail.commands.validation.requiredParams', { names: missing.map((param) => param.name).join('、') })
      return
    }
  }
  emit('execute', command.id, payload)
}
</script>

<style scoped>
.command-tab {
  min-width: 0;
}

.command-layout {
  display: grid;
  grid-template-columns: minmax(13.75rem, 17.5rem) minmax(22.5rem, 1fr) minmax(18.75rem, 26.25rem);
  min-height: 35rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  overflow: hidden;
}

.command-sidebar,
.command-config,
.command-result {
  min-width: 0;
  background: var(--jet-theme-bg-container);
}

.command-sidebar,
.command-result {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  padding: 0.875rem;
}

.command-sidebar {
  border-right: 0.0625rem solid var(--jet-theme-border);
}

.command-result {
  border-left: 0.0625rem solid var(--jet-theme-border);
  background: var(--jet-theme-primary-soft);
}

.command-sidebar__head,
.command-result__head,
.command-params__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.command-sidebar__head div,
.command-result__head div {
  display: inline-flex;
  align-items: center;
  gap: 0.4375rem;
  color: var(--jet-theme-text);
}

.command-sidebar__head span,
.command-result__head span,
.command-params__head span {
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
}

.command-result__head span[data-tone='ok'] { color: var(--jet-theme-success); }
.command-result__head span[data-tone='warn'] { color: var(--jet-theme-warning); }
.command-result__head span[data-tone='err'] { color: var(--jet-theme-error); }

.command-sidebar__head :deep(svg),
.command-result__head :deep(svg) {
  width: 0.9375rem;
  height: 0.9375rem;
  color: var(--jet-theme-primary);
}

.command-search {
  min-width: 0;
}

.command-search :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-text-disabled);
}

.command-param-control {
  width: 100%;
}

.command-json-editor {
  padding: 0.75rem;
}

.command-json-editor :deep(textarea),
.param-row :deep(textarea) {

  font-size: var(--fs-14);
}

.command-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.command-categories button {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  min-height: 1.75rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-disabled);
  font: inherit;
  font-size: var(--fs-14);
  cursor: pointer;
}

.command-categories button.is-active {
  border-color: var(--jet-theme-primary);
  color: var(--jet-theme-text);
  background: var(--jet-theme-primary-soft);
}

.command-categories span { }

.command-list {
  display: grid;
  gap: var(--space-2);
}

.command-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5625rem;
  align-items: center;
  width: 100%;
  min-height: 3.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  padding: var(--space-2);
  background: var(--jet-theme-bg-container);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.command-item:hover,
.command-item.is-active {
  border-color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
}

.command-item:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.command-item__icon {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
}

.command-item__icon[data-tone='ok'] { color: var(--jet-theme-success); }
.command-item__icon[data-tone='warn'] { color: var(--jet-theme-warning); }
.command-item__icon[data-tone='err'] { color: var(--jet-theme-error); }

.command-item__icon :deep(svg) {
  width: 0.9375rem;
  height: 0.9375rem;
}

.command-item__main {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.command-item__main strong,
.command-config__head h3,
.result-summary strong,
.result-steps strong {
  color: var(--jet-theme-text);
}

.command-item__main em {
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-config {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  padding: 1.125rem;
}

.command-config__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-4);
}

.command-config__head h3,
.command-config__head p {
  margin: 0;
}

.command-config__head h3 {
  margin-top: 0.1875rem;
  font-size: var(--fs-h3);
}

.command-config__head p {
  margin-top: 0.375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-body);
  line-height: 1.6;
}

.command-config__eyebrow {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.command-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
}

.command-meta__item {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-right: 0.0625rem solid var(--jet-theme-border);
}

.command-meta__item:last-child {
  border-right: 0;
}

.command-meta dt {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.command-meta dd {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-params {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
}

.command-params__head {
  min-height: 2.625rem;
  padding: 0 0.75rem;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
  background: var(--jet-theme-primary-soft);
}

.param-table {
  display: grid;
}

.param-row {
  display: grid;
  grid-template-columns: minmax(8.75rem, 1fr) 5.75rem minmax(11.25rem, 1.2fr);
  gap: var(--space-3);
  align-items: center;
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-3);
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.param-row:last-child {
  border-bottom: 0;
}

.param-row--head {
  min-height: 2.25rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-weight: 600;
}

.param-row strong {
  display: block;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
}

.param-row em {
  display: block;
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
  font-style: normal;
}

.param-row small {
  display: inline-block;
  margin-top: 0.1875rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.command-no-params,
.command-empty,
.command-result__empty {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.command-no-params {
  padding: 1.125rem 0.75rem;
}

.command-confirm,
.command-error {
  display: flex;
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2) var(--space-3);
  border: 0.0625rem solid color-mix(in srgb, var(--jet-theme-warning) 42%, var(--jet-theme-border));
  border-radius: var(--jet-theme-radius);
  background: color-mix(in srgb, var(--jet-theme-warning) 8%, var(--jet-theme-bg-container));
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.command-error {
  border-color: color-mix(in srgb, var(--jet-theme-error) 42%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-error) 8%, var(--jet-theme-bg-container));
  color: var(--jet-theme-error);
}

.command-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: 0.125rem;
}

.command-actions span {
  margin-right: auto;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.result-summary {
  display: flex;
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-3);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.result-summary[data-tone='ok'] { border-color: color-mix(in srgb, var(--jet-theme-success) 35%, var(--jet-theme-border)); }
.result-summary[data-tone='warn'] { border-color: color-mix(in srgb, var(--jet-theme-warning) 35%, var(--jet-theme-border)); }
.result-summary[data-tone='err'] { border-color: color-mix(in srgb, var(--jet-theme-error) 35%, var(--jet-theme-border)); }

.result-summary :deep(svg) {
  width: 1.0625rem;
  height: 1.0625rem;
}

.result-summary[data-tone='ok'] :deep(svg) { color: var(--jet-theme-success); }
.result-summary[data-tone='warn'] :deep(svg) { color: var(--jet-theme-warning); }
.result-summary[data-tone='err'] :deep(svg) { color: var(--jet-theme-error); }

.result-summary__main {
  display: grid;
  gap: var(--space-1);
}

.result-summary span {
  color: var(--jet-theme-text-disabled); font-size: var(--fs-14);
}

.result-steps {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-steps li {
  display: grid;
  grid-template-columns: 0.875rem minmax(0, 1fr);
  gap: 0.5625rem;
  padding: 0.625rem 0;
}

.result-steps li > span {
  width: 0.5625rem;
  height: 0.5625rem;
  margin-top: 0.3125rem;
  border-radius: 62.4375rem;
  background: var(--jet-theme-border-secondary);
}

.result-steps li[data-status='success'] > span { background: var(--jet-theme-success); }
.result-steps li[data-status='waiting'] > span { background: var(--jet-theme-warning); }
.result-steps li[data-status='failed'] > span { background: var(--jet-theme-error); }

.result-step__body {
  display: grid;
  gap: 0.1875rem;
  min-width: 0;
}

.result-steps em {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.result-steps p {
  margin: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.55;
}

.payload-panel {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  overflow: hidden;
}

.payload-panel summary {
  padding: 0.5625rem 0.625rem;
  color: var(--jet-theme-text-secondary);
  cursor: pointer;
}

.payload-panel pre {
  margin: 0;
  padding: 0.625rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  color: var(--jet-theme-text-secondary); font-size: var(--fs-14);
  white-space: pre-wrap;
}

.command-result__empty {
  display: grid;
  justify-items: center;
  gap: 0.4375rem;
  padding: 3.625rem 1.375rem;
  text-align: center;
}

.command-result__empty :deep(svg) {
  width: 1.625rem;
  height: 1.625rem;
  color: var(--jet-theme-text-disabled);
}

.command-result__empty strong {
  color: var(--jet-theme-text-secondary);
}

.command-result__empty p {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  line-height: 1.6;
}

@media (max-width: 73.75rem) {
  .command-layout {
    grid-template-columns: minmax(13.75rem, 17.5rem) minmax(0, 1fr);
  }

  .command-result {
    grid-column: 1 / -1;
    border-top: 0.0625rem solid var(--jet-theme-border);
    border-left: 0;
  }
}

@media (max-width: 47.5rem) {
  .command-layout,
  .command-meta,
  .param-row {
    grid-template-columns: 1fr;
  }

  .command-sidebar {
    border-right: 0;
    border-bottom: 0.0625rem solid var(--jet-theme-border);
  }

  .command-config__head {
    display: grid;
  }

  .command-meta div {
    border-right: 0;
    border-bottom: 0.0625rem solid var(--jet-theme-border);
  }

  .command-meta div:last-child {
    border-bottom: 0;
  }
}</style>
