import { onScopeDispose, readonly, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getInstance } from '@jetlinks-web/core'
import type { AxiosResponseTransformer } from 'axios'

const active = ref(false)
export const activeLogoutNavigation = readonly(active)
let consumers = 0
let stop: (() => void) | undefined

/** Observe successful explicit logout only while rule scopes exist; never change the response or session. */
export function useRuleLogoutNavigation() {
  if (!consumers) {
    const router = useRouter()
    const instance = getInstance()
    let listening = true
    let session = 0
    const interceptor = instance.interceptors.request.use(config => {
      if (config.method?.toLowerCase() !== 'get' || config.url !== '/user-token/reset') return config
      const requestSession = session
      const observe: AxiosResponseTransformer = (data: unknown, _headers, status) => {
        // The default JSON transform runs first; the core success normalizer and menu callback run afterwards.
        if (listening && requestSession === session && status !== undefined && status >= 200 && status < 300
          && data && typeof data === 'object') {
          const result = data as { success?: unknown; status?: unknown }
          if (result.success === true || (result.success === undefined && result.status === 200)) active.value = true
        }
        return data
      }
      const transforms = config.transformResponse
      config.transformResponse = [...(Array.isArray(transforms) ? transforms : transforms ? [transforms] : []), observe]
      return config
    })
    const removeAfterEach = router.afterEach((to, _from, failure) => {
      if (!failure && to.name === 'Login') {
        session++
        active.value = false
      }
    })
    stop = () => {
      listening = false
      instance.interceptors.request.eject(interceptor)
      removeAfterEach()
      active.value = false
    }
  }
  consumers++
  onScopeDispose(() => {
    if (--consumers) return
    stop?.()
    stop = undefined
  })
}
