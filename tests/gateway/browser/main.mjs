import { createApp, defineComponent, h, ref, onMounted } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import Antd from 'ant-design-vue'
import * as icons from '@ant-design/icons-vue'
import PermissionButton from '@jetlinks-web/components/es/PermissionButton/index.js'
import ValueItem from '@jetlinks-web/components/es/ValueItem/index.js'
import Markdown from '@jetlinks-web/components/es/Markdown/index.js'
import Workspace from '../../../views/link/AccessConfig/GatewayWorkspace.vue'
import TitleComponent from '../../../../../jetlinks-web-core/src/components/TitleComponent/index.vue'
import CloudEmpty from '../../../../../jetlinks-web-core/src/components/CloudEmpty/index.vue'
import i18n, { capture, setRouter, options } from './boundaries.mjs'
import '../../../../../jetlinks-web-core/src/style.css'
import 'ant-design-vue/dist/reset.css'

const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/gateway', name: 'gateway', component: Workspace },
  { path: '/gateway/detail/:id', name: 'gateway-detail', component: Workspace },
] })
setRouter(router)
if (!location.hash) router.replace('/gateway')
const app = createApp({ render: () => h('div', [h('output', { 'data-testid': 'fixture-ready' }, 'case-' + (options.get('case') || 'manual')), h(RouterView), h('details', { class: 'fixture-capture' }, [h('summary', '验证记录'), h('pre', { 'data-testid': 'capture' }, JSON.stringify(capture))])]) })
app.use(Antd).use(i18n).use(router)
app.component('AIcon', { props: ['type'], setup: props => () => icons[props.type] ? h(icons[props.type]) : null })
app.component('JPermissionButton', PermissionButton)
app.component('JValueItem', ValueItem)
app.component('TitleComponent', TitleComponent)
app.component('CloudEmpty', CloudEmpty)
for (const name of ['JPageContainer', 'FullPage', 'JScrollbar', 'JEllipsis']) app.component(name, { setup: (_, { slots, attrs }) => () => h('div', attrs, slots.default?.()) })
app.component('JMarkdown', options.has('outline') ? Markdown : { props: ['source'], setup: props => () => h('pre', props.source) })
app.component('CardBox', { props: ['actions'], setup: (props, { slots, attrs }) => () => h('div', { ...attrs, class: 'fixture-card' }, [slots.img?.(), slots.content?.(), h('div', { onClick: event => event.stopPropagation() }, (props.actions || []).map(item => slots.actions ? slots.actions(item) : h('button', { onClick: item.onClick }, item.text)))]) })
app.component('JProTable', defineComponent({
  props: ['request', 'dataSource'],
  setup(props, { slots, expose }) {
    const records = ref([]), retained = ref('')
    const reload = async () => { if (props.request) records.value = (await props.request({ pageIndex: 0, pageSize: 12 })).result.data }
    expose({ reload }); onMounted(reload)
    return () => h('div', { class: 'fixture-table' }, [h('header', [slots.headerLeftRender?.(), slots.headerRightRender?.()]), props.request ? h('input', { 'data-testid': 'retained-list-state', value: retained.value, onInput: event => retained.value = event.target.value, placeholder: '列表状态验证' }) : null, ...(props.dataSource || records.value).map(item => slots.card?.(item)), !(props.dataSource || records.value).length ? slots.emptyText?.() : null])
  },
}))
app.config.errorHandler = error => { if (error?.errorFields) capture.messages.push({ validation: error.errorFields }); else { capture.errors.push(error.message); console.error(error) } }
window.addEventListener('unhandledrejection', event => {
  if (event.reason?.errorFields) capture.messages.push({ validation: event.reason.errorFields })
  else capture.errors.push(event.reason?.message || String(event.reason))
})
app.mount('#app')
const style = document.createElement('style'); style.textContent = 'body{padding:24px;background:#f4f6fa}.fixture-table>header{display:flex;justify-content:space-between;margin-bottom:24px}.fixture-card{padding:16px;border:1px solid #ddd;border-radius:16px;background:white;margin:16px 0}.fixture-card img{max-width:48px}.fixture-capture{margin-top:32px}';document.head.append(style)
style.textContent += '@media(max-width:575px){.fixture-table>header{display:block}.fixture-table>header>.ant-flex{flex-wrap:wrap;max-width:100%}.fixture-table>header .access-component-list-search{max-width:100%;min-width:0}}'
