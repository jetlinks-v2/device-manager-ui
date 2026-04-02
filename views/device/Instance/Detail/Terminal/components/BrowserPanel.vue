<template>
  <div class="browser-panel">
    <a-tabs
      v-model:activeKey="activeBrowserTabKey"
      type="editable-card"
      @edit="onBrowserTabEdit"
      :destroyInactiveTabPane="false"
      :animated="false"
      :forceRender="true"
    >
      <a-tab-pane v-for="tab in browserTabs" :key="tab.key" :tab="tab.title">
        <div class="browser-toolbar">
          <div class="browser-url-group">
            <a-auto-complete
              v-model:value="tab.inputUrl"
              :options="getBrowserHistoryOptions(tab.inputUrl)"
              @select="(value) => onBrowserHistorySelect(tab.key, value)"
              class="browser-url-auto"
              style="width: 100%"
            >
              <a-input
                class="browser-url-input"
                :value="tab.inputUrl"
                :placeholder="$t('Terminal.index.remote-2')"
                @update:value="(value) => onBrowserInputChange(tab.key, value)"
                @focus="onBrowserInputFocus(tab.key)"
                @blur="onBrowserInputBlur(tab.key)"
                @pressEnter="handleOpenBrowser(tab.key)"
              />
            </a-auto-complete>
            <a-button
              class="browser-url-visit"
              size="small"
              type="primary"
              :loading="tab.loading"
              @click="handleOpenBrowser(tab.key)"
            >
              {{ $t('Terminal.index.remote-3') }}
            </a-button>
          </div>
          <div class="browser-toolbar-actions">
            <a-button size="small" :loading="tab.loading" @click="handleOpenNewWindow(tab.key)">
              {{ $t('Terminal.index.remote-8') }}
            </a-button>
            <a-button size="small" type="link" @click="clearBrowserHistory">
              {{ $t('Terminal.index.remote-19') }}
            </a-button>
          </div>
        </div>
        <div class="browser-content">
          <div v-if="showBrowserMask(tab)" class="browser-mask">
            <div class="browser-mask-title">{{ $t('Terminal.index.remote-9') }}</div>
            <div class="browser-mask-desc">{{ $t('Terminal.index.remote-10') }}</div>
          </div>
          <div v-else-if="tab.error" class="browser-empty">
            <a-empty :description="tab.error" />
          </div>
          <iframe
            v-else
            :key="tab.frameRenderKey"
            :ref="(el) => setBrowserIframeRef(el, tab.key)"
            :src="tab.frameUrl"
            class="browser-iframe"
            @load="handleBrowserFrameLoad(tab.key)"
          />
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { randomString, onlyMessage } from '@jetlinks-web/utils'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { getRemoteProxyUrl } from '../../../../../../api/instance'
import { useI18n } from 'vue-i18n'

type BrowserTabState = {
  key: string
  title: string
  inputUrl: string
  frameUrl: string
  frameRenderKey: number
  error: string
  targetOrigin: string
  proxyBaseUrl: string
  loading: boolean
  isEditing: boolean
  syncLocked: boolean
}

const props = defineProps<{
  deviceId: string
}>()

const { t: $t } = useI18n()
const proxyKey = ref('')
const browserHistory = ref<string[]>([])
const browserIframeRefs = ref<Record<string, HTMLIFrameElement>>({})
const REMOTE_HISTORY_KEY = 'device_terminal_remote_browser_history'

const createBrowserTab = (): BrowserTabState => ({
  key: randomString(8),
  title: $t('Terminal.index.remote-20') as string,
  inputUrl: '',
  frameUrl: '',
  frameRenderKey: 0,
  error: '',
  targetOrigin: '',
  proxyBaseUrl: '',
  loading: false,
  isEditing: false,
  syncLocked: false
})

const browserTabs = ref<BrowserTabState[]>([createBrowserTab()])
const activeBrowserTabKey = ref(browserTabs.value[0].key)
const showBrowserMask = (tab: BrowserTabState) => !tab.frameUrl && !tab.error
const getBrowserHistoryOptions = (inputUrl: string) => {
  const text = inputUrl.trim().toLowerCase()
  return browserHistory.value
    .filter((item) => !text || item.toLowerCase().includes(text))
    .map((item) => ({ value: item }))
}

