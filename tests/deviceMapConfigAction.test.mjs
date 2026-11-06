import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { transformSync } from 'esbuild';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createSSRApp, h, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createI18n } from 'vue-i18n';
import { makeAction, makeCloudEmpty } from '../../../jetlinks-web-core/tests/amapTestComponents.mjs';

const require = createRequire(import.meta.url);
const file = new URL('../visDashboard/DeviceManagement/DeviceMapCard/DeviceMapCard.vue', import.meta.url);
const parsed = parse(readFileSync(file, 'utf8'), { filename: file.pathname });
assert.deepEqual(parsed.errors, []);
const code = transformSync(compileScript(parsed.descriptor, { id: 'device-map', inlineTemplate: true }).content, { loader: 'ts', format: 'cjs' }).code;
const zh = JSON.parse(readFileSync(new URL('../../../jetlinks-web-core/src/locales/lang/zh.json', import.meta.url), 'utf8'));
const component = text => ({ setup: () => () => h('div', text) });
async function render(amap, distribution = false, allowed = true) {
  const action = makeAction(allowed).action;
  const dependencies = {
    '@jetlinks-web-core/components/CloudEmpty/index.vue': { __esModule: true, default: makeCloudEmpty() },
    '@jetlinks-web-core/components': { AMapConfigAction: action },
    '@vuemap/vue-amap': { ElAmapMarkerCluster: component('cluster') },
    '@jetlinks-web-core/store/system': { useSystemStore: () => ({ systemInfo: { amap } }) },
    '../components/SectionHeader.vue': { __esModule: true, default: component('header') },
    './DeviceMapSelectionCard.vue': { __esModule: true, default: component('selection') },
    './DeviceDistributionMap.vue': { __esModule: true, default: component('distribution-map') },
    './distribution': { distributionColors: {}, distributionState: () => 'online' },
    '../hooks/useDeviceMap': { useDeviceMap: () => ({ config: ref({ embedded: true }), distribution: ref(distribution), points: ref([]), loading: ref(false), error: ref(null), extraOptions: {}, selection: {}, refresh() {}, onMapInit() {}, onClusterClick() {}, onPointSelect() {} }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => dependencies[id] ?? require(id), module, module.exports);
  const app = createSSRApp(module.exports.default);
  app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh }, flatJson: true, missingWarn: false }));
  app.component('AButton', component('button'));
  app.component('AAlert', component('alert'));
  app.component('ASpin', { setup: (_, { slots }) => () => h('div', slots.default?.()) });
  app.component('AEmpty', { props: ['description'], setup: (props, { slots }) => () => h('div', [props.description, slots.default?.()]) });
  app.component('AMapComponent', component('amap-rendered'));
  return renderToString(app);
}
test('device map missing and blank credentials show actual configuration action', async () => {
  for (const amap of [{ secretKey: 'secret' }, { apiKey: 'key' }, { apiKey: '  ', secretKey: 'secret' }, { apiKey: 'key', secretKey: '  ' }]) {
    const html = await render(amap);
    assert.match(html, /前往基础配置/);
    assert.doesNotMatch(html, /amap-rendered/);
  }
  assert.match(await render({}, false, false), /联系管理员/);
});
test('configured map and distribution mode do not show configuration action', async () => {
  const configured = await render({ apiKey: 'key', secretKey: 'secret' });
  assert.match(configured, /amap-rendered/);
  assert.doesNotMatch(configured, /前往基础配置|联系管理员/);
  const distribution = await render({}, true);
  assert.match(distribution, /distribution-map/);
  assert.doesNotMatch(distribution, /前往基础配置|联系管理员/);
});
