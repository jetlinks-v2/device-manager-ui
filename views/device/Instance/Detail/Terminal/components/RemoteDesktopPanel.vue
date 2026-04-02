<template>
  <div class="remote-desktop-panel">
    <div ref="contentRef" class="remote-desktop-content">
      <div v-if="!online" class="remote-desktop-mask">
        <div class="remote-desktop-mask-title">{{ $t('Terminal.index.remote-31') }}</div>
      </div>
      <div
        v-show="online"
        ref="screenContainerRef"
        class="remote-desktop-screen"
        :class="{ 'is-scroll-mode': viewMode === 'scroll' && connected }"
      />
      <!-- 未连接：画面中上部展示地址与连接 -->
      <div v-if="online && !connected" class="addr-os-panel">
        <div class="addr-os-card">
          <div class="addr-os-header">
            <div class="addr-os-avatar">
              <AIcon type="DesktopOutlined" />
            </div>
            <span class="addr-os-title">{{ $t('Terminal.index.remote-51') }}</span>
          </div>
          <div class="addr-os-row">
            <input
              v-model.trim="vncHost"
              type="text"
              class="addr-os-input"
              :placeholder="$t('Terminal.index.remote-26')"
              :disabled="connecting"
              autocomplete="off"
              spellcheck="false"
            />
            <span class="addr-os-sep">:</span>
            <input
              v-model.number="vncPort"
              type="number"
              min="1"
              max="65535"
              class="addr-os-input addr-os-port"
              :placeholder="$t('Terminal.index.remote-27')"
              :disabled="connecting"
            />
          </div>
          <div class="addr-os-footer">
            <a-tooltip :title="$t('Terminal.index.remote-48')">
              <button type="button" class="addr-os-icon-btn" tabindex="-1">
                <AIcon type="QuestionCircleOutlined" />
              </button>
            </a-tooltip>
            <button
              type="button"
              class="addr-os-btn addr-os-btn-primary"
              :disabled="!canConnect || connecting"
              @click="handleConnect"
            >
              {{ connecting ? '…' : $t('Terminal.index.remote-28') }}
            </button>
          </div>
        </div>
      </div>
      <!-- 已连接：右上角单按钮，按住拖动 / 点击展开（全屏、缩放、关闭） -->
      <div
        v-if="online && connected"
        ref="dockRef"
        class="remote-desktop-dock"
        :style="dockStyle"
      >
        <a-tooltip :title="dockExpanded ? $t('Terminal.index.remote-57') : $t('Terminal.index.remote-56')">
          <button
            type="button"
            class="dock-trigger"
            @pointerdown="onDockPointerDown"
            @click.prevent
          >
            <AIcon :type="dockExpanded ? 'MenuFoldOutlined' : 'ControlOutlined'" />
          </button>
        </a-tooltip>
        <Transition name="dock-slide">
          <div v-show="dockExpanded" class="dock-panel" @pointerdown.stop>
            <div class="dock-toolbar" role="toolbar">
              <div class="dock-toolbar-group">
                <a-tooltip :title="$t('Terminal.index.remote-46-hint')">
                  <button
                    type="button"
                    class="screen-tool-btn"
                    :class="{ 'is-active': viewMode === 'fit' }"
                    :aria-pressed="viewMode === 'fit'"
                    @click="viewMode = 'fit'"
                  >
                    <AIcon type="ExpandOutlined" />
                  </button>
                </a-tooltip>
                <a-tooltip :title="$t('Terminal.index.remote-47-hint')">
                  <button
                    type="button"
                    class="screen-tool-btn"
                    :class="{ 'is-active': viewMode === 'scroll' }"
                    :aria-pressed="viewMode === 'scroll'"
                    @click="viewMode = 'scroll'"
                  >
                    <AIcon type="BorderOuterOutlined" />
                  </button>
                </a-tooltip>
              </div>
              <span class="dock-toolbar-divider" aria-hidden="true" />
              <div class="dock-toolbar-group">
                <a-tooltip :title="isFullscreen ? $t('Terminal.index.remote-42') : $t('Terminal.index.remote-41')">
                  <button type="button" class="screen-tool-btn" @click="toggleFullscreen">
                    <AIcon :type="isFullscreen ? 'FullscreenExitOutlined' : 'FullscreenOutlined'" />
                  </button>
                </a-tooltip>
                <a-tooltip :title="$t('Terminal.index.remote-52')">
                  <button
                    type="button"
                    class="screen-tool-btn screen-tool-btn-close"
                    :disabled="disconnecting"
                    @click="handleDisconnect"
                  >
                    <AIcon type="CloseOutlined" />
                  </button>
                </a-tooltip>
              </div>
            </div>
          </div>
        </Transition>
      </div>
      <!-- 认证：覆盖在远程画面上，样式接近系统登录 -->
      <Transition name="auth-fade">
        <div
          v-if="authModalVisible && online"
          class="auth-os-overlay"
          role="dialog"
          aria-modal="true"
          @keydown.esc.prevent="cancelCredentials"
        >
          <div class="auth-os-backdrop" />
          <div class="auth-os-card">
            <div class="auth-os-avatar-wrap">
              <div class="auth-os-avatar">
                <AIcon type="DesktopOutlined" />
              </div>
            </div>
            <div class="auth-os-title">{{ $t('Terminal.index.remote-35') }}</div>
            <p class="auth-os-desc">{{ $t('Terminal.index.remote-36') }}</p>
            <div class="auth-os-fields">
              <input
                v-if="needUsername"
                v-model="authUsername"
                type="text"
                class="auth-os-input"
                :placeholder="$t('Terminal.index.remote-37')"
                autocomplete="username"
                @keydown.enter.prevent="focusPasswordOrSubmit"
              />
              <input
                v-if="needPassword"
                ref="authPasswordInputRef"
                v-model="authPassword"
                type="password"
                class="auth-os-input"
                :placeholder="$t('Terminal.index.remote-38')"
                autocomplete="current-password"
                @keydown.enter.prevent="submitCredentials"
              />
            </div>
            <div class="auth-os-actions">
              <button type="button" class="auth-os-btn auth-os-btn-secondary" @click="cancelCredentials">
                {{ $t('Terminal.index.remote-43') }}
              </button>
              <button
                type="button"
                class="auth-os-btn auth-os-btn-primary"
                :disabled="authSubmitting"
                @click="submitCredentials"
              >
                {{ authSubmitting ? '…' : $t('Terminal.index.remote-44') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, onlyMessage } from '@jetlinks-web/utils'
import { getBaseApi } from '@jetlinks-web-core/utils'
import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import RFB from '@novnc/novnc/lib/rfb'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  deviceId: string
  online: boolean
}>()

