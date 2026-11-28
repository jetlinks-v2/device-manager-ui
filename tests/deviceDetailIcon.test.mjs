import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader, createComponentRenderer, passthrough, flush, walk } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

test('device type replaces built-in product artwork while custom photos and local editing remain', async t => {
  const Component = createComponentLoader({
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/components/IconValue': { IconValueView: passthrough('custom-photo') },
    '../../assets/device/device-product.png': '/bundled-product.png',
    './useDeviceHeaderEditing': { useDeviceHeaderEditing: () => ({ busy: vue.ref(false), failure: vue.ref(''), saveIcon() {} }) },
  })(fileURLToPath(new URL('../components/device-detail/DeviceDetailIcon.vue', import.meta.url))).default
  const props = vue.reactive({ deviceId: 'a', name: 'Device', fallbackIcon: 'GatewayOutlined', typeLabel: 'Edge node', allowed: true, value: '/assets/device-product.png', refresh() {} })
  const view = createComponentRenderer(), app = view.renderer.createApp({ render: () => vue.h(Component, props) })
  app.component('a-popover', { inheritAttrs: false, setup: (_, { slots }) => () => vue.h('popover', slots.default?.()) })
  for (const name of ['pro-upload', 'a-typography-text', 'a-button']) app.component(name, passthrough(name))
  app.component('AIcon', { props: ['type'], setup: props => () => vue.h('icon', { name: props.type }) })
  app.mount(view.root); t.after(() => app.unmount())
  const button = () => walk(view.root, node => node.type === 'button')[0]
  for (const value of ['/assets/device-product.png', '/bundled-product.png']) {
    props.value = value; await flush()
    assert.equal(walk(view.root, node => node.type === 'custom-photo').length, 0)
    assert.equal(walk(view.root, node => node.type === 'icon' && node.props.name === 'GatewayOutlined').length, 1)
  }
  assert.match(button().props['aria-label'], /Edge node.*IotDeviceDetail.header.editIcon/)
  props.value = '/custom.png'; props.allowed = false; await flush()
  assert.equal(walk(view.root, node => node.type === 'custom-photo').length, 1)
  assert.equal(button().props.disabled, true)
  assert.equal(button().props['aria-label'], 'Edge node')
})