let browserUrlSyncTimer: ReturnType<typeof setInterval> | null = null
const browserLoadTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const browserDetectPending: Record<string, boolean> = {}

const getBrowserTab = (key?: string) => {
  const targetKey = key || activeBrowserTabKey.value
  return browserTabs.value.find((item) => item.key === targetKey)
}

const addBrowserTab = () => {
  const tab = createBrowserTab()
  browserTabs.value.push(tab)
  activeBrowserTabKey.value = tab.key
}

const removeBrowserTab = (key: string) => {
  if (browserTabs.value.length === 1) return
  clearBrowserLoadDetect(key)
  delete browserIframeRefs.value[key]
  const idx = browserTabs.value.findIndex((item) => item.key === key)
  browserTabs.value = browserTabs.value.filter((item) => item.key !== key)
  if (activeBrowserTabKey.value === key) {
    const next = browserTabs.value[Math.max(0, idx - 1)] || browserTabs.value[0]
    activeBrowserTabKey.value = next.key
  }
}

const onBrowserTabEdit = (targetKey: string | MouseEvent, action: 'add' | 'remove') => {
  if (action === 'add') return addBrowserTab()
  if (typeof targetKey === 'string') removeBrowserTab(targetKey)
}

const setBrowserIframeRef = (el: any, key: string) => {
  if (el) browserIframeRefs.value[key] = el as HTMLIFrameElement
  else delete browserIframeRefs.value[key]
}

const getEncodedRemoteOrigin = (url: URL) => window.btoa(`${url.protocol}//${url.host}`)
const buildProxyBaseUrl = (targetUrl: URL) => {
  if (!props.deviceId || !proxyKey.value) return ''
  const apiBase = getBaseApi()
  const encodedOrigin = getEncodedRemoteOrigin(targetUrl)
  return `${window.location.origin}${apiBase}/edge/device/${props.deviceId}/_proxy/${proxyKey.value}/${encodedOrigin}/`
}

const buildRemoteFrameUrl = (targetUrl: URL, tab: BrowserTabState) => {
  const base = buildProxyBaseUrl(targetUrl)
  if (!base) return ''
  tab.proxyBaseUrl = base
  const pathname = targetUrl.pathname.replace(/^\/+/, '')
  return `${base}${pathname}${targetUrl.search}${targetUrl.hash}`
}

const resolveTargetUrlFromProxyUrl = (proxyUrl: string, fallbackOrigin = '') => {
  try {
    const loaded = new URL(proxyUrl, window.location.origin)
    const parts = loaded.pathname.split('/').filter(Boolean)
    const proxyIndex = parts.findIndex((item) => item === '_proxy')
    if (proxyIndex === -1 || parts.length < proxyIndex + 3) return ''
    const encodedOrigin = parts[proxyIndex + 2]
    const targetOrigin = window.atob(encodedOrigin || '') || fallbackOrigin
    const relativePath = parts.slice(proxyIndex + 3).join('/')
    return `${targetOrigin}/${relativePath}${loaded.search}${loaded.hash}`
  } catch (_e) {
    return ''
  }
}

const normalizeUrlForCompare = (url: string) => {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}${parsed.hash}`
  } catch (_e) {
    return url.trim()
  }
}
const shouldSyncInputUrl = (currentUrl: string, nextUrl: string) => {
  if (!nextUrl) return false
  return normalizeUrlForCompare(currentUrl) !== normalizeUrlForCompare(nextUrl)
}
const normalizeInputToUrl = (raw: string) => {
  const value = raw.trim()
  if (!value) return value
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) return value
  return `http://${value}`
}
const getInputRelativeUrl = (tab: BrowserTabState) => {
  try {
    const u = new URL(normalizeInputToUrl(tab.inputUrl))
    const p = (u.pathname || '/').replace(/^\/+/, '')
    return `${p}${u.search}${u.hash}`
  } catch (_e) {
    return ''
  }
}