const { t: $t } = useI18n()

const REMOTE_DESKTOP_TARGET_KEY = 'device_terminal_remote_desktop_target'
const VIEW_MODE_KEY = 'device_terminal_remote_desktop_view_mode'
const REMOTE_DESKTOP_DOCK_POS_KEY = 'device_terminal_remote_desktop_dock_pos'

const dockRef = ref<HTMLElement | null>(null)
const dockExpanded = ref(false)
/** 相对 remote-desktop-content 左上角；null 表示使用 CSS 默认右上 */
const dockPos = ref<{ left: number; top: number } | null>(null)

const DOCK_DRAG_THRESHOLD = 6
let dockPointer: {
  startX: number
  startY: number
  sl: number
  st: number
  dragging: boolean
  captureEl: HTMLElement
} | null = null

const dockStyle = computed(() => {
  if (!dockPos.value) {
    return { right: '16px', top: '16px', left: 'auto' as const }
  }
  return { left: `${dockPos.value.left}px`, top: `${dockPos.value.top}px`, right: 'auto' as const }
})
const vncHost = ref('127.0.0.1')
const vncPort = ref<number>(5900)
const connecting = ref(false)
const disconnecting = ref(false)
const connected = ref(false)
const authModalVisible = ref(false)
const authSubmitting = ref(false)
const authUsername = ref('')
const authPassword = ref('')
const credentialTypes = ref<string[]>([])
const screenContainerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const authPasswordInputRef = ref<HTMLInputElement | null>(null)
const isFullscreen = ref(false)
/** fit=缩放适应窗口；scroll=原始像素，过大则滚动条 */
const viewMode = ref<'fit' | 'scroll'>('fit')
let rfb: InstanceType<typeof RFB> | null = null
let resizeObserver: ResizeObserver | null = null
let contentResizeObserver: ResizeObserver | null = null
let visibilityObserver: IntersectionObserver | null = null
/** 设备切换、离线、卸载等主动断开时不提示「连接失败」 */
let suppressDisconnectError = false

