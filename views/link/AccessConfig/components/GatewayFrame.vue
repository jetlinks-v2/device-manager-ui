<template>
  <div class="gateway-frame">
    <div v-if="plain" class="gateway-frame__plain"><slot /></div>
    <EqualHeightColumns v-else class="gateway-frame__layout" left-width="10.5rem" gap="var(--space-4)" :collapsible="false">
      <template #left>
        <nav class="gateway-frame__navigation" :aria-label="t('GatewayEditor.steps')">
          <button v-for="(step, index) in navigation" :key="step.id" type="button"
            class="gateway-frame__step" :class="{ 'is-active': active === step.id }"
            :aria-current="active === step.id ? 'step' : undefined" @click="select(step.id)">
            <span class="gateway-frame__number" :class="{ 'is-complete': step.complete && active !== step.id }">
              <AIcon v-if="step.complete && active !== step.id" type="CheckOutlined" /><template v-else>{{ index + 1 }}</template>
            </span><span>{{ step.title }}</span>
          </button>
        </nav>
      </template>
      <template #right>
        <EqualHeightColumns class="gateway-frame__panes" left-width="1fr" right-width="20.5rem" gap="var(--space-4)" :collapsible="false">
          <template #left>
            <main class="gateway-frame__content">
              <div v-if="hint" class="gateway-frame__hint">{{ hint }}</div>
              <slot />
            </main>
          </template>
          <template #right>
            <GatewayOverview :steps="overview" @select="select">
              <template v-for="step in overview" :key="step.id" #[`detail-${step.id}`]>
                <slot :name="`detail-${step.id}`" />
              </template>
              <slot name="summary" />
            </GatewayOverview>
          </template>
        </EqualHeightColumns>
      </template>
    </EqualHeightColumns>
    <Teleport v-if="footerHost" :to="footerHost">
      <div class="gateway-frame__actions">
        <a-button v-if="context?.canReselect.value && !plain" type="text" class="gateway-frame__reselect" @click="context.reselect">
          <template #icon><AIcon type="RollbackOutlined" /></template>{{ t('GatewayEditor.reselect') }}
        </a-button>
        <a-space class="gateway-frame__buttons">
          <a-button @click="context?.cancel">{{ t('GatewayEditor.cancel') }}</a-button>
          <slot name="actions" />
        </a-space>
      </div>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import GatewayOverview from './GatewayOverview.vue'
import { gatewayEditorKey, gatewayFooterHostKey } from './gatewayEditorContext'
import { basicGatewayStep, type GatewayBasicForm, type GatewayStep, type GatewayWizard } from './useGatewayWizard'
const props = withDefaults(defineProps<{
  provider?: { id?: string; name?: string; description?: string }
  form?: GatewayBasicForm
  wizard?: GatewayWizard
  steps?: string[]
  plain?: boolean
  current?: number
  protocol?: { name?: string; description?: string } | null
  network?: unknown
  transport?: string
}>(), { current: 0 })
const emit = defineEmits<{ previous: []; select: [id: number] }>()
const { t } = useI18n()
const context = inject(gatewayEditorKey, undefined)
const footerHost = inject(gatewayFooterHostKey, undefined)
const navigation = computed<GatewayStep[]>(() => props.wizard?.steps.value.filter(step => !step.builtin) || (props.steps?.length
  ? props.steps.map((title, id) => ({ id, title, complete: id < props.current }))
  : [basicGatewayStep(t, props.form || {}, 0)]))
const active = computed(() => props.wizard?.current.value ?? props.current)
const hint = computed(() => navigation.value.find(step => step.id === active.value)?.hint
  || (navigation.value.length === 1 ? t('GatewayEditor.basicHint') : ''))
const overview = computed<GatewayStep[]>(() => {
  const sections = props.wizard?.steps.value || [basicGatewayStep(t, props.form || {}, props.steps ? 1 : 0)]
  if (!props.wizard && props.protocol) return [...sections, {
    id: -1, title: t('GatewayEditor.protocol'), complete: true, builtin: true,
    rows: [{ label: t('GatewayEditor.protocolName'), value: props.protocol.name },
      { label: t('GatewayEditor.description'), value: props.protocol.description || props.provider?.description, block: true }],
  }]
  return sections
})
const select = (id: number) => {
  if (props.wizard) props.wizard.select(id)
  else emit('select', id)
}
</script>
<style scoped lang="less" src="./gatewayFrame.less"></style>
