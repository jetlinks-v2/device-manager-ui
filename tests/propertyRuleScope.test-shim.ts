import { reactive } from 'vue'

export const ruleRoute = reactive<{ query: Record<string, unknown> }>({ query: {} })
export const useRoute = () => ruleRoute
export const useRouter = () => ({ replace: async ({ query }: { query: Record<string, unknown> }) => { ruleRoute.query = query } })
export const useAuthStore = () => ({ hasPermission: () => true })
export const useSystemStore = () => ({ showThreshold: true })
export const onBeforeRouteLeave = () => {}
export const onBeforeRouteUpdate = () => {}
export const message = { warning() {}, success() {}, error() {} }
export const Modal = { confirm: (options: { onOk?: () => void }) => { options.onOk?.() } }