const needUsername = computed(() => credentialTypes.value.includes('username'))
const needPassword = computed(() => credentialTypes.value.includes('password'))

const saveTarget = () => {
  const host = vncHost.value.trim()
  const port = Number(vncPort.value)
  if (!host || !Number.isFinite(port) || port < 1 || port > 65535) return
  localStorage.setItem(
    REMOTE_DESKTOP_TARGET_KEY,
    JSON.stringify({
      host,
      port
    })
  )
}

const loadViewMode = () => {
  const v = localStorage.getItem(VIEW_MODE_KEY)
  if (v === 'scroll' || v === 'fit') {
    viewMode.value = v
  }
}

const saveViewMode = () => {
  localStorage.setItem(VIEW_MODE_KEY, viewMode.value)
}

const applyViewMode = () => {
  if (!rfb) return
  if (viewMode.value === 'fit') {
    rfb.scaleViewport = true
    rfb.clipViewport = false
    rfb.resizeSession = true
  } else {
    rfb.scaleViewport = false
    rfb.clipViewport = false
    rfb.resizeSession = true
  }
  nextTick(() => onContainerResize())
}

const clampDockPositionValues = (left: number, top: number, pw: number, ph: number, dw: number, dh: number) => {
  const l = Math.max(8, Math.min(left, pw - dw - 8))
  const t = Math.max(8, Math.min(top, ph - dh - 8))
  return { left: l, top: t }
}

const clampDockPosition = () => {
  if (!contentRef.value || !dockRef.value || !dockPos.value) return
  const pr = contentRef.value.getBoundingClientRect()
  // v-show(display:none) 时 rect 可能为 0，避免把 dock 夹到错误的 left=8 之类位置
  if (pr.width <= 0 || pr.height <= 0) return
  const dr = dockRef.value.getBoundingClientRect()
  if (dr.width <= 0 || dr.height <= 0) return
  const c = clampDockPositionValues(dockPos.value.left, dockPos.value.top, pr.width, pr.height, dr.width, dr.height)
  if (c.left !== dockPos.value.left || c.top !== dockPos.value.top) {
    dockPos.value = c
  }
}

const loadDockPos = () => {
  const raw = localStorage.getItem(REMOTE_DESKTOP_DOCK_POS_KEY)
  if (!raw) return
  try {
    const p = JSON.parse(raw)
    if (typeof p.left === 'number' && typeof p.top === 'number') {
      dockPos.value = { left: p.left, top: p.top }
    }
  } catch (_e) {
    /* ignore */
  }
}

const saveDockPos = () => {
  if (dockPos.value) {
    localStorage.setItem(REMOTE_DESKTOP_DOCK_POS_KEY, JSON.stringify(dockPos.value))
  }
}

const onDockPointerMove = (e: PointerEvent) => {
  if (!dockPointer || !contentRef.value || !dockRef.value) return
  const dx = e.clientX - dockPointer.startX
  const dy = e.clientY - dockPointer.startY
  if (
    !dockPointer.dragging &&
    (Math.abs(dx) > DOCK_DRAG_THRESHOLD || Math.abs(dy) > DOCK_DRAG_THRESHOLD)
  ) {
    dockPointer.dragging = true
  }
  if (!dockPointer.dragging) return
  const pr = contentRef.value.getBoundingClientRect()
  const dr = dockRef.value.getBoundingClientRect()
  const nl = dockPointer.sl + dx
  const nt = dockPointer.st + dy
  dockPos.value = clampDockPositionValues(nl, nt, pr.width, pr.height, dr.width, dr.height)
}

