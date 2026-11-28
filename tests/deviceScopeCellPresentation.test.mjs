import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader, createComponentRenderer, passthrough, walk } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

test('scope field forwards consumer size and accessibility attributes to its real trigger', t => {
  const load = createComponentLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) }, '@jetlinks-web-core/components/DetailMetaItem': { detailMetaIcons: { space: 'EnvironmentOutlined' } } })
  const Component = load(fileURLToPath(new URL('../components/IotDeviceScopeCell.vue', import.meta.url))).default
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, { kind: 'area', text: '', value: [], options: [], allowed: true, disabled: false, loading: false, loadError: '', save: async () => {}, class: 'consumer-field', style: { '--device-scope-line-height': '24px' }, 'data-field': 'area' }) })
  for (const name of ['a-popover','a-tooltip','a-button','a-tree-select','a-skeleton','a-alert','a-typography-text']) app.component(name, passthrough(name))
  app.component('AIcon', passthrough('icon'))
  app.mount(view.root); t.after(() => app.unmount())
  const trigger = walk(view.root, node => node.type === 'button' && node.props['data-field'] === 'area')[0]
  assert.ok(trigger)
  assert.match(trigger.props.class, /consumer-field/)
  assert.equal(trigger.props.style['--device-scope-line-height'], '24px')
})

test('detail scope field carries its line height through the popover trigger', t => {
  const boundaries = {
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/components/DetailMetaItem': { detailMetaIcons: {} },
    './useDeviceHeaderEditing': { useDeviceHeaderEditing: () => ({ detail: vue.ref(), options: vue.ref([]), loading: vue.ref(false), busy: vue.ref(false), loadError: vue.ref(''), prepareScope() {}, saveScope: async () => {} }) },
  }
  const load = createComponentLoader(boundaries)
  boundaries['../IotDeviceScopeCell.vue'] = load(fileURLToPath(new URL('../components/IotDeviceScopeCell.vue', import.meta.url)))
  const Component = load(fileURLToPath(new URL('../components/device-detail/DeviceDetailScopeField.vue', import.meta.url))).default
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, { deviceId: 'device', kind: 'area', text: '', allowed: true, refresh() {} }) })
  for (const name of ['a-popover','a-tooltip','a-button','a-tree-select','a-skeleton','a-alert','a-typography-text']) app.component(name, passthrough(name))
  app.component('AIcon', passthrough('icon'))
  app.mount(view.root); t.after(() => app.unmount())
  const trigger = walk(view.root, node => node.type === 'button' && node.props.class.includes('device-scope-cell'))[0]
  assert.equal(trigger.props.style['--device-scope-line-height'], '24px')
})
