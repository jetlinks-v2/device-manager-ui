import { createMonitorConfig } from '../config'
const defaults = createMonitorConfig('systemMonitorRealtimeResources', 'components.RealtimeResource.title', 12)
export const config = { ...defaults, componentProps: { ...defaults.componentProps,
  gridItem: { ...defaults.componentProps.gridItem, h: 8, minH: 7 },
} }