const onDockPointerEnd = (e: PointerEvent) => {
  if (!dockPointer) return
  try {
    dockPointer.captureEl.releasePointerCapture(e.pointerId)
  } catch (_e) {
    /* ignore */
  }
  const dragged = dockPointer.dragging
  window.removeEventListener('pointermove', onDockPointerMove)
  window.removeEventListener('pointerup', onDockPointerEnd)
  dockPointer = null
  if (dragged) {
    saveDockPos()
  } else {
    dockExpanded.value = !dockExpanded.value
    nextTick(() => clampDockPosition())
  }
}

const onDockPointerDown = (e: PointerEvent) => {
  if (e.button !== 0) return
  const parent = contentRef.value
  const dock = dockRef.value
  if (!parent || !dock) return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const pr = parent.getBoundingClientRect()
  const dr = dock.getBoundingClientRect()
  let curLeft = dockPos.value?.left
  let curTop = dockPos.value?.top
  if (curLeft == null || curTop == null) {
    curLeft = dr.left - pr.left
    curTop = dr.top - pr.top
    dockPos.value = { left: curLeft, top: curTop }
  }
  dockPointer = {
    startX: e.clientX,
    startY: e.clientY,
    sl: curLeft,
    st: curTop,
    dragging: false,
    captureEl: el
  }
  window.addEventListener('pointermove', onDockPointerMove)
  window.addEventListener('pointerup', onDockPointerEnd)
}

const onDocPointerDown = (e: PointerEvent) => {
  if (!dockExpanded.value) return
  if (!props.online || !connected.value) return
  const dock = dockRef.value
  if (!dock) return
  const target = e.target as Node | null
  if (!target) return
  // 点击 dock 外，自动收起展开面板
  if (!dock.contains(target)) {
    dockExpanded.value = false
  }
}

const loadTarget = () => {
  const raw = localStorage.getItem(REMOTE_DESKTOP_TARGET_KEY)
  if (!raw) return
  try {
    const target = JSON.parse(raw)
    const host = String(target?.host || '').trim()
    const port = Number(target?.port)
    if (host) {
      vncHost.value = host
    }
    if (Number.isFinite(port) && port >= 1 && port <= 65535) {
      vncPort.value = port
    }
  } catch (_e) {
    /* ignore invalid cache */
  }
}

const buildTcpProxyWsUrl = (): string => {
  const token = getToken()
  if (!token) return ''
  const protocol = document.location.protocol.replace('http', 'ws')
  const host = encodeURIComponent(vncHost.value.trim())
  const port = Number(vncPort.value)
  return `${protocol}//${document.location.host}${getBaseApi()}/edge/device/${props.deviceId}/_ws/tcp-proxy?host=${host}&port=${port}&${TOKEN_KEY_URL}=${token}`
}

const canConnect = computed(
  () =>
    !!props.deviceId &&
    props.online &&
    !!vncHost.value.trim() &&
    Number.isFinite(Number(vncPort.value)) &&
    Number(vncPort.value) >= 1 &&
    Number(vncPort.value) <= 65535
)

const clearScreen = () => {
  if (screenContainerRef.value) {
    screenContainerRef.value.innerHTML = ''
  }
}

const onRfbDisconnect = (e: CustomEvent<{ clean: boolean }>) => {
  rfb = null
  clearScreen()
  connected.value = false
  connecting.value = false
  authModalVisible.value = false
  authSubmitting.value = false
  authUsername.value = ''
  authPassword.value = ''
  credentialTypes.value = []
  const skipMsg = suppressDisconnectError
  suppressDisconnectError = false
  if (!skipMsg && !e.detail?.clean) {
    onlyMessage($t('Terminal.index.remote-33') as string, 'error')
  }
}

const onCredentialsRequired = (e: CustomEvent<{ types?: string[] }>) => {
  connecting.value = false
  credentialTypes.value = Array.isArray(e.detail?.types) ? e.detail.types : ['password']
  authUsername.value = ''
  authPassword.value = ''
  authModalVisible.value = true
  nextTick(() => {
    if (needUsername.value) {
      const inputs = contentRef.value?.querySelectorAll<HTMLInputElement>('.auth-os-input')
      inputs?.[0]?.focus()
    } else {
      authPasswordInputRef.value?.focus()
    }
  })
}

