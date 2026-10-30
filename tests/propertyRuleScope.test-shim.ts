import { onBeforeUnmount, reactive } from 'vue'
import type { NavigationGuard } from 'vue-router'

export const ruleRoute = reactive<{ query: Record<string, unknown> }>({ query: {} })
export const useRoute = () => ruleRoute
export const useRouter = () => ({ replace: async ({ query }: { query: Record<string, unknown> }) => { ruleRoute.query = query } })
export const useAuthStore = () => ({ hasPermission: () => true })
export const ruleSystem = reactive({ showThreshold: true })
export const useSystemStore = () => ruleSystem
export const ruleMenus = reactive(new Set<string>())
export const ruleMenuVisits: string[] = []
export const useMenuStore = () => ({ hasMenu: (code: string) => ruleMenus.has(code), jumpPage: (code: string) => ruleMenuVisits.push(code) })
export const routeGuards: { leave: NavigationGuard[]; update: NavigationGuard[] } = { leave: [], update: [] }
function registerGuard(guards: NavigationGuard[], guard: NavigationGuard) {
  guards.push(guard)
  onBeforeUnmount(() => { guards.splice(guards.indexOf(guard), 1) })
}
export const onBeforeRouteLeave = (guard: NavigationGuard) => registerGuard(routeGuards.leave, guard)
export const onBeforeRouteUpdate = (guard: NavigationGuard) => registerGuard(routeGuards.update, guard)
export const message = { warning() {}, success() {}, error() {} }
export interface TestConfirmation { onOk?: () => unknown; onCancel?: () => unknown; [key: string]: unknown }
const confirmImmediately = (options: TestConfirmation) => { void options.onOk?.() }
let confirmHandler = confirmImmediately
/** Tests can hold the dialog open, navigate, then explicitly confirm or cancel. */
export const setConfirmHandler = (handler = confirmImmediately) => { confirmHandler = handler }
export const Modal = { confirm: (options: TestConfirmation) => { confirmHandler(options) } }
