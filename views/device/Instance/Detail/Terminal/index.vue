<template>
  <div style="height: 100%; background-color: #000">
    <div class="terminal" ref="terminal"></div>
  </div>
</template>

<script setup name="Terminal">
import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css'
import {FitAddon} from "@xterm/addon-fit/src/FitAddon";
import {debounce} from "lodash-es";
import {randomString, onlyMessage} from "@jetlinks-web/utils";
import {useInstanceStore} from "../../../../../store/instance";
import {storeToRefs} from "pinia";
import {getWebSocket, closeWs} from "./websocket";

const wsRef = ref()
const wsInitRef = ref()
const terminal = ref()
const sessionId = ref()
const fitAddon = new FitAddon();
const instanceStore = useInstanceStore();
const { current, tabActiveKey } = storeToRefs(instanceStore);

let termRef
const url = ref()

const getData = (input = '') => {
  const id = 'terminal_' + randomString(8);
  const topic = '/xterm/data';

  wsRef.value = getWebSocket(id, topic, {
    sessionId: sessionId.value,
    _ignore_complete: true,
    input
  }, current.value?.id).subscribe();
}

const initTerm = () => {
  termRef = new Terminal({
    rendererType: "canvas", //渲染类型
    convertEol: true, //启用时，光标将设置为下一行的开头
    disableStdin: false, //是否应禁用输入。
    cursorStyle: "underline", //光标样式
    cursorBlink: true, //光标闪烁
    cols: 100,
    rows: 45,
    theme: {
      foreground: "#14e264", //字体
      cursor: "help", //设置光标
      lineHeight: 16
    },
    bellStyle: 'sound',
    rightClickSelectsWord: true,
    screenReaderMode: true,
    allowProposedApi: true,
    LogLevel: 'debug',
  });

  termRef.loadAddon(fitAddon);
  termRef.open(terminal.value);
  // 不能初始化的时候fit,需要等terminal准备就绪,可以设置延时操作
  setTimeout(() => {
    fitAddon.fit()
  }, 5)
  termRef.onData((data) => {
    getData(data)
  })
}
const getInitData = () => {
  const id = 'terminal_' + randomString(8);
  const topic = '/xterm/setup';
  wsInitRef.value = getWebSocket(id, topic, {}, current.value?.id).subscribe((resp) => {
    if (!resp.payload?.sessionId) {
      onlyMessage($t('Terminal.index.488144-0'))
    }
    sessionId.value = resp.payload?.sessionId
    termRef.write(resp.payload.output)
  });
}

const fitTerm = () => {
  fitAddon.fit()
}
const onResize = debounce(() => fitTerm(), 500)
const onTerminalResize = () => {
  window.addEventListener('resize', onResize)
}
const removeResizeListener = () => {
  window.removeEventListener('resize', onResize)
}

onMounted(() => {
  if(current.value?.state?.value === 'online') {
    setTimeout(() => {
      getInitData()
    }, 500)
    nextTick(() => {
      initTerm()
    })
  }
  onTerminalResize()
});

const unSub = () => {
  if (wsRef.value) {
    wsRef.value.unsubscribe()
  }
  if (wsInitRef.value) {
    wsInitRef.value.unsubscribe()
  }
}

onBeforeUnmount(() => {
  unSub()
  setTimeout(() => {
    closeWs()
  }, 1000)
  removeResizeListener()
})

</script>

<style scoped lang="less">
.terminal {
  width: 100%;
  height: 100%;
}
</style>