const focusPasswordOrSubmit = () => {
  if (needPassword.value && authPasswordInputRef.value) {
    authPasswordInputRef.value.focus()
  } else {
    submitCredentials()
  }
}

const submitCredentials = () => {
  if (!rfb) return
  if (needPassword.value && !authPassword.value.trim()) {
    onlyMessage($t('Terminal.index.remote-39') as string, 'warning')
    return
  }
  authSubmitting.value = true
  try {
    const credentials: Record<string, string> = {}
    if (needUsername.value) {
      credentials.username = authUsername.value.trim()
    }
    if (needPassword.value) {
      credentials.password = authPassword.value
    }
    rfb.sendCredentials(credentials)
    authModalVisible.value = false
    authSubmitting.value = false
  } catch (_e) {
    authSubmitting.value = false
    onlyMessage($t('Terminal.index.remote-40') as string, 'error')
  }
}

const cancelCredentials = () => {
  authModalVisible.value = false
  authSubmitting.value = false
  authUsername.value = ''
  authPassword.value = ''
  credentialTypes.value = []
  if (rfb) {
    suppressDisconnectError = true
    rfb.disconnect()
  }
}

const handleConnect = () => {
  if (!canConnect.value || rfb) return
  if (!getToken()) {
    onlyMessage($t('Terminal.index.remote-34') as string, 'error')
    return
  }
  const wsUrl = buildTcpProxyWsUrl()
  if (!wsUrl) {
    onlyMessage($t('Terminal.index.remote-34') as string, 'error')
    return
  }
  const el = screenContainerRef.value
  if (!el) return

  connecting.value = true
  try {
    rfb = new RFB(el, wsUrl)
    rfb.scaleViewport = true
    rfb.resizeSession = true
    rfb.clipViewport = false

    rfb.addEventListener('connect', () => {
      connecting.value = false
      connected.value = true
      applyViewMode()
    })
    rfb.addEventListener('credentialsrequired', onCredentialsRequired as EventListener)
    rfb.addEventListener('disconnect', onRfbDisconnect as EventListener)
  } catch (_e) {
    connecting.value = false
    rfb = null
    clearScreen()
    onlyMessage($t('Terminal.index.remote-33') as string, 'error')
  }
}

const handleDisconnect = () => {
  authModalVisible.value = false
  authSubmitting.value = false
  if (!rfb) return
  disconnecting.value = true
  try {
    suppressDisconnectError = true
    rfb.disconnect()
  } catch (_e) {
    rfb = null
    clearScreen()
    connected.value = false
  } finally {
    disconnecting.value = false
  }
}

const onFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement === contentRef.value
  nextTick(() => onContainerResize())
}

const toggleFullscreen = async () => {
  const el = contentRef.value
  if (!el) return
  try {
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
    } else if (document.fullscreenElement === el) {
      await document.exitFullscreen()
    } else {
      await document.exitFullscreen()
      await el.requestFullscreen()
    }
  } catch (_e) {
    onlyMessage($t('Terminal.index.remote-45') as string, 'warning')
  }
}

watch(
  () => props.deviceId,
  () => {
    if (rfb) {
      suppressDisconnectError = true
      rfb.disconnect()
    } else {
      clearScreen()
      connected.value = false
    }
  }
)

watch(
  () => props.online,
  (v) => {
    if (!v && rfb) {
      suppressDisconnectError = true
      rfb.disconnect()
    }
  }
)

watch(viewMode, () => {
  saveViewMode()
  applyViewMode()
})

const onContainerResize = () => {
  if (!rfb || !screenContainerRef.value) return
  try {
    window.dispatchEvent(new Event('resize'))
  } catch (_e) {
    /* ignore */
  }
}

