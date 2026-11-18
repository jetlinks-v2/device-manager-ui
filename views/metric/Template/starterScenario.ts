import type { MetricParameter, MetricTemplate, MetricTemplateInput, MetricTemplateOutput, MetricTemplateStarter } from '@jetlinks-web-core/components'

type Text = [zh: string, en: string]
type Named<T> = T & { name: Text }
type Sample = { metricId: string; value: number; offsetSeconds: number }

/** Only the example envelope is shared. Calculations use the same editable declarations as user templates. */
export function scenario(spec: {
  id: string; name: Text; description: Text; notes: Text; icon: string; group: 'energy' | 'statistics' | 'condition' | 'connectivity'
  inputs: Named<Omit<MetricTemplateInput, 'name'> & { id: string }>[]
  rules: Named<Record<string, unknown>>[]
  outputs: Named<Omit<MetricTemplateOutput, 'label'> & { metricId: string }>[]
  parameters?: Named<Omit<MetricParameter, 'name'>>[]
  samples: Sample[]; reference: { name: string; url: string }
}): MetricTemplateStarter {
  const messages: Record<string, { zh: string; en: string }> = {}
  const text = (key: string, value: Text) => { messages[key] = { zh: value[0], en: value[1] }; return value[0] }
  const name = text('name', spec.name)
  const description = text('description', spec.description)
  const notes = text('notes', spec.notes)
  const template: MetricTemplate = {
    id: `iot-${spec.id}`, version: '1', name, enabled: true,
    parameterDefinitions: (spec.parameters || []).map(({ name, ...parameter }) => ({ ...parameter, name:text(`parameter.${parameter.id}.name`, name) })), parameters: {},
    inputDefinitions: spec.inputs.map(({ name, ...input }) => ({ ...input, name: text(`input.${input.id}.name`, name) })),
    definitions: spec.rules.map(({ name, ...rule }) => ({ ...rule, name: text(`rule.${rule.id}.name`, name) })),
    outputs: spec.outputs.map(({ name, ...output }) => ({ ...output, label: text(`output.${output.metricId}.label`, name), persist: true, publish: true })),
    options: { description, notes, category: spec.group, icon: spec.icon, i18nMessages: messages,
      authoring: { references: [{ kind: 'literature', ...spec.reference }] } },
  }
  const groups: Record<typeof spec.group, Text> = { energy: ['计量与用量', 'Metering and usage'], statistics: ['窗口统计', 'Window statistics'],
    condition: ['条件与观察', 'Conditions and observations'], connectivity: ['通信观察', 'Communication observations'] }
  const origin = 1_794_800_000_000
  return { id: spec.id, name, description, icon: spec.icon, groupId: spec.group,
    groupName: groups[spec.group][0], groupNameI18n: { zh: groups[spec.group][0], en: groups[spec.group][1] },
    providerName: '通用 IoT 模板', providerNameI18n: { zh: '通用 IoT 模板', en: 'General IoT templates' }, template,
    simulation: { configuration: { ownerType: 'simulation', ownerId: 'example', slot: 'example', targetType: 'simulation', targetId: 'example',
      templateId: template.id, templateVersion: '1', state: 'disabled', revision: 0, parameters: {},
      inputMappings: Object.fromEntries(template.inputDefinitions.map(input => [input.id, { kind: 'property', thingType: 'sensor', thingId: 'example-sensor', id: input.id }])) },
      samples: spec.samples.map(({ offsetSeconds, ...sample }) => ({ ...sample, eventTime: origin + offsetSeconds * 1000,
        unit: template.inputDefinitions.find(input => input.id === sample.metricId)?.unit,
        ingestTime: origin + offsetSeconds * 1000, processTime: origin + offsetSeconds * 1000,
        thingType: 'sensor', thingId: 'example-sensor', quality: { valid: true } })) } }
}
