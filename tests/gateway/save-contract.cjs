/* Runs the original SFC setup functions with Vue and Ant Design's real useForm.
 * Only environment boundaries (HTTP, router, tab hooks and template form refs) are replaced.
 * BASELINE_REV pins the pre-layout implementation; baseline generation never reads edited files.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const workspaceRequire = createRequire(path.resolve(root, '../../package.json'));
const Vue = workspaceRequire('vue');
const { Form } = workspaceRequire('ant-design-vue');
const { parse, compileScript } = workspaceRequire('vue/compiler-sfc');
const esbuild = workspaceRequire('esbuild');
const BASELINE_REV = '53aa23bacb20f550f11383609417ad04e1b224a3';
const baseDir = 'views/link/AccessConfig/components/';
const groups = {
  Network: ['mqtt-server-gateway', 'mqtt-client-gateway', 'websocket-server', 'coap-server-gateway', 'tcp-server-gateway', 'udp-device-gateway', 'http-server-gateway', 'child-device', 'agent-device-gateway', 'agent-media-device-gateway'],
  Plugin: ['plugin_gateway', 'media-plugin'],
  'Cloud/OneNet': ['OneNet', 'OneNet-platform'],
  'Cloud/Ctwing': ['Ctwing'],
  'Media/index': ['fixed-media'], 'Media/Onvif': ['onvif'], 'Media/GB28181': ['gb28181-2016'],
  Channel: ['modbus-tcp', 'opc-ua'], 'Edge/geteway': ['collector-gateway'],
  Edge: ['official-edge-gateway', 'edge-child-device'], Composite: ['composite-device-gateway'],
};
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick(); } };
const renderer = Vue.createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
});

function mountFixture(kind, providerId, editing, options = {}, original = false) {
  const records = [], callbacks = [], events = [], messages = [], opens = [], errors = [];
  const query = { view: 'false', ...options.query };
  const route = Vue.reactive({ params: { id: editing ? 'gateway-existing' : ':id' }, query });
  const channel = providerId === 'child-device' ? 'child-device' : providerId === 'collector-gateway' ? 'collector' : providerId === 'fixed-media' ? 'fixed-media' : 'network';
  const provider = { id: providerId, name: providerId, channel, type: kind === 'Channel' || kind === 'Edge/geteway' ? 'channel' : 'network' };
  const networkType = options.networkType || (providerId.startsWith('agent-') ? 'HTTP_SERVER' : 'MQTT_SERVER');
  const network = { id: 'network-1', name: '网络组件', type: networkType, addresses: [{ address: '127.0.0.1:1883', health: 1 }] };
  const protocol = { id: 'protocol-1', name: '协议', description: '协议说明' };
  const child = { id: 'child-1', name: '子网关', provider: 'tcp-server-gateway', transport: 'TCP', channel: 'network', channelId: network.id, protocol: protocol.id, configuration: { enabled: false, retries: 0 }, channelInfo: network, protocolDetail: protocol, transportDetail: { id: 'TCP' } };
  const configuration = providerId === 'composite-device-gateway' ? { gateways: [child] }
    : providerId === 'gb28181-2016' ? { domain: '3402000000', sipId: '34020000002000000001', shareCluster: !options.independent, hostPort: { host: '0.0.0.0', port: 5060, publicHost: '127.0.0.1', publicPort: 5061 }, cluster: [] }
      : { apiAddress: 'https://example.test/api', apiKey: 'api-key', appKey: 'app-key', appSecret: 'secret', validateToken: 'token', aesKey: 'aes', enabled: false, retries: 0, modes: [] };
  const initial = editing ? { id: 'gateway-existing', name: '已有网关', description: '已有说明', bizKey: 'existing-key', provider: providerId, channel, channelId: kind === 'Plugin' ? 'plugin-1' : network.id, protocol: protocol.id, configuration, i18nMessages: { name: { en: 'Existing gateway' } }, extension: { zero: 0, enabled: false, empty: [] } } : {};
  const response = options.failure ? { status: 400, success: false, result: null } : { status: 200, success: true, result: { id: 'saved-gateway' } };
  async function request(method, url, data) {
    records.push({ method, url, ...(data === undefined ? {} : { body: clone(data) }) });
    if (url === '/gateway/device' && ['POST', 'PATCH'].includes(method)) { events.push('request'); return clone(response); }
    if (url.includes('/network/config')) return { status: 200, success: true, result: [network] };
    if (url.startsWith('/protocol/supports')) return { status: 200, success: true, result: [protocol] };
    if (url.startsWith('/protocol/')) return { status: 200, success: true, result: { id: 'MQTT', document: '协议文档', routes: [] } };
    if (url.includes('/plugin/driver/') && url.endsWith('/description')) return { status: 200, success: true, result: { others: { configMetadata: { properties: [{ property: 'retries', name: '重试', type: { type: 'int' }, expands: { required: true } }, { property: 'enabled', name: '启用', type: { type: 'boolean', falseValue: false, trueValue: true } }] } } } };
    if (url.includes('/plugin/driver')) return { status: 200, success: true, result: [{ id: 'plugin-1', name: '插件', version: '1.0' }] };
    if (url.endsWith('/clusters')) return { status: 200, success: true, result: [{ id: 'node-1', name: '节点1' }] };
    if (url === '/gateway/device/detail/config') return { status: 200, success: true, result: data };
    return { status: 200, success: true, result: [] };
  }
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    let source = original ? cp.execFileSync('git', ['show', `${BASELINE_REV}:${file}`], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.vue')) source = compileScript(parse(source, { filename: file }).descriptor, { id: 'contract' }).content;
    const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'node18' }).code;
    const module = { exports: {} }; cache.set(file, module);
    function localRequire(id) {
      if (id === 'vue' || id === 'ant-design-vue') return workspaceRequire(id);
      if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) };
      if (id === 'vue-router') return { useRoute: () => route };
      if (id === '@jetlinks-web/core') return { request: Object.fromEntries(['get', 'post', 'patch', 'remove', 'put'].map(m => [m, (url, data) => request(m.toUpperCase(), url, data)])) };
      if (id === '@jetlinks-web/utils' || id === '@jetlinks-web-core/utils/comm') return { onlyMessage: (...args) => messages.push(args), randomString: n => 'x'.repeat(n) };
      if (id === 'lodash-es') return { omit: (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key))), isNumber: value => typeof value === 'number' };
      if (id === '@vueuse/core') return { createReusableTemplate: () => [{ render: () => null }, { render: () => null }] };
      if (id === '@jetlinks-web-core/hooks') return { useTabSaveSuccess: (code, opts) => ({ onOpen: (...args) => opens.push({ code, args, opts }) }), useTabSaveSuccessBack: () => ({ onBack: data => { events.push('callback'); callbacks.push(clone(data)); } }) };
      if (id === '@jetlinks-web/hooks') return { useRequest: (fn, opts) => ({ loading: Vue.ref(false), run: async (...args) => { const res = await fn(...args); if (res.success) opts.onSuccess?.(res); return res; } }) };
      if (id.includes('/store')) return { useMenuStore: () => ({ getMenu: () => ({ path: '/fixture' }) }) };
      if (id === '@jetlinks-web-core/locales') return { global: { t: key => key } };
      if (id.endsWith('/utils/validate')) return { testIpv4_6: value => /^(\d{1,3}\.){3}\d{1,3}$/.test(value) };
      if (id.endsWith('/api/link/type')) return { allResources: async () => ({ status: 200, result: [{ host: '0.0.0.0', clusterNodeId: 'node-1', portList: [{ port: 5060, transports: ['UDP', 'TCP'] }] }] }) };
      if (id.includes('assets')) return { access: {}, network: {}, device: {} };
      if (id.endsWith('.vue') || id === '@jetlinks-web-core/components') return {};
      if (id.startsWith('@device-manager-ui/')) return load(id.replace('@device-manager-ui/', '') + (path.extname(id) ? '' : '.ts'));
      if (id.startsWith('.')) {
        let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), id));
        if (!path.extname(resolved)) resolved += '.ts';
        return load(resolved);
      }
      throw Error(`Unmocked boundary ${id} in ${file}`);
    }
    vm.runInNewContext(code, {
      ...Vue, module, exports: module.exports, require: localRequire,
      console: { log() {}, warn() {}, error() {} }, useRoute: () => route,
      document: { body: { clientHeight: 1000 } },
      window: { location: { origin: 'http://fixture', pathname: '/' }, open: () => ({}) },
      history: { back: () => events.push('back') }, setTimeout, clearTimeout,
    }, { filename: file });
    return module.exports;
  }
  const file = baseDir + kind + (kind.includes('/') ? '.vue' : '/index.vue');
  const component = load(file).default;
  component.render = () => null;
  const app = renderer.createApp(component, { provider, data: clone(initial), bindProduct: !!options.bound, otherProvider: [] });
  app.config.warnHandler = () => {};
  app.config.errorHandler = error => errors.push(error.message);
  const instance = app.mount({});
  return { state: instance.$.setupState.editor ? Vue.proxyRefs(instance.$.setupState.editor) : instance.$.setupState, wizard: instance.$.setupState.wizard, app, records, callbacks, events, messages, opens, errors, route, configuration, child, network, initial };
}

async function runCase(kind, provider, editing, options, original) {
  const f = mountFixture(kind, provider, editing, options, original);
  await flush();
  const s = f.state;
  const info = { name: '网关名称', description: '网关说明', bizKey: '', i18nMessages: { name: { en: 'Gateway' } } };
  Object.assign(s.formData || s.formState, info);
  const submit = async () => !original && f.wizard ? f.wizard.submit() : s.saveData();
  const templateForm = data => ({ validate: async () => clone(typeof data === 'function' ? data() : data) });
  if (kind === 'Network') {
    if (provider !== 'child-device') { s.checkedChange('network-1'); await s.next(); }
    if (!provider.startsWith('agent-')) { if (!editing) s.procotolChange('protocol-1'); await s.next(); }
    await submit();
  } else if (kind === 'Plugin') {
    s.AccessChange('plugin-1'); s.next(); await flush();
    s.formData.configuration = { enabled: false, retries: 0, modes: [] };
    s.formRef = templateForm(() => s.formData); await submit();
  } else if (kind.startsWith('Cloud/')) {
    Object.assign(s.formState, f.configuration);
    s.formRef1 = templateForm(() => s.formState); s.formRef2 = templateForm(() => s.formData);
    await s.next();
    (s.protocolChange || s.procotolChange)('protocol-1'); await s.next();
    await submit();
  } else if (kind === 'Media/GB28181') {
    const signal = clone(f.configuration); signal.hostPort.port = JSON.stringify({ host: '0.0.0.0', port: 5060 });
    s.formRef1 = templateForm(signal);
    s.formRef2 = templateForm({ cluster: [{ clusterNodeId: 'node-1', host: '0.0.0.0', port: '{"host":"0.0.0.0","port":5060}', publicHost: '127.0.0.1', publicPort: 5061, enabled: false, id: 7 }] });
    await s.next(); await submit();
  } else if (kind === 'Composite') {
    s.choosenProviderList = [clone(f.child)]; s.handleNext();
    s.formRef = templateForm(() => s.formData); await s.handleSave();
  } else {
    if (kind === 'Edge' && provider === 'official-edge-gateway') { s.checkedChange('network-1'); await s.next(); }
    await s.onFinish(clone(s.formState));
  }
  await flush();
  const result = { requests: clone(f.records.filter(r => r.url === '/gateway/device')), callbacks: f.callbacks, events: f.events, errors: f.errors };
  if (options.query?.provider) { assert.equal(result.requests.length, 0); assert.equal(result.callbacks.length, 1); assert.equal('bizKey' in result.callbacks[0], false); }
  else {
    assert.equal(result.requests.length, 1, `${provider} must submit exactly once`);
    assert.equal(result.requests[0].method, editing ? 'PATCH' : 'POST');
    assert.equal(result.requests[0].body.provider, provider);
    if (editing) assert.equal(result.requests[0].body.id, 'gateway-existing');
    if (options.failure) assert.deepEqual(result.events, ['request']);
    if (['fixed-media', 'onvif'].includes(provider)) assert.equal('protocol' in result.requests[0].body, false);
    if (provider.startsWith('agent-')) assert.equal(result.requests[0].body.transport, options.networkType === 'MQTT_SERVER' ? 'MQTT' : 'HTTP');
    if (provider === 'composite-device-gateway') { const b = result.requests[0].body; assert.equal(b.channelId, b.id); assert.equal(b.protocol, b.id); assert.equal('channelInfo' in b.configuration.gateways[0], false); }
  }
  f.app.unmount(); return result;
}

async function guards(original) {
  const result = {};
  for (const [kind, provider] of [['Network', 'http-server-gateway'], ['Plugin', 'plugin_gateway'], ['Cloud/Ctwing', 'Ctwing'], ['Cloud/OneNet', 'OneNet'], ['Edge', 'official-edge-gateway'], ['Composite', 'composite-device-gateway']]) {
    const f = mountFixture(kind, provider, false, {}, original); await flush();
    const s = f.state;
    if (kind.startsWith('Cloud/')) { s.current = 1; await s.next(); assert.equal(s.current, 1); }
    else if (kind === 'Composite') { s.handleNext(); assert.equal(s.stepCurrent, 0); s.choosenProviderList = Array.from({ length: 10 }, () => f.child); s.handleAdd(); assert.equal(s.providerListVisible, false); }
    else { s.current = 0; await s.next(); assert.equal(s.current, 0); }
    assert.equal(f.records.filter(r => r.url === '/gateway/device').length, 0);
    result[provider] = f.messages; f.app.unmount();
  }
  for (const provider of groups.Network) {
    const f = mountFixture('Network', provider, true, { bound: true }, original); await flush();
    const before = f.state.procotolCurrent; f.state.procotolChange('forbidden');
    assert.equal(f.state.procotolCurrent, before); assert.equal(f.state.showAddBtn, false);
    f.state.formData.name = ''; f.state.saveData(); await flush();
    assert.equal(f.records.filter(r => r.url === '/gateway/device').length, 0);
    f.state.formData.name = 'a'.repeat(65); f.state.saveData(); await flush();
    assert.equal(f.records.filter(r => r.url === '/gateway/device').length, 0);
    result[`${provider}:validation`] = true; f.app.unmount();
  }
  return result;
}

async function main() {
  const original = process.argv.includes('--baseline');
  const results = {};
  for (const [kind, providers] of Object.entries(groups)) for (const provider of providers) {
    for (const editing of [false, true]) {
      const modes = [{}, { failure: true }];
      if (provider.startsWith('agent-')) modes.push({ networkType: 'MQTT_SERVER' });
      if (provider === 'gb28181-2016') modes.push({ independent: true });
      if (['Network', 'Plugin', 'Edge/geteway'].includes(kind)) modes.push({ query: { provider: '{"id":"parent"}' } });
      if (['fixed-media', 'onvif'].includes(provider)) modes.push({ query: { save: 'true', sourceId: 'fixture-source' } });
      for (let i = 0; i < modes.length; i++) results[`${provider}/${editing ? 'edit' : 'add'}/${i}`] = await runCase(kind, provider, editing, modes[i], original);
    }
    console.log(`✓ ${provider}: 新增 / 编辑 / 失败${provider.startsWith('agent-') ? ' / HTTP+MQTT' : ''}`);
  }
  results.guards = await guards(original);
  const file = path.join(__dirname, 'save-baseline.json');
  if (original) fs.writeFileSync(file, JSON.stringify({ revision: BASELINE_REV, results }, null, 2) + '\n');
  else { const baseline = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(baseline.revision, BASELINE_REV); assert.deepEqual(results, baseline.results); }
  console.log(`${original ? '基线已生成' : '请求与回调完全匹配基线'}: 24 类型，${Object.keys(results).length - 1} 个保存用例，必填/长度/选择/绑定/复合数量校验通过。`);
}
module.exports = { runCase, mountFixture, flush };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