onMounted(() => {
  loadTarget()
  loadViewMode()
  loadDockPos()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('pointerdown', onDocPointerDown)
  nextTick(() => {
    const el = screenContainerRef.value
    if (el) {
      resizeObserver = new ResizeObserver(() => onContainerResize())
      resizeObserver.observe(el)
    }
    if (contentRef.value) {
      contentResizeObserver = new ResizeObserver(() => {
        clampDockPosition()
      })
      contentResizeObserver.observe(contentRef.value)
    }

    if (contentRef.value) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          // 切换 accessMode 时组件会被 v-show 隐藏/显示
          // 重新可见时重算 noVNC 画布尺寸，避免“回来屏幕没了”
          const hit = entries.some((e) => e.isIntersecting)
          if (!hit) return
          nextTick(() => {
            if (connected.value && !rfb) {
              // 理论上 connected=true 时 rfb 必须存在；若出现不一致，回退到未连接态
              connected.value = false
              connecting.value = false
            }
            if (rfb) {
              applyViewMode()
            }
          })
        },
        { threshold: 0.01 }
      )
      visibilityObserver.observe(contentRef.value)
    }

    clampDockPosition()
  })
})

watch(dockExpanded, () => {
  nextTick(() => clampDockPosition())
})

watch(connected, (v) => {
  if (!v) {
    dockExpanded.value = false
  }
})

watch([vncHost, vncPort], () => {
  saveTarget()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDockPointerMove)
  window.removeEventListener('pointerup', onDockPointerEnd)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('pointerdown', onDocPointerDown)
  if (document.fullscreenElement === contentRef.value) {
    document.exitFullscreen().catch(() => {})
  }
  if (resizeObserver && screenContainerRef.value) {
    resizeObserver.unobserve(screenContainerRef.value)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (contentResizeObserver && contentRef.value) {
    contentResizeObserver.unobserve(contentRef.value)
  }
  contentResizeObserver?.disconnect()
  contentResizeObserver = null
  visibilityObserver?.disconnect()
  visibilityObserver = null
  if (rfb) {
    suppressDisconnectError = true
    try {
      rfb.disconnect()
    } catch (_e) {
      /* ignore */
    }
    rfb = null
  }
  clearScreen()
})
</script>

<style scoped lang="less">
.remote-desktop-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 未连接：画面中上悬挂地址卡片 */
.addr-os-panel {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  width: min(380px, calc(100% - 32px));
  max-width: calc(100% - 32px);
  pointer-events: none;
}

.addr-os-panel .addr-os-card {
  pointer-events: auto;
}

.addr-os-card {
  position: relative;
  width: 100%;
  padding: 14px 16px 12px;
  border-radius: 14px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.06) 100%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 4px 2px rgba(0, 0, 0, 0.12),
    0 20px 44px rgba(0, 0, 0, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

.addr-os-card::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -14px;
  width: 2px;
  height: 12px;
  margin-left: -1px;
  border-radius: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.12));
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.addr-os-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.addr-os-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  background: linear-gradient(145deg, #4a6fa5 0%, #2d4a6f 100%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  flex-shrink: 0;
}

.addr-os-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.addr-os-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.addr-os-sep {
  color: rgba(255, 255, 255, 0.55);
  font-weight: 500;
  flex-shrink: 0;
}

.addr-os-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.addr-os-input.addr-os-port {
  flex: 0 0 88px;
  max-width: 100%;
}

.addr-os-input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.addr-os-input:focus:not(:disabled) {
  border-color: rgba(120, 170, 255, 0.65);
  box-shadow: 0 0 0 3px rgba(100, 160, 255, 0.2);
}

.addr-os-input:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.addr-os-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 8px;
}

.addr-os-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: help;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.15s ease;
}

