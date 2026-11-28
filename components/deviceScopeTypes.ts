export type DeviceScopeKind = 'area' | 'group'
export interface DeviceScopeOption { title: string; value: string; key?: string; disabled?: boolean; selectable?: boolean; children?: DeviceScopeOption[] }