const clearBrowserLoadDetect = (key?: string) => {
  if (key) {
    if (browserLoadTimers[key]) {
      clearTimeout(browserLoadTimers[key])
      delete browserLoadTimers[key]
    }
    delete browserDetectPending[key]
    return
  }
  Object.keys(browserLoadTimers).forEach((k) => {
    clearTimeout(browserLoadTimers[k])
    delete browserLoadTimers[k]
    delete browserDetectPending[k]
  })
}

const startBrowserLoadDetect = (key: string) => {
  const tab = getBrowserTab(key)
  if (!tab) return
  clearBrowserLoadDetect(key)
  browserDetectPending[key] = true
  browserLoadTimers[key] = setTimeout(() => {
    if (tab.loading) {
      tab.error = $t('Terminal.index.remote-17') as string
      tab.loading = false
      onlyMessage($t('Terminal.index.remote-17') as string, 'error')
    }
    browserDetectPending[key] = false
  }, 12000)
}

const clearBrowserUrlSync = () => {
  if (browserUrlSyncTimer) {
    clearInterval(browserUrlSyncTimer)
    browserUrlSyncTimer = null
  }
}

const syncIframeActualUrl = (tab: BrowserTabState) => {
  const iframe = browserIframeRefs.value[tab.key]
  if (!iframe) return
  try {
    const href = iframe.contentWindow?.location?.href
    if (!href) return
    if (!href.includes('/_proxy/') && tab.proxyBaseUrl) {
      const relative = getInputRelativeUrl(tab)
      const nextSrc = `${tab.proxyBaseUrl}${relative}`
      if (nextSrc !== tab.frameUrl) {
        iframe.setAttribute('src', nextSrc)
        tab.frameUrl = nextSrc
        tab.loading = true
        startBrowserLoadDetect(tab.key)
      }
      return
    }
    const mapped = resolveTargetUrlFromProxyUrl(href, tab.targetOrigin)
    if (mapped && !tab.isEditing && !tab.syncLocked && shouldSyncInputUrl(tab.inputUrl, mapped)) {
      tab.inputUrl = mapped
    }
  } catch (_e) {}
}

const startBrowserUrlSync = () => {
  clearBrowserUrlSync()
  browserUrlSyncTimer = setInterval(() => {
    browserTabs.value.forEach((tab) => syncIframeActualUrl(tab))
  }, 600)
}

const ensureProxyKey = async (force = false) => {
  if (!props.deviceId) return
  if (!force && proxyKey.value) return
  const resp = await getRemoteProxyUrl(props.deviceId)
  proxyKey.value = resp?.result || ''
}

const saveBrowserHistory = (url: string) => {
  if (!url) return
  const next = [url, ...browserHistory.value.filter((item) => item !== url)].slice(0, 20)
  browserHistory.value = next
  localStorage.setItem(REMOTE_HISTORY_KEY, JSON.stringify(next))
}

const clearBrowserHistory = () => {
  browserHistory.value = []
  localStorage.removeItem(REMOTE_HISTORY_KEY)
}

const onBrowserInputFocus = (key: string) => {
  const tab = getBrowserTab(key)
  if (tab) tab.isEditing = true
}
const onBrowserInputBlur = (key: string) => {
  const tab = getBrowserTab(key)
  if (tab) {
    setTimeout(() => {
      tab.isEditing = false
    }, 120)
  }
}
const onBrowserInputChange = (key: string, value: string) => {
  const tab = getBrowserTab(key)
  if (!tab) return
  tab.inputUrl = value
  if (tab.isEditing) tab.syncLocked = true
}
const onBrowserHistorySelect = (key: string, value: string) => {
  const tab = getBrowserTab(key)
  if (!tab) return
  tab.inputUrl = value
  tab.isEditing = false
  tab.syncLocked = false
  handleOpenBrowser(key)
}

const parseInputUrl = (tab: BrowserTabState) => {
  const raw = normalizeInputToUrl(tab.inputUrl)
  if (!raw) {
    onlyMessage($t('Terminal.index.remote-4') as string)
    return null
  }
  tab.inputUrl = raw
  const targetUrl = new URL(raw)
  if (!/^https?:$/.test(targetUrl.protocol)) {
    tab.error = $t('Terminal.index.remote-5') as string
    return null
  }
  return targetUrl
}

