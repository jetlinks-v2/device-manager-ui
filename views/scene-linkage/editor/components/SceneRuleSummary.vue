<template>
  <div v-if="showSnapshot" class="scene-rule-summary"><span class="scene-rule-summary__snapshot">{{ snapshot }}</span></div>
  <div v-else class="scene-rule-summary">
    <span v-if="triggerForms.length" class="scene-rule-summary__clause scene-rule-summary__clause--trigger">
      <span class="scene-rule-summary__keyword scene-rule-summary__keyword--trigger">{{ $t('IotSceneLinkage.rule.when') }}</span>
      <template v-for="(summary, index) in triggerSummaries" :key="index">
        <span class="scene-rule-summary__field scene-rule-summary__field--trigger">{{ summary }}</span>
        <span v-if="index < triggerSummaries.length - 1">{{ $t('IotSceneLinkage.rule.or') }}</span>
      </template>
    </span>
    <span v-for="(condition, index) in conditionSummaries" :key="index" class="scene-rule-summary__clause scene-rule-summary__clause--condition">
      <span class="scene-rule-summary__keyword scene-rule-summary__keyword--condition">{{ $t('IotSceneLinkage.rule.and') }}</span>
      <template v-if="condition.type === 'alarm'">
        <span class="scene-rule-summary__field scene-rule-summary__field--condition">{{ condition.target }}</span><span>{{ $t('IotSceneLinkage.alarmPhrase.ofAlarm') }}</span>
        <span class="scene-rule-summary__field scene-rule-summary__field--condition">{{ condition.alarm }}</span><span>{{ $t('IotSceneLinkage.alarmPhrase.currentState') }}</span>
        <span class="scene-rule-summary__field scene-rule-summary__field--condition">{{ condition.state }}</span>
      </template>
      <span v-else class="scene-rule-summary__field scene-rule-summary__field--condition">{{ condition.value }}</span>
    </span>
    <span class="scene-rule-summary__clause scene-rule-summary__clause--action">
      <span class="scene-rule-summary__keyword scene-rule-summary__keyword--action">{{ $t('IotSceneLinkage.summary.then') }}</span>
      <template v-for="(action, index) in actionSummaries" :key="index">
        <template v-if="action.type === 'notify'">
          <span class="scene-rule-summary__action-text">{{ $t('IotSceneLinkage.action.send') }}</span>
          <span class="scene-rule-summary__field scene-rule-summary__field--action">{{ action.channel }}</span>
          <span class="scene-rule-summary__action-text">{{ $t('IotSceneLinkage.action.to') }}</span>
          <span v-for="user in action.users" :key="user" class="scene-rule-summary__field scene-rule-summary__field--action">{{ user }}</span>
          <span v-if="action.hasMore" class="scene-rule-summary__action-text">{{ $t('IotSceneLinkage.summary.andMore') }}</span>
        </template>
        <span v-else class="scene-rule-summary__field scene-rule-summary__field--action">{{ action.value }}</span>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, queryDeviceAlarmPreprocesses } from '../../../../api/scene-linkage'
import type { SceneLinkageForm, SceneMultiTriggerForm, SceneTimeRange } from '../../utils'

