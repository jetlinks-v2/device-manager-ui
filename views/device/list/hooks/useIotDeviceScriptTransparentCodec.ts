import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFullscreen } from '@vueuse/core'
import { message, Modal } from 'ant-design-vue'
import { isBoolean } from 'lodash-es'

import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'
import { useCodecLeaveGuard } from '../../components/useCodecLeaveGuard'

export type IotDeviceScriptTransparentCodecProps = {
  device: IotDevice
  productId?: string
  codec: Record<string, any> | null
}

export function useIotDeviceScriptTransparentCodec(
  props: Readonly<IotDeviceScriptTransparentCodecProps>,
  emitUpdated: () => void,
) {
  const { t: $t } = useI18n()
  const editorEl = ref<HTMLElement | null>(null)
  const { toggle } = useFullscreen(editorEl)

  const readOnly = ref(true)
  const hasIndependentCodec = ref(false)
  const savedEditorValue = ref('')
  const url = ref('')
  const topic = ref('')
  const topicOptions = ref<Array<{ value: string }>>([])
  const simulation = ref('')
  const resultValue = ref<any>({})
  const resultTime = ref('')
  let debugRequest = 0
  const resultSuccess = computed<boolean | undefined>(() => isBoolean(resultValue.value.success) ? resultValue.value.success : undefined)
  const loading = ref(false)
  const savingConfig = ref(false)
  const resettingConfig = ref(false)
  const editorValue = ref('')
  const saveDisabled = computed(() => readOnly.value || savingConfig.value || resettingConfig.value || !editorValue.value.trim() || !props.productId || !props.device.id)
  const isDirty = computed(() => !readOnly.value && editorValue.value.replace(/\r\n?/g, '\n') !== savedEditorValue.value.replace(/\r\n?/g, '\n'))
  const { confirmLeave } = useCodecLeaveGuard({
    dirty: () => isDirty.value,
    busy: () => savingConfig.value || resettingConfig.value,
    save: saveCodec,
    discard: () => { editorValue.value = savedEditorValue.value; readOnly.value = !hasIndependentCodec.value },
  })
  let resetDialog: ReturnType<typeof Modal.confirm> | undefined
  onScopeDispose(() => { debugRequest++; resetDialog?.destroy() })

  const typescriptTip = reactive({
    typescript: '',
  })

  const defaultValue = () => `// ${$t('IotDeviceDetail.scriptCodec.downstreamComment')}
codec.onDownstream(function(ctx){

});

// ${$t('IotDeviceDetail.scriptCodec.upstreamComment')}
codec.onUpstream(function(ctx){

});
`

  const isMqttTransport = computed(() => String(props.device.transport || '').toUpperCase() === 'MQTT')

  const debugDisabled = computed(() => simulation.value === '' || loading.value)

  const resultDisplay = computed(() => {
    if (resultValue.value.success) return JSON.stringify(resultValue.value.outputs?.[0] ?? {}, null, 2)
    return resultValue.value.reason || ''
  })

  const filterOption = (inputValue: string, option: any) => option?.value?.includes(inputValue)

  let scriptEditor: { updateOptions: (options: { readOnly: boolean }) => void } | undefined
  const updateEditorReadonly = () => scriptEditor?.updateOptions({ readOnly: readOnly.value || savingConfig.value || resettingConfig.value })
  watch([readOnly, savingConfig, resettingConfig], updateEditorReadonly, { flush: 'sync' })
  const editorInit = (editor: any, monaco: any) => {
    scriptEditor = editor
    updateEditorReadonly()
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowJs: true,
      checkJs: true,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      strictNullChecks: false,
      strictPropertyInitialization: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      useDefineForClassFields: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      typeRoots: ['types'],
      lib: ['esnext'],
    })
  }

  function applyCodec(codec: Record<string, any> | null) {
    editorValue.value = codec?.configuration?.script ?? defaultValue()
    savedEditorValue.value = editorValue.value
    hasIndependentCodec.value = Boolean(codec?.deviceId)
    readOnly.value = !hasIndependentCodec.value
    clearDebugResult()
  }

  function clearDebugResult() {
    debugRequest++
    resultValue.value = {}
    resultTime.value = ''
    loading.value = false
  }

  /** 即使重新读取的配置仍为空，也显式恢复继承状态；保留模拟输入以便继续调试。 */
  function reloadCodec() { applyCodec(props.codec) }

  function beginEdit() { readOnly.value = false }

  /** 未保存的覆盖仅丢弃草稿；已有设备配置才调用删除，随后读取最新产品配置。 */
  async function restoreProductCodec(): Promise<boolean> {
    if (savingConfig.value || resettingConfig.value) return false
    if (!hasIndependentCodec.value) {
      editorValue.value = savedEditorValue.value
      readOnly.value = true
      return true
    }
    if (!props.productId || !props.device.id) return false
    resettingConfig.value = true
    try {
      const res: any = await iotDeviceDetailRealApi.deleteDeviceTransparentCodec(props.productId, props.device.id)
      if (res.status !== 200) return false
      const inherited: any = await iotDeviceDetailRealApi.getDeviceTransparentCodec(props.productId, props.device.id)
      if (inherited.status !== 200) return false
      applyCodec(inherited.result ?? null)
      message.success($t('IotDeviceDetail.accessDetail.resetSuccess'))
      emitUpdated()
      return true
    } catch { return false }
    finally { resettingConfig.value = false }
  }

  function resetDeviceCodec() {
    if (resetDialog || savingConfig.value || resettingConfig.value) return
    resetDialog = Modal.confirm({
      title: $t('deviceDetailOptimization.restoreTitle'),
      content: $t('deviceDetailOptimization.restoreHint'),
      okText: $t('deviceDetailOptimization.restore'),
      onOk: (close: () => void) => {
        if (resettingConfig.value) return
        resetDialog?.update({ okButtonProps: { loading: true }, cancelButtonProps: { disabled: true }, closable: false, keyboard: false })
        void restoreProductCodec().then(restored => { if (restored) close() }).finally(() => {
          resetDialog?.update({ okButtonProps: { loading: false }, cancelButtonProps: { disabled: false }, keyboard: true })
        })
      },
      afterClose: () => { resetDialog = undefined },
    })
  }

  async function loadTopicOptions() {
    const protocol = props.device.protocol
    const transport = props.device.transport
    if (!protocol || !transport) {
      topicOptions.value = []
      return
    }
    const res: any = await iotDeviceDetailRealApi.queryProtocolDetail(protocol, transport)
    if (res.status === 200) {
      topicOptions.value = (res.result?.routes || []).map((item: any) => ({
        value: item.topic,
      })).filter((item: any) => item.value)
    }
  }

  async function queryCodeTips() {
    if (!props.productId || !props.device.id) return
    const res: any = await iotDeviceDetailRealApi.queryTransparentCodecTips(props.productId, props.device.id)
    if (res.success || res.status === 200) {
      typescriptTip.typescript = res.result || ''
    }
  }

  async function runDecodeTest(data: Record<string, unknown>) {
    const request = ++debugRequest
    loading.value = true
    try {
      const res: any = await iotDeviceDetailRealApi.testTransparentDecode(data)
      if (request !== debugRequest) return
      if (res.status !== 200) throw new Error('Decode request failed')
      resultValue.value = res.result
    } catch {
      if (request === debugRequest) resultValue.value = { success: false, reason: $t('deviceDetailOptimization.debugRequestFailed') }
    } finally {
      if (request === debugRequest) {
        resultTime.value = new Date().toLocaleTimeString()
        loading.value = false
      }
    }
  }

  async function saveCodec(): Promise<boolean> {
    if (saveDisabled.value || !props.productId || !props.device.id) return false
    const submittedScript = editorValue.value
    savingConfig.value = true
    try {
      const res: any = await iotDeviceDetailRealApi.saveDeviceTransparentCodec(props.productId, props.device.id, {
        provider: 'jsr223',
        configuration: {
          ...props.codec?.configuration,
          script: submittedScript,
          lang: 'javascript',
        },
      })
      if (res.status === 200) {
        // 不重新加载编辑器，避免刷新响应覆盖保存请求期间的新输入。
        savedEditorValue.value = submittedScript
        hasIndependentCodec.value = true
        message.success($t('IotDeviceDetail.detail.saveSuccess'))
        return true
      }
      return false
    } catch {
      return false
    } finally {
      savingConfig.value = false
    }
  }

  function debug() {
    if (isMqttTransport.value) {
      if (!topic.value) {
        message.error($t('IotDeviceDetail.scriptCodec.topicPlaceholder'))
        return
      }
      void runDecodeTest({
        headers: { topic: topic.value },
        configuration: {
          script: editorValue.value,
          lang: 'javascript',
        },
        provider: 'jsr223',
        payload: simulation.value,
      }).catch(() => {})
      return
    }

    if (!url.value) {
      message.error($t('IotDeviceDetail.scriptCodec.urlPlaceholder'))
      return
    }
    void runDecodeTest({
      headers: { url: url.value },
      provider: 'jsr223',
      configuration: {
        script: editorValue.value,
        lang: 'javascript',
      },
      payload: simulation.value,
    }).catch(() => {})
  }

  function warnReadonly() {
    message.warning($t('IotDeviceDetail.scriptCodec.readonlyWarning'))
  }

  watch(
    () => props.codec,
    codec => applyCodec(codec),
    { deep: true, immediate: true },
  )

  watch(
    () => [props.device.id, props.device.protocol, props.device.transport, props.productId] as const,
    () => {
      loadTopicOptions()
      queryCodeTips()
    },
    { immediate: true },
  )

  return {
    debugDisabled,
    beginEdit,
    confirmLeave,
    editorEl,
    editorInit,
    editorValue,
    filterOption,
    isMqttTransport,
    loading,
    isDirty,
    hasIndependentCodec,
    readOnly,
    reloadCodec,
    resetDeviceCodec,
    resultDisplay,
    resultSuccess,
    resultTime,
    saveCodec,
    saveDisabled,
    savingConfig,
    resettingConfig,
    simulation,
    toggle,
    topic,
    topicOptions,
    typescriptTip,
    url,
    warnReadonly,
    debug,
  }
}