const handleOpenBrowser = async (key?: string) => {
  const tab = getBrowserTab(key)
  if (!tab) return
  try {
    tab.isEditing = false
    tab.syncLocked = false
    tab.loading = true
    tab.error = ''
    const targetUrl = parseInputUrl(tab)
    if (!targetUrl) {
      tab.loading = false
      return
    }
    // 每次点击「访问」都强制重新申请密钥，避免旧 key 过期后无法刷新
    await ensureProxyKey(true)
    if (!proxyKey.value) {
      tab.error = $t('Terminal.index.remote-6') as string
      tab.loading = false
      return
    }
    saveBrowserHistory(targetUrl.href)
    tab.inputUrl = targetUrl.href
    tab.targetOrigin = `${targetUrl.protocol}//${targetUrl.host}`
    tab.title = targetUrl.host
    const nextFrameUrl = buildRemoteFrameUrl(targetUrl, tab)
    if (nextFrameUrl === tab.frameUrl) {
      tab.frameRenderKey += 1
      await nextTick()
      const iframe = browserIframeRefs.value[tab.key]
      if (iframe) iframe.setAttribute('src', nextFrameUrl)
      startBrowserLoadDetect(tab.key)
      return
    }
    tab.frameUrl = nextFrameUrl
    startBrowserLoadDetect(tab.key)
  } catch (_e) {
    tab.error = $t('Terminal.index.remote-7') as string
    tab.loading = false
  }
}

const handleOpenNewWindow = async (key?: string) => {
  const tab = getBrowserTab(key)
  if (!tab) return
  try {
    const iframe = browserIframeRefs.value[tab.key]
    const currentFrameProxyUrl = iframe?.contentWindow?.location?.href
    if (currentFrameProxyUrl && currentFrameProxyUrl.includes('/_proxy/')) {
      window.open(currentFrameProxyUrl, '_blank')
      return
    }
    const targetUrl = parseInputUrl(tab)
    if (!targetUrl) return
    await ensureProxyKey(true)
    if (!proxyKey.value) {
      tab.error = $t('Terminal.index.remote-6') as string
      return
    }
    saveBrowserHistory(targetUrl.href)
    tab.inputUrl = targetUrl.href
    tab.targetOrigin = `${targetUrl.protocol}//${targetUrl.host}`
    tab.title = targetUrl.host
    window.open(buildRemoteFrameUrl(targetUrl, tab), '_blank')
  } catch (_e) {
    tab.error = $t('Terminal.index.remote-7') as string
  }
}

const handleBrowserFrameLoad = (key: string) => {
  const tab = getBrowserTab(key)
  const iframe = browserIframeRefs.value[key]
  if (!tab || !iframe) return
  try {
    tab.loading = false
    if (browserDetectPending[key]) {
      onlyMessage($t('Terminal.index.remote-18') as string, 'success')
      browserDetectPending[key] = false
    }
    clearBrowserLoadDetect(key)
    const loadedHref = iframe.contentWindow?.location?.href || ''
    const src = iframe.getAttribute('src') || tab.frameUrl
    if (!src || !loadedHref) return
    const currentPath = (iframe.contentWindow?.location?.pathname || '').replace(/^\/+/, '')
    const currentSearch = iframe.contentWindow?.location?.search || ''
    const currentHash = iframe.contentWindow?.location?.hash || ''

    if (!loadedHref.includes('/_proxy/') && tab.proxyBaseUrl) {
      const relative = getInputRelativeUrl(tab) || `${currentPath}${currentSearch}${currentHash}`
      const nextSrc = `${tab.proxyBaseUrl}${relative}`
      iframe.setAttribute('src', nextSrc)
      tab.frameUrl = nextSrc
      tab.loading = true
      startBrowserLoadDetect(key)
      return
    }

    if (!loadedHref.startsWith(src)) {
      const srcPrefix = src.split('/').slice(0, 7).join('/')
      const hrefPrefix = loadedHref.split('/').slice(0, 7).join('/')
      if (srcPrefix !== hrefPrefix) {
        const nextSrc = `${tab.proxyBaseUrl || src}${currentPath}${currentSearch}${currentHash}`
        iframe.setAttribute('src', nextSrc)
        tab.frameUrl = nextSrc
        tab.loading = true
        startBrowserLoadDetect(key)
        return
      }
    }

    const targetUrl = resolveTargetUrlFromProxyUrl(loadedHref, tab.targetOrigin)
    if (targetUrl) {
      if (!tab.isEditing && !tab.syncLocked && shouldSyncInputUrl(tab.inputUrl, targetUrl)) {
        tab.inputUrl = targetUrl
      }
      saveBrowserHistory(targetUrl)
    }
  } catch (_e) {
    tab.loading = false
    clearBrowserLoadDetect(key)
  }
}

