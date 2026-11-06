import { defineComponent, h, watch, type Ref } from 'vue'
import type { MetricContext } from '@jetlinks-web-core/components'
import { useI18n } from 'vue-i18n'
import type { MetricInputMapping, MetricSourceDescription } from '@jetlinks-web-core/components'
import { loadMetricDevice, loadMetricProduct, loadMetricProductName, loadMetricOutput, loadMetricBuiltins } from '../../../api/metricSources'
import { localizedTemplate } from '@jetlinks-web-core/components/Metric/template/text'
import { metricOutputName } from '@jetlinks-web-core/components/Metric/presentation'
import { durationParts } from '@jetlinks-web-core/components/Metric/template/window'
import MetricSourceModal from './MetricSourceModal.vue'
import MetricSourceFields from './MetricSourceFields.vue'
import { useMetricSourcePicker } from './useMetricSourcePicker'
import { metricHostMessages } from './messages'

/** 公开来源适配：调用者仅消费 picker 与 host，不依赖设备模块私有弹窗状态。 */
export function useMetricSourceAdapter(context: Ref<MetricContext>) {
  const state = useMetricSourcePicker()
  const composer = useI18n({ useScope:'local' })
  // 宿主可能已创建 local composer；显式合并命名空间，避免后一次 useI18n 的消息被忽略。
  for (const [language, messages] of Object.entries(metricHostMessages)) {
    composer.mergeLocaleMessage(language, { metricSources:messages })
  }
  const t = (key:string, values:Record<string, unknown> = {}) => composer.t(`metricSources.${key}`, values)
  const { locale } = composer
  // 元数据与宿主重绘不撤销待选来源；只有对象身份变化才终止当前选择。
  watch([() => context.value.ownerType, () => context.value.ownerId], state.cancel)
  const host = defineComponent({ name: 'MetricDeviceSourceHost', setup: () => () => state.request.value?.inline ? null : h(MetricSourceModal, { state }) })
  const editor = defineComponent({ name:'MetricDeviceSourceEditor', setup:() => () => h(MetricSourceFields, { state, inline:true }) })
  /** 一次编辑按对象去重取元数据；失败逐输入反馈，不复用其他会话的授权结果。 */
  async function describe(owner:MetricContext, mappings:Record<string, MetricInputMapping>) {
    const reads = new Map<string, ReturnType<typeof loadMetricDevice>>()
    const metrics = new Map<string, ReturnType<typeof loadMetricOutput>>()
    const builtins = new Map<string, ReturnType<typeof loadMetricBuiltins>>()
    const productNames = new Map<string, Promise<string>>()
    const product = owner.scope === 'children' ? loadMetricProduct(owner.ownerId) : undefined
    const entries = await Promise.all(Object.entries(mappings).map(async ([id, mapping]):Promise<[string,MetricSourceDescription]> => {
      try {
        if (mapping.kind === 'builtin') {
          const type = mapping.thingType || owner.targetType || owner.ownerType
          const objectId = mapping.thingId || owner.targetId || owner.ownerId
          const key = JSON.stringify([type, objectId])
          if (!builtins.has(key)) builtins.set(key, loadMetricBuiltins(type, objectId))
          const item = (await builtins.get(key)!).find(item => item.id === mapping.id)
          if (!item) return [id, { error:t('noBuiltins') }]
          const label = type === owner.ownerType && objectId === owner.ownerId ? owner.label || objectId : objectId
          return [id, { label:`${label} / ${item.name}`, detail:item.supportsChildren
            ? `${mapping.includeChildren ? t('includeChildren') : t('directMembers')} · ${item.description}` : item.description,
            unit:item.unit, valueType:{ type:item.valueType || 'long' } }]
        }
        if (mapping.kind === 'metric') {
          if (!mapping.configId || owner.scope === 'children') return [id, { error:t('unsupported') }]
          if (!metrics.has(mapping.configId)) metrics.set(mapping.configId, loadMetricOutput(mapping.configId))
          const { config, template:raw } = await metrics.get(mapping.configId)!
          const template = localizedTemplate(raw, String(locale.value))
          const output = template.outputs.find(item => item.metricId === mapping.id)
          if (mapping.statistics) {
            const spec = mapping.statistics
            const required = spec.period === 'current' ? [mapping.id] : [mapping.id, spec.periodMetricId, spec.coverageMetricId]
            if (!output || config.state !== 'enabled' || config.scope !== 'children' || config.ownerType !== spec.sourceType
              || config.ownerId !== spec.sourceId || config.targetType !== spec.memberType || required.some(id => !template.outputs.some(item => item.metricId === id && item.persist && !item.latestOnly))) {
              return [id, { error:t('metricMissing') }]
            }
            if (mapping.sourceDataVersion && mapping.sourceDataVersion !== config.dataVersion) return [id, { error:t('metricChanged') }]
            const age = durationParts(spec.maxAge)
            const conditionValue = typeof spec.value === 'boolean' ? t(spec.value ? 'statisticsTrue' : 'statisticsFalse') : spec.value
            if (!productNames.has(spec.sourceId)) productNames.set(spec.sourceId, loadMetricProductName(spec.sourceId))
            return [id, { label:`${config.name || template.name} / ${metricOutputName(output, template) || output.metricId}`,
              detail:t('statisticsReadDetail', { scope:t(mapping.includeChildren ? 'includeChildren' : 'directMembers'), product:await productNames.get(spec.sourceId)!,
                operation:t(`statistics_${spec.operation}`), condition:spec.operator ? ` · ${t(`statistics_${spec.operator}`)} ${conditionValue}` : '',
                period:t(`statistics_${spec.period}`), age:age ? t(`statisticsAge_${age.unit}`, { count:age.amount }) : spec.maxAge }),
              unit:spec.operation === 'count' ? undefined : output.unit, valueType:{ type:spec.operation === 'count' ? 'long' : 'double' } }]
          }
          if (!output || config.state !== 'enabled' || config.scope === 'children'
            || config.targetType !== (mapping.thingType || owner.targetType)
            || config.targetId !== (mapping.thingId || owner.targetId || owner.ownerId)) return [id, { error:t('metricMissing') }]
          if (mapping.sourceDataVersion && mapping.sourceDataVersion !== config.dataVersion) return [id, { error:t('metricChanged') }]
          return [id, { label:`${config.name || template.name} / ${metricOutputName(output, template) || output.metricId}`,
            detail:output.metricId, unit:output.unit, valueType:output.valueType ? { type:output.valueType } : undefined }]
        }
        const deviceId = mapping.thingId || owner.targetId || owner.ownerId
        if (!product && !reads.has(deviceId)) reads.set(deviceId, loadMetricDevice(deviceId))
        const device = product ? undefined : await reads.get(deviceId)!
        const properties = product ? await product : device!.properties
        const property = properties.find(item => item.id === mapping.id)
        if (!property && mapping.id !== '$online') return [id, { error:t('sourceMissing') }]
        const label = mapping.id === '$online' ? t('online') : property!.name
        return [id, { label:`${product ? t('currentDevice') : device!.device.name} / ${label}`, detail:mapping.id,
          unit:property?.unit, valueType:property?.valueType }]
      } catch { return [id, { error:t('failed') }] }
    }))
    return Object.fromEntries(entries)
  }
  return { pickSource: Object.assign(state.pickSource, { editor, describe, cancel:state.cancel }), host }
}
