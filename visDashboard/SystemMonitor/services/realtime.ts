import { wsClient } from '@jetlinks-web/core'
import type { RealtimePayloadItem } from '../utils/realtimeResourceData'

export interface MonitorSubscription { unsubscribe: () => void }
export interface MonitorObserver { next: (items: RealtimePayloadItem[]) => void; error: () => void }
export type MonitorSubscriber = (observer: MonitorObserver) => MonitorSubscription
let sequence = 0

/** Each owner gets a distinct subscription; the page shares that owner with all its widgets. */
export const subscribeRealtimeResources: MonitorSubscriber = observer => wsClient.getWebSocket(
  `system-monitor-${++sequence}`,
  '/dashboard/systemMonitor/stats/info/realTime',
  { type: 'all', interval: '3s' },
).subscribe({
  next: response => {
    const { payload } = response as unknown as { payload?: { value?: RealtimePayloadItem[] | { value?: RealtimePayloadItem[] } } }
    const value = payload?.value
    const items = Array.isArray(value) ? value : value?.value
    if (Array.isArray(items)) observer.next(items)
  },
  error: observer.error,
  complete: observer.error,
})
