import { shallowRef, type InjectionKey } from 'vue'
import { queryDeviceAlarmNotifyUsers } from '../api'

export interface AlarmRecipientOption {
  value: string
  label: string
  description?: string
  icon?: string
  unavailable?: boolean
}

/** Page-local selected-name cache; never stores contacts or account bindings. */
export function createAlarmRecipientCache() {
  const options = shallowRef(new Map<string, AlarmRecipientOption>())
  const revision = shallowRef(0)
  const pending = new Map<string, Promise<void>>()

  function remember(values: AlarmRecipientOption[]) {
    options.value = new Map([...options.value, ...values.map(({ value, label, icon, unavailable }) =>
      [value, { value, label, icon, unavailable }] as const)])
    return values
  }

  async function load(values: string[]) {
    const ids = [...new Set(values)]
    const missing = ids.filter(id => !options.value.has(id) && !pending.has(id))
    if (missing.length) {
      const token = revision.value
      const request = queryDeviceAlarmNotifyUsers({ paging: false, userIds: missing }).then(result => {
        if (token !== revision.value) return
        const found = new Map(result.data.map(user => [user.id, user]))
        remember(missing.map(id => {
          const user = found.get(id)
          return user ? { value: id, label: user.name, icon: 'UserOutlined' }
            : { value: id, label: id, unavailable: true }
        }))
      }).finally(() => {
        // A response from the old scope must not remove the new scope's in-flight query.
        missing.forEach(id => { if (pending.get(id) === request) pending.delete(id) })
      })
      missing.forEach(id => pending.set(id, request))
    }
    await Promise.all([...new Set(ids.map(id => pending.get(id)).filter(Boolean))])
  }

  function reset() {
    pending.clear()
    options.value = new Map()
    revision.value++
  }
  return { options, revision, remember, load, reset }
}

export type AlarmRecipientCache = ReturnType<typeof createAlarmRecipientCache>
export const alarmRecipientCacheKey: InjectionKey<AlarmRecipientCache> = Symbol('alarm-recipient-cache')