.addr-os-icon-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.addr-os-btn {
  min-width: 88px;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.addr-os-btn-primary {
  background: linear-gradient(180deg, #4d8fd9 0%, #2f6cb8 100%);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-weight: 500;
}

.addr-os-btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.addr-os-btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* 已连接：右上角单按钮 + 展开面板（按住拖动 / 单击展开）
 * 面板绝对定位，不参与 dock 占位，避免展开/收起时 dock 宽度变化导致 clamp 误判、按钮右移 */
.remote-desktop-dock {
  position: absolute;
  z-index: 6;
  display: inline-block;
  line-height: 0;
  max-width: calc(100% - 16px);
}

.dock-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 10px;
  cursor: grab;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: background 0.15s ease;
  user-select: none;
  touch-action: none;
}

.dock-trigger:hover {
  background: rgba(0, 0, 0, 0.62);
}

.dock-trigger:active {
  cursor: grabbing;
}

.dock-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
  z-index: 2;
  width: max-content;
  max-width: min(320px, calc(100vw - 32px));
  padding: 8px 10px;
  border-radius: 12px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.05) 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    0 8px 0 rgba(0, 0, 0, 0.08),
    0 20px 44px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.95);
}

.dock-toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}

.dock-toolbar-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.dock-toolbar-divider {
  width: 1px;
  height: 22px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 1px;
}

/* 与全屏/关闭同一套按钮，当前视图模式高亮 */
.dock-panel .screen-tool-btn.is-active {
  background: rgba(90, 150, 255, 0.38);
  box-shadow:
    inset 0 0 0 1px rgba(160, 200, 255, 0.45),
    0 1px 0 rgba(255, 255, 255, 0.08);
  color: #fff;
}

.dock-panel .screen-tool-btn.is-active:hover:not(:disabled) {
  background: rgba(100, 160, 255, 0.48);
}

.dock-slide-enter-active,
.dock-slide-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.dock-slide-enter-from,
.dock-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.remote-desktop-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  background-color: #1a1a1e;
  min-height: 420px;
}

.remote-desktop-screen {
  flex: 1;
  min-height: 0;
  height: 0;
  width: 100%;
  position: relative;
  background: rgb(40, 40, 40);
  overflow: hidden;
}

.remote-desktop-screen.is-scroll-mode {
  overflow: auto;
}

.remote-desktop-screen :deep(canvas) {
  display: block;
  margin: 0 auto;
}

.screen-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  transition: background 0.15s ease;
}

.screen-tool-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.62);
}

.screen-tool-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.screen-tool-btn-close:hover:not(:disabled) {
  background: rgba(180, 60, 60, 0.55);
}

/* 关闭连接：默认就保持红色，增强可辨识度 */
.screen-tool-btn-close {
  background: rgba(180, 60, 60, 0.28);
  box-shadow:
    inset 0 0 0 1px rgba(255, 120, 120, 0.35),
    0 1px 0 rgba(255, 255, 255, 0.06);
}

.screen-tool-btn-close:hover:not(:disabled) {
  background: rgba(180, 60, 60, 0.62);
}

.remote-desktop-mask {
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

.remote-desktop-mask-title {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
}

/* 系统风格认证层：与地址卡同为中上悬挂 */
.auth-os-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px 24px 24px;
}

.auth-os-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 18, 0.55);
  backdrop-filter: blur(18px) saturate(1.2);
}

.auth-os-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  margin-top: 0;
  padding: 28px 28px 22px;
  border-radius: 14px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.06) 100%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 4px 2px rgba(0, 0, 0, 0.12),
    0 24px 52px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

.auth-os-card::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -14px;
  width: 2px;
  height: 12px;
  margin-left: -1px;
  border-radius: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.12));
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.auth-os-avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.auth-os-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: rgba(255, 255, 255, 0.9);
  background: linear-gradient(145deg, #4a6fa5 0%, #2d4a6f 100%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.auth-os-title {
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 8px;
}

.auth-os-desc {
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 20px;
}

.auth-os-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.auth-os-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.auth-os-input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.auth-os-input:focus {
  border-color: rgba(120, 170, 255, 0.65);
  box-shadow: 0 0 0 3px rgba(100, 160, 255, 0.2);
}

.auth-os-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.auth-os-btn {
  min-width: 96px;
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.auth-os-btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.88);
}

.auth-os-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.14);
}

.auth-os-btn-primary {
  background: linear-gradient(180deg, #4d8fd9 0%, #2f6cb8 100%);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-weight: 500;
}

.auth-os-btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.auth-os-btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 0.22s ease;
}

.auth-fade-enter-from,
.auth-fade-leave-to {
  opacity: 0;
}
</style>
