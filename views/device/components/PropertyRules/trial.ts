import type { ThingModelProperty } from '../../alarm/types'
import { isNumberProperty } from '../../alarm/utils'
import { buildRule, parseRule, type RuleDraft, type RulePart } from './codec'
import type { FallbackExampleState, RuleExampleInput, RuleExamplePoint, RuleExampleStage } from './diagram'
import type { PropertyTrialPoint, PropertyTrialRequest } from '../../../../api/propertyPreprocessorTrial'
import { formatPropertyValue } from './values/metadata'

const order: RulePart[] = ['values', 'range', 'step', 'scale', 'fallback', 'alarm', 'sampling', 'file']
export const trialRuleKeys = (draft: RuleDraft) => order.filter(key => draft[`${key}Enabled`])

/** 配置编解码与正式保存相同；上下文只映射消息已有字段，不传任意变量或源码。 */
export function ruleTrialRequest(draft: RuleDraft, property: ThingModelProperty, inputs: RuleExampleInput[],
  previous: FallbackExampleState, context: Record<string, string | number | null>): PropertyTrialRequest {
  const rule = buildRule(parseRule(), draft)
  return {
    provider: rule.provider, configuration: rule.configuration,
    samples: inputs.map(input => ({ value: isNumberProperty(property) && input.value != null ? String(input.value) : input.value,
      missing: input.missing, arrivalMillis: input.arrivalMillis ?? 0,
      ...(context.messageTime != null ? { messageTime: context.messageTime } : {}),
      ...(context.sourceTime != null || context.propertyTime != null ? { sourceTime: context.sourceTime ?? context.propertyTime! } : {}),
      ...(context.propertyState != null ? { propertyState: String(context.propertyState) } : {}),
    })),
    previous: { value: previous.value, timeMillis: previous.time, outcome: previous.outcome },
  }
}

/** 仅把后端路径和结果投影为原图例的行；不重新判断条件、采样或公式。 */
export function presentRuleTrial(draft: RuleDraft, property: ThingModelProperty, inputs: RuleExampleInput[],
  points: PropertyTrialPoint[]): RuleExamplePoint[] {
  const keys = trialRuleKeys(draft)
  const label = (value: unknown) => isNumberProperty(property) && value != null ? String(value) : formatPropertyValue(value, property)
  return points.map((point, index) => {
    const stages = keys.map((key, row): RuleExampleStage => {
      const path = `/${row}`
      const steps = point.steps.filter(step => step.path === path || step.path.startsWith(path + '/'))
      const top = steps.find(step => step.path === path)
      const intents = point.intents.filter(intent => intent.path === path || intent.path.startsWith(path + '/'))
      const error = steps.some(step => step.status === 'error')
      let status: RuleExampleStage['status'] = !top ? 'skipped' : top.status === 'skipped' ? 'kept' : top.status
      if (error) status = 'error'
      else if (intents.some(intent => intent.action === 'alarm')) status = 'alarm'
      else if (intents.some(intent => intent.action === 'relieve')) status = 'recovered'
      else if (intents.some(intent => intent.action === 'file')) status = 'processed'
      else if (steps.some(step => step.status === 'filtered')) status = 'filtered'
      else if (steps.some(step => ['replace-value', 'clamp'].includes(step.provider))) status = 'processed'
      const explanation = steps.find(step => step.explanation)?.explanation
      return { key, status, explanation, recordInvalid: steps.some(step => step.recordInvalid),
        ...(top?.value != null && status === 'processed' && key !== 'file' ? { value: label(top.value) } : {}),
        ...(error ? { error: point.error } : {}), intent: intents.length > 0,
      }
    })
    return { label: point.outputKnown && point.present ? label(point.value) : '—', outputKnown: point.outputKnown,
      inputLabel: inputs[index]?.missing ? '—' : label(inputs[index]?.value), stages,
      filtered: !point.error && point.outputKnown && !point.present, sampled: stages.some(stage => stage.key === 'sampling' && stage.status === 'filtered'),
      alarm: stages.some(stage => stage.status === 'alarm'), error: point.error,
    }
  })
}
