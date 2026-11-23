import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(join(runtimeRoot, 'package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const { default: vue } = await import(pathToFileURL(require.resolve('@vitejs/plugin-vue')).href)
const { default: autoImport } = await import(pathToFileURL(require.resolve('unplugin-auto-import/vite')).href)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const reviewRoot = resolve(process.env.PAGE_REVIEW_ROOT || 'D:/CodexData/page-review/metadata-popover-mask')
await mkdir(reviewRoot, { recursive: true })
const profile = await mkdtemp(join(reviewRoot, 'profile-'))
const artifacts = join(reviewRoot, 'artifacts')
await mkdir(artifacts, { recursive: true })

// 使用真实共用弹层与数组类型下拉，在带变换、层叠上下文的详情容器中复现。
const entry = `
import { createApp, defineComponent, h, nextTick, provide, ref } from 'vue'
import Antd, { Button } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import Popover from '/modules/device-manager-ui/components/Metadata/components/Popover/index.vue'
import TypeSelect from '/modules/device-manager-ui/components/Metadata/components/Array/ArrayTypeSelect.vue'
import { FULL_SCREEN, TABLE_WRAPPER } from '/modules/device-manager-ui/components/Metadata/consts.ts'
const table = ref(), fullscreen = ref(false), mounted = ref(true), open = ref(false), child = ref(false), type = ref('int')
document.addEventListener('fullscreenchange', () => fullscreen.value = !!document.fullscreenElement)
window.fixture = { open, child, mounted, type, fullscreen, nextTick }
const Popup = defineComponent({ setup() {
  return () => h(Popover, { visible: open.value, placement: 'bottomRight',
    'onUpdate:visible': v => open.value = v, onOk: () => open.value = false }, {
    default: () => h(Button, { id: 'edit-type' }, () => '编辑数据类型'),
    content: () => h('section', { style: 'width:450px;padding:12px' }, [
      h('label', '数据类型'), h(TypeSelect, { value: type.value, data: {}, 'onUpdate:value': v => type.value = v }),
      h(Popover, { visible: child.value, placement: 'bottomRight',
        'onUpdate:visible': v => child.value = v, onOk: () => child.value = false }, {
        default: () => h(Button, { id: 'edit-child' }, () => '嵌套编辑'),
        content: () => h('div', { style: 'width:250px;padding:12px' }, '嵌套数据类型配置')
      })
    ])
  })
} })
const app = createApp({ setup() {
  provide(TABLE_WRAPPER, table); provide(FULL_SCREEN, fullscreen)
  return () => h('div', [
    h('header', { id: 'header', style: 'position:fixed;top:0;left:0;right:0;height:64px;background:#eef5ff;z-index:100' }, '物联网平台 · 顶部导航'),
    h('aside', { id: 'sidebar', style: 'position:fixed;top:64px;bottom:0;left:0;width:220px;background:#edf2fa;z-index:100' }, '资源中心 · 设备管理'),
    h('main', { style: 'margin:100px 24px 0 250px;transform:translateZ(0);backdrop-filter:blur(10px)' }, [
      h('h2', '产品 / 设备详情 · 物模型'),
      h('div', { ref: table, style: 'padding:80px 40px;background:#fff;position:relative;min-height:400px' }, [
        h(Button, { id: 'fullscreen', onClick: () => table.value.requestFullscreen() }, () => '全屏'),
        mounted.value ? h(Popup) : null
      ])
    ])
  ])
} })
app.use(Antd); app.config.globalProperties.$t = key => ({ 'Popover.index.047673-0': '取消', 'Popover.index.047673-1': '确认' }[key] || key)
app.mount('#app')
`
let server, browser
const errors = [], checks = []
try {
  server = await createServer({
    root: runtimeRoot, configFile: false, cacheDir: join(reviewRoot, 'vite-cache'), logLevel: 'error',
    esbuild: { tsconfigRaw: { compilerOptions: {} } },
    plugins: [vue(), autoImport({ imports: ['vue'], dts: false }), {
      name: 'metadata-popover-fixture',
      resolveId(id) {
        if (id === '/metadata-review.js') return '\0fixture'
        if (id === '@jetlinks-web-core/locales') return '\0locales'
      },
      load(id) {
        if (id === '\0fixture') return entry
        if (id === '\0locales') return 'export default { global: { t: key => key } }'
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== '/') return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<!doctype html><html><body style="margin:0;background:#f5f7fa;color:#202632"><div id="app"></div><script type="module" src="/metadata-review.js"></script></body></html>')
        })
      }
    }],
    server: { host: '127.0.0.1', port: 0, watch: null },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'ant-design-vue', 'ant-design-vue/lib/select', 'lodash-es', '@jetlinks-web/utils'] }
  })
  await server.listen()
  console.log('Review server ready')
  browser = await chromium.launchPersistentContext(profile, {
    channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 },
    acceptDownloads: false, downloadsPath: join(profile, 'downloads'),
    args: ['--disk-cache-dir=' + join(profile, 'cache')]
  })
  const page = await browser.newPage()
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { timeout: 60000, waitUntil: 'commit' })
  await page.locator('#edit-type').waitFor({ timeout: 60000 })
  const masks = page.locator('[id^="popover-mask-"]:visible')
  const popovers = page.locator('.metadata-table-popover-warp:visible')
  async function assertMask() {
    await masks.waitFor()
    const result = await masks.evaluate(el => {
      const r = el.getBoundingClientRect()
      const host = document.fullscreenElement || document.body
      let ancestor = el.parentElement, container = host.contains(el)
      while (ancestor && ancestor !== host) {
        const style = getComputedStyle(ancestor)
        if (style.transform !== 'none' || style.backdropFilter !== 'none') container = false
        ancestor = ancestor.parentElement
      }
      return { left: r.left, top: r.top, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
        blocksHeader: document.elementFromPoint(20, 20) === el,
        blocksSidebar: document.elementFromPoint(20, 200) === el,
        container }
    })
    assert.deepEqual(result, { left: 0, top: 0, width: 1440, height: 900, viewportWidth: 1440, viewportHeight: 900,
      blocksHeader: true, blocksSidebar: true, container: true })
    assert.equal(await popovers.last().locator('button').last().isEnabled(), true)
  }
  await page.locator('#edit-type').click()
  await assertMask()
  await page.screenshot({ path: join(artifacts, 'normal.png') })
  checks.push('遮罩覆盖视口并阻挡顶部导航、侧栏')
  await popovers.locator('.ant-select').click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'long(' }).click()
  assert.equal(await page.evaluate(() => window.fixture.type.value), 'long')
  checks.push('弹层内真实类型下拉可见且可选')
  await page.locator('#edit-child').click()
  await page.waitForFunction(() => document.querySelectorAll('[id^="popover-mask-"]').length === 2)
  await assertMask()
  assert.equal(await popovers.count(), 2)
  await page.screenshot({ path: join(artifacts, 'nested.png') })
  await popovers.last().getByRole('button', { name: /取\s*消/ }).click()
  await assertMask()
  await popovers.first().getByRole('button', { name: /确\s*认/ }).click()
  await page.waitForFunction(() => !document.querySelector('[id^="popover-mask-"]'))
  checks.push('嵌套弹层关闭恢复上一层遮罩；确认后清除遮罩')
  await page.locator('#fullscreen').click()
  await page.waitForFunction(() => !!document.fullscreenElement)
  await page.locator('#edit-type').click()
  await assertMask()
  await page.screenshot({ path: join(artifacts, 'fullscreen.png') })
  await popovers.getByRole('button', { name: /取\s*消/ }).click()
  await popovers.waitFor({ state: 'hidden' })
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !window.fixture.fullscreen.value)
  checks.push('原生全屏中弹层和遮罩保持可见、可操作')
  await page.evaluate(async () => {
    window.fixture.open.value = true; await window.fixture.nextTick()
    window.fixture.open.value = false; await window.fixture.nextTick()
  })
  await page.waitForTimeout(250)
  assert.equal(await masks.count(), 0)
  checks.push('快速开关不会延迟残留遮罩')
  await page.locator('#edit-type').click()
  await assertMask()
  await page.evaluate(() => window.fixture.mounted.value = false)
  await page.waitForFunction(() => !document.querySelector('[id^="popover-mask-"]'))
  checks.push('组件卸载清除全局遮罩')
  assert.deepEqual(errors, [])
  await writeFile(join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors, artifacts }, null, 2))
} finally {
  try { await browser?.close() } finally { await server?.close() }
  const absoluteProfile = await realpath(profile)
  const absoluteRoot = await realpath(reviewRoot)
  if (!absoluteProfile.toLowerCase().startsWith((absoluteRoot + sep).toLowerCase())) throw new Error('Unexpected profile directory')
  await rm(absoluteProfile, { recursive: true, force: true })
}