const props = defineProps({ form: { type: Object as PropType<SceneLinkageForm>, required: true }, users: { type: Array as PropType<Array<{ id?: string; name?: string }>>, default: () => [] } })
const emit = defineEmits<{ (event: 'change', value: string): void }>()
const { t } = useI18n()
const products = ref<Record<string, any>>({})
const alarmNames = ref<Record<string, string>>({})
const snapshot = ref('')
const resolved = ref(false)
const showSnapshot = computed(() => Boolean(snapshot.value) && !resolved.value && !props.form.multiTriggers?.length)
const triggerForms = computed(() => props.form.multiTriggers?.length ? props.form.multiTriggers : [props.form])
const productIds = computed(() => [...new Set([
  ...triggerForms.value.flatMap(trigger => [trigger.productId, trigger.alarm.options?.productId]),
  props.form.alarm.options?.productId,
  ...props.form.additionalConditions.map((item: any) => item.productId || item.alarm?.options?.productId),
  ...props.form.actions.map(action => action.config?.productId),
].filter(Boolean) as string[])])
const productName = (id?: string) => id ? products.value[id]?.name || (id === props.form.productId ? props.form.productName : '') || id : ''
const propertyName = (productId: string | undefined, id: string | undefined) => products.value[productId || '']?.metadata?.properties?.find((item: any) => item.id === id)?.name || id || ''
const eventName = (productId: string | undefined, id: string | undefined) => products.value[productId || '']?.metadata?.events?.find((item: any) => item.id === id)?.name || id || ''
const functionName = (productId: string | undefined, id: string | undefined) => products.value[productId || '']?.metadata?.functions?.find((item: any) => item.id === id)?.name || id || ''
const alarmName = (alarm: any) => alarm.options?.alarmConfigName || alarmNames.value[alarm.alarmConfigId || ''] || alarm.alarmConfigId || ''
const timeRangeLabel = (range: SceneTimeRange) => {
  if (range.start === '09:00' && range.end === '18:00') return t('IotSceneLinkage.timeTemplate.workday')
  if (range.start === '20:00' && range.end === '08:00') return t('IotSceneLinkage.timeTemplate.evening')
  return `${t('IotSceneLinkage.timeTemplate.custom')} ${range.start}–${range.end}`
}
const triggerSummaryFor = (form: SceneMultiTriggerForm) => {
  if (form.triggerKind === 'property') return `${productName(form.productId)} ${propertyName(form.productId, form.propertyId)} ${t(`IotSceneLinkage.term.${form.termType}`)} ${form.termValue ?? ''}`
  if (form.triggerKind === 'event') return `${productName(form.productId)} ${t('IotSceneLinkage.summary.report')} ${eventName(form.productId, form.eventId)}`
  if (form.triggerKind === 'online' || form.triggerKind === 'offline') return `${productName(form.productId)} ${t(`IotSceneLinkage.summary.${form.triggerKind}`)}`
  if (form.triggerKind === 'state') {
    if (form.deviceState === 'any') return t('IotSceneLinkage.summary.stateAny', { product: productName(form.productId) })
    const state = t(`IotSceneLinkage.stateCondition.${form.deviceState}`)
    return form.deviceStateTriggerMode === 'sustained'
      ? t('IotSceneLinkage.summary.stateSustained', { product: productName(form.productId), state, time: form.deviceStateSustainedTime })
      : t('IotSceneLinkage.summary.state', { product: productName(form.productId), state })
  }
  if (form.triggerKind === 'repeat') {
    const repeatLabel = form.repeatMode === 'custom'
      ? t('IotSceneLinkage.summary.customTime')
      : t(`IotSceneLinkage.repeat.${form.repeatMode}`)
    return form.repeatTime ? `${repeatLabel} ${form.repeatTime}` : repeatLabel
  }
  if (form.triggerKind === 'date') return form.dateTime || ''
  if (form.triggerKind === 'interval') return t('IotSceneLinkage.summary.interval', { time: form.interval, unit: t(`IotSceneLinkage.unit.${form.intervalUnit}`) })
  if (form.triggerKind === 'alarm') {
    const state = form.alarm.modes?.[0] === 'relieve' ? 'normal' : 'warning'
    return `${productName(form.alarm.options?.productId)}${t('IotSceneLinkage.alarmPhrase.ofAlarm')}${alarmName(form.alarm)}${t('IotSceneLinkage.alarmPhrase.becomes')}${t(`IotSceneLinkage.alarmState.${state}`)}`
  }
  return form.triggerKind === 'manual' ? t('IotSceneLinkage.summary.manual') : form.triggerKind ? t(`IotSceneLinkage.trigger.${form.triggerKind}`) : ''
}
const triggerSummaries = computed(() => triggerForms.value.map(triggerSummaryFor).filter(Boolean))
const conditionSummaries = computed(() => props.form.additionalConditions.map((condition) => {
  if (condition.type === 'timeRange') return { type: 'text' as const, value: condition.ranges.map(timeRangeLabel).join('、') }
  if (condition.type === 'deviceProperty') return { type: 'text' as const, value: `${productName(condition.productId)} ${propertyName(condition.productId, condition.propertyId)} ${t(`IotSceneLinkage.term.${condition.termType}`)} ${condition.value}` }
  return { type: 'alarm' as const, target: productName(condition.alarm.options?.productId), alarm: alarmName(condition.alarm), state: t(`IotSceneLinkage.alarmState.${condition.alarm.state}`) }
}))
type ActionSummary = { type: 'notify'; channel: string; users: string[]; hasMore: boolean } | { type: 'text'; value: string }
const actionSummaries = computed<ActionSummary[]>(() => props.form.actions.map((action: any) => {
  if (action.type === 'delay') return { type: 'text', value: `${t('IotSceneLinkage.action.delay')} ${action.time} ${t(`IotSceneLinkage.unit.${action.unit}`)}` }
  if (action.type === 'sceneNotify') {
    const users = (action.config?.userIds || []).map((id: string) => props.users.find(user => user.id === id)?.name).filter(Boolean) as string[]
    return { type: 'notify', channel: action.options?.channelName || t('IotSceneLinkage.action.notify'), users: users.slice(0, 3), hasMore: users.length > 3 }
  }
  if (action.type === 'alarmCount') return { type: 'text', value: t('IotSceneLinkage.action.alarmCount') }
  const message = action.config?.message || {}; const id = message.messageType === 'INVOKE_FUNCTION' ? message.functionId : message.messageType === 'WRITE_PROPERTY' ? Object.keys(message.properties || {})[0] : message.properties?.[0]
  return { type: 'text', value: `${productName(action.config?.productId)} ${message.messageType === 'WRITE_PROPERTY' ? t('IotSceneLinkage.action.writeProperty') : message.messageType === 'INVOKE_FUNCTION' ? t('IotSceneLinkage.action.executeFunction') : t('IotSceneLinkage.action.readProperty')} ${message.messageType === 'INVOKE_FUNCTION' ? functionName(action.config?.productId, id) : propertyName(action.config?.productId, id)}` }
}))
const actionSummaryText = (action: ActionSummary) => action.type === 'notify'
  ? `${t('IotSceneLinkage.action.send')} ${action.channel} ${t('IotSceneLinkage.action.to')} ${action.users.join('、')}${action.hasMore ? t('IotSceneLinkage.summary.andMore') : ''}`
  : action.value
