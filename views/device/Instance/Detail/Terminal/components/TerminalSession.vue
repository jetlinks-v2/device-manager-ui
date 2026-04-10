<template>
  <div class="terminal-panel">
    <div class="terminal" ref="terminalRef"></div>
    <div v-if="!started" class="terminal-mask">
      <div class="terminal-mask-title">{{ $t('Terminal.index.remote-13') }}</div>
      <div class="terminal-mask-desc">{{ $t('Terminal.index.remote-14') }}</div>
      <a-button type="primary" :loading="starting" @click="startTerminal">
        {{ $t('Terminal.index.remote-15') }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { debounce } from 'lodash-es'
import { randomString, onlyMessage } from '@jetlinks-web/utils'
import { getWebSocket, sendWebSocketMessage } from '../websocket'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  deviceId: string
  online: boolean
  active?: boolean
}>()

const { t: $t } = useI18n()
const terminalRef = ref()
const started = ref(false)
const starting = ref(false)
const sessionId = ref<string>()
const setupRequestId = `terminal_setup_${randomString(8)}`

const fitAddon = new FitAddon()
let term: any
let wsInitRef: any

const sendData = (input = '') => {
  // data 请求使用独立 requestId，真正保持连续会话的是 sessionId。
  const dataRequestId = `terminal_data_${randomString(8)}`
  sendWebSocketMessage(
    dataRequestId,
    '/xterm/data',
    {
      sessionId: sessionId.value,
      _ignore_complete: true,
      input
    },
    props.deviceId
  )
}

const sendResize = () => {
  if (!sessionId.value || !term) {
    return
  }
  sendWebSocketMessage(
    `terminal_resize_${randomString(8)}`,
    '/xterm/resize',
    {
      sessionId: sessionId.value,
      columns: term.cols,
      rows: term.rows
    },
    props.deviceId
  )
}

const initTerm = () => {
  term = new Terminal({
    rendererType: 'canvas',
    convertEol: true,
    disableStdin: false,
    cursorStyle: 'underline',
    cursorBlink: true,
    cols: 100,
    rows: 45,
    theme: {
      foreground: '#14e264',
      cursor: 'help',
      lineHeight: 16
    },
    bellStyle: 'sound',
    rightClickSelectsWord: true,
    screenReaderMode: true,
    allowProposedApi: true,
    LogLevel: 'debug'
  })

  term.loadAddon(fitAddon)
  term.open(terminalRef.value)
  setTimeout(() => fitAddon.fit(), 5)
  term.onData((data: string) => sendData(data))
}

const initSession = () => {
  const style = window.getComputedStyle(terminalRef.value)
  const columns = Math.max(40, Math.floor(parseInt(style.width || '0', 10) / 14))
  const rows = Math.max(10, Math.floor(parseInt(style.height || '0', 10) / 14 - 1))
  wsInitRef = getWebSocket(
    setupRequestId,
    '/xterm/setup',
    {
      columns,
      rows
    },
    props.deviceId
  ).subscribe((resp: any) => {
    if (!resp.payload?.sessionId) {
      onlyMessage($t('Terminal.index.488144-0'))
      starting.value = false
      return
    }
    sessionId.value = resp.payload.sessionId
    // xterm.write 仅接受字符串，后端可能返回 undefined/null。
    const output = resp?.payload?.output
    term?.write(typeof output === 'string' ? output : '')
    started.value = true
    starting.value = false
    // 首次建立后如果当前标签可见，立即重新 fit，避免隐藏 tab 初始化导致尺寸异常。
    if (props.active) {
      nextTick(() => {
        fitAddon.fit()
        sendResize()
      })
    }
  })
}

const startTerminal = async () => {
  if (started.value || starting.value) return
  if (!props.online) {
    onlyMessage($t('Terminal.index.remote-16'))
    return
  }
  starting.value = true
  await nextTick()
  if (!term) initTerm()
  setTimeout(() => initSession(), 300)
}

const resizeTerm = debounce(() => {
  if (started.value) {
    fitAddon.fit()
    sendResize()
  }
}, 300)

const fitTerminal = () => {
  if (started.value) {
    nextTick(() => {
      fitAddon.fit()
      sendResize()
    })
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      fitTerminal()
    }
  }
)

defineExpose({
  fitTerminal
})

onMounted(() => {
  window.addEventListener('resize', resizeTerm)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeTerm)
  wsInitRef?.unsubscribe?.()
  term?.dispose?.()
})
</script>

<style scoped lang="less">
.terminal-panel {
  height: 100%;
  min-height: 0;
  position: relative;
  background-color: #000;
}

.terminal {
  width: 100%;
  height: 100%;
}

.terminal-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.85) 100%);
}

.terminal-mask-title {
  color: rgba(255, 255, 255, 0.92);
  font-size: 16px;
  font-weight: 600;
}

.terminal-mask-desc {
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
}
</style>
