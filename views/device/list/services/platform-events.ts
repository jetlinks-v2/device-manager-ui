export interface PlatformEvent<TPayload = Record<string, unknown>> {
  id: string
  title: string
  source: string
  subType: string
  occurredAt: string
  status: 'new' | 'in_progress' | 'resolved' | 'auto_resolved'
  severity: 'urgent' | 'high' | 'normal' | 'low'
  subjectKind?: string
  subjectRef?: string
  subjectName?: string
  areaRef?: string
  desc: string
  payload: TPayload
}
