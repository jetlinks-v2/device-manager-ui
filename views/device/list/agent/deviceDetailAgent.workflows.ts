import i18n from '@jetlinks-web-core/locales'
import type { GeneralAgentWorkflowGuide } from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'

const t = (key: string) => i18n.global.t(`IotDeviceDetailAgent.${key}`)

const output = () => t('workflows.output')

const workflowStep = (
  capability: string,
  evidence: string | string[],
  required = true,
) => ({ capability, evidence, required })

export const createDeviceDetailAgentWorkflows = (): GeneralAgentWorkflowGuide[] => [
  {
    id: 'device-detail-today-operation',
    title: t('workflows.today.title'),
    when: t('workflows.today.when'),
    steps: [
      workflowStep('subject.context.read', 'subject-context'),
      workflowStep('subject.activity.aggregate', 'activity-aggregate'),
      workflowStep('subject.message.aggregate', 'message-aggregate'),
      workflowStep('subject.traffic.aggregate', 'traffic-aggregate'),
      workflowStep('subject.alarm.records.read', 'alarm-records', false),
      workflowStep('subject.alarm.history.summary', 'alarm-history-summary', false),
      workflowStep('subject.connection.summary', 'connection-summary', false),
      workflowStep('subject.schema.search', 'subject-property-id', false),
      workflowStep('subject.property.latest', 'property-snapshot', false),
    ],
    output: output(),
  },
  {
    id: 'device-detail-offline-diagnosis',
    title: t('workflows.offline.title'),
    when: t('workflows.offline.when'),
    steps: [
      workflowStep('subject.context.read', 'subject-context'),
      workflowStep('subject.access.read', 'access-configuration'),
      workflowStep('subject.connection.summary', 'connection-summary'),
      workflowStep('subject.activity.aggregate', 'activity-aggregate', false),
      workflowStep('subject.log.summary', 'log-summary', false),
      workflowStep('subject.alarm.records.read', 'alarm-records', false),
    ],
    output: output(),
    notes: [t('workflows.offline.note')],
  },
  {
    id: 'device-detail-property-anomaly',
    title: t('workflows.property.title'),
    when: t('workflows.property.when'),
    steps: [
      workflowStep('subject.schema.search', 'subject-property-id'),
      workflowStep('subject.property.aggregate', 'property-aggregate'),
      workflowStep('subject.property.latest', 'property-snapshot', false),
      workflowStep('subject.property.history.summary', 'property-history-summary', false),
      workflowStep('subject.property.history.read', 'property-history-records', false),
    ],
    output: output(),
  },
  {
    id: 'device-detail-no-data',
    title: t('workflows.noData.title'),
    when: t('workflows.noData.when'),
    steps: [
      workflowStep('subject.context.read', 'subject-context'),
      workflowStep('subject.access.read', 'access-configuration'),
      workflowStep('subject.schema.search', 'subject-property-id', false),
      workflowStep('subject.property.latest', 'property-snapshot', false),
      workflowStep('subject.message.aggregate', 'message-aggregate', false),
      workflowStep('subject.log.summary', 'log-summary', false),
      workflowStep('subject.connection.summary', 'connection-summary', false),
    ],
    output: output(),
  },
  {
    id: 'device-detail-alarm-diagnosis',
    title: t('workflows.alarm.title'),
    when: t('workflows.alarm.when'),
    steps: [
      workflowStep('subject.alarm.records.read', ['alarm-record-id', 'alarm-records']),
      workflowStep('subject.alarm.history.summary', 'alarm-history-summary'),
      workflowStep('subject.event.read', 'event-records', false),
      workflowStep('subject.property.history.summary', 'property-history-summary', false),
      workflowStep('subject.log.summary', 'log-summary', false),
    ],
    output: output(),
  },
  {
    id: 'device-detail-first-access',
    title: t('workflows.firstAccess.title'),
    when: t('workflows.firstAccess.when'),
    steps: [
      workflowStep('subject.context.read', 'subject-context'),
      workflowStep('subject.access.read', 'access-configuration'),
      workflowStep('subject.document.search', 'document-file-id', false),
      workflowStep('subject.document.read', 'document-content', false),
      workflowStep('subject.log.summary', 'log-summary', false),
    ],
    output: output(),
  },
  {
    id: 'device-detail-trace-reproduction',
    title: t('workflows.trace.title'),
    when: t('workflows.trace.when'),
    steps: [
      workflowStep('subject.trace.capture', 'trace-records'),
      workflowStep('subject.access.read', 'access-configuration'),
      workflowStep('subject.log.summary', 'log-summary'),
    ],
    output: output(),
    notes: [t('workflows.trace.note')],
  },
]