onMounted(() => {
  const localHistory = localStorage.getItem(REMOTE_HISTORY_KEY)
  if (localHistory) {
    try {
      const list = JSON.parse(localHistory)
      if (Array.isArray(list)) browserHistory.value = list.filter((item) => typeof item === 'string')
    } catch (_e) {
      browserHistory.value = []
    }
  }
  startBrowserUrlSync()
})

onBeforeUnmount(() => {
  clearBrowserLoadDetect()
  clearBrowserUrlSync()
})
</script>

<style scoped lang="less">
.browser-panel {
  height: 100%;
  min-height: 0;
}

.browser-panel :deep(.ant-tabs) {
  height: 100%;
}

.browser-panel :deep(.ant-tabs-content-holder) {
  height: 100%;
}

.browser-panel :deep(.ant-tabs-content) {
  height: 100%;
}

.browser-panel :deep(.ant-tabs-tabpane) {
  height: 100%;
}

.browser-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
  margin-top: 8px;
  align-items: center;
  padding-left: 12px;
  padding-right: 12px;
}

.browser-url-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
}

.browser-url-auto {
  flex: 1;
  min-width: 0;
}

.browser-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.browser-url-visit {
  margin-left: -1px;
  height: 32px;
}

.browser-url-input :deep(.ant-input) {
  height: 32px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.browser-url-auto :deep(.ant-auto-complete) {
  width: 100%;
}

.browser-url-input :deep(.ant-input-group-addon) {
  border: none;
}

.browser-url-visit :deep(.ant-btn) {
  height: 32px;
  padding: 0 12px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.browser-content {
  height: calc(100vh - 290px);
  min-height: 420px;
  position: relative;
  border: none;
  border-radius: 0;
  overflow: hidden;
  background-color: #fff;
}

/* 去重边框：editable-card Tabs 自带 card 边框，避免与内容容器 border/radius 叠加 */
.browser-panel :deep(.ant-tabs-card) {
  border: none !important;
  box-shadow: none !important;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav),
.browser-panel :deep(.ant-tabs-card > .ant-tabs-content-holder) {
  border: none !important;
  background: transparent !important;
}

.browser-panel :deep(.ant-tabs-card .ant-tabs-tabpane) {
  background: transparent !important;
}

/* 单一分隔线，避免双线 */
.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav::before) {
  border-bottom: none !important;
}

/* 优化 editable-card tab 尺寸/间距（减少顶部留白、tab 更紧凑） */
.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav) {
  margin-bottom: 0;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-nav-list) {
  gap: 0;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab) {
  padding: 6px 14px !important;
  margin-right: 0 !important;
  height: 30px !important;
  line-height: 22px !important;
  border-radius: 8px 8px 0 0;
  border: none !important;
  background: rgba(250, 250, 250, 0.65) !important;
  box-shadow: inset 0 -1px 0 #f0f0f0 !important;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-btn) {
  font-size: 14px !important;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-nav-add) {
  padding: 0 !important;
  width: 32px !important;
  height: 30px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  margin-right: 0 !important;
  border: none !important;
}

/* 激活态：只用底部内描边区分，避免双线/叠边 */
.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active) {
  background: #fff !important;
  border: none !important;
  box-shadow: inset 0 -2px 0 #1677ff !important;
  position: relative;
  z-index: 1;
}

.browser-panel :deep(.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #1677ff !important;
}

.browser-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.browser-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.browser-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(250, 250, 250, 0.95) 0%, rgba(245, 245, 245, 0.98) 100%);
}

.browser-mask-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.browser-mask-desc {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