const conditionSummaryText = (condition: typeof conditionSummaries.value[number]) => condition.type === 'alarm' ? `${condition.target}${t('IotSceneLinkage.alarmPhrase.ofAlarm')}${condition.alarm}${t('IotSceneLinkage.alarmPhrase.currentState')}${condition.state}` : condition.value
const summaryText = computed(() => [
  triggerSummaries.value.length ? `${t('IotSceneLinkage.rule.when')} ${triggerSummaries.value.join(` ${t('IotSceneLinkage.rule.or')} `)}` : '',
  conditionSummaries.value.length ? `${t('IotSceneLinkage.rule.and')} ${conditionSummaries.value.map(conditionSummaryText).join(`，${t('IotSceneLinkage.rule.and')} `)}` : '',
  `${t('IotSceneLinkage.summary.then')} ${actionSummaries.value.map(actionSummaryText).join('，')}`,
].filter(Boolean).join('，'))
watch(() => props.form.summary, value => { if (value && !snapshot.value) { snapshot.value = value; resolved.value = false } }, { immediate: true })
watch(productIds, async ids => { const unloaded = ids.filter(id => !products.value[id]); if (unloaded.length) { const values = await Promise.all(unloaded.map(async id => { const response: any = await getProduct(id); const product = response?.result ?? response; return [id, { ...product, metadata: typeof product?.metadata === 'string' ? JSON.parse(product.metadata) : product?.metadata || {} }] })); products.value = { ...products.value, ...Object.fromEntries(values) } }; resolved.value = true }, { immediate: true })
watch(() => [...triggerForms.value.map(trigger => trigger.alarm.alarmConfigId), props.form.alarm.alarmConfigId, ...props.form.additionalConditions.filter((item: any) => item.type === 'alarmState').map((item: any) => item.alarm.alarmConfigId)].filter(Boolean), async ids => { const missing = ids.filter(id => !alarmNames.value[id]); if (!missing.length) return; const result: any = await queryDeviceAlarmPreprocesses({ pageIndex: 0, pageSize: 100, terms: [{ column: 'id', termType: 'in', value: missing }] }); const rows = result?.result?.data || result?.data || []; alarmNames.value = { ...alarmNames.value, ...Object.fromEntries(rows.map((item: any) => [item.id, item.name || item.id])) } }, { immediate: true })
watch(summaryText, value => { if (resolved.value || props.form.multiTriggers?.length) emit('change', value) }, { immediate: true })
</script>

<style scoped>
.scene-rule-summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; line-height: 28px; }.scene-rule-summary__clause { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 0 8px; border-radius: 4px; }.scene-rule-summary__clause--trigger { color: #d46b08; background: #fff7e6; }.scene-rule-summary__clause--condition { color: #087443; background: #f0fff7; }.scene-rule-summary__clause--action { color: var(--ant-color-primary); background: #eef4ff; }.scene-rule-summary__clause :deep(.scene-rule-summary__field) { padding: 0; color: inherit; background: transparent; }
.scene-rule-summary__keyword { font-weight: 600; }.scene-rule-summary__keyword--trigger { color: #d46b08; }.scene-rule-summary__keyword--condition { color: #087443; }.scene-rule-summary__keyword--action { color: var(--ant-color-primary); }
.scene-rule-summary__field { padding: 0 8px; border-radius: 4px; }.scene-rule-summary__field--trigger { color: #ad6800; background: #fff7e6; }.scene-rule-summary__field--condition { color: #087443; background: #f0fff7; }.scene-rule-summary__field--action { color: var(--ant-color-primary); background: #eef4ff; }
.scene-rule-summary__action-text { color: var(--ant-color-primary); font-weight: 600; }
.scene-rule-summary__snapshot { color: var(--ant-color-text); }
</style>
