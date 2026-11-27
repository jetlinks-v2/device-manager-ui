import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useFullscreen } from '@vueuse/core';
import { useProductStore } from '../../../../../store/product';
import {
  getProtocal,
  testCode,
  saveProductCode, queryProductCodeTips,
} from '../../../../../api/instance';
import { isBoolean } from 'lodash-es';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useAuthStore } from '@jetlinks-web-core/store';
import { useI18n } from 'vue-i18n';
import { useProductCodec, type ProductCodecSupport } from './useProductCodec';

/** 产品解析配置的读取、保存与独立调试。 */
export function useProductDataAnalysis(support?: ProductCodecSupport) {
  const { t: $t } = useI18n();
  const permissionStore = useAuthStore();
  const canUpdate = computed(() => permissionStore.hasPermission('device/Product:update'));

  const defaultValue =
      `//注册设备下行数据监听器,当平台下发指令给设备时,回调将被调用,用于构造下发给设备的报文
      codec.onDownstream(function(ctx){

      });

      //注册设备上行数据监听器,当设备上行数据时,回调将被调用,用于解析设备上报的数据.
      codec.onUpstream(function(ctx){

      });
    `;

  const el = ref<HTMLElement | null>(null);
  const { toggle } = useFullscreen(el);
  const productStore = useProductStore();

  const url = ref<string>('');
  const topic = ref<string>('');
  const topicList = ref<Array<{ value: string }>>([]);
  const simulation = ref<string>('');
  const resultValue = ref<any>({});
  const loading = ref(false);
  const saving = ref(false);
  const { editorValue, codecLoading, codecFailed, codecProvider, configuredProvider, codecProviders, isScript, canUseCodec, getProductCode, buildProductCode, selectProvider } = useProductCodec(() => productStore.current.id, defaultValue, support);
  const canWriteCodec = computed(() => canUpdate.value && canUseCodec.value);
  const editorLanguage = computed(() => isScript.value ? 'javascript' : 'json');
  const providerLabel = (provider: string) => {
    if (provider === 'jsr223') return $t('IotDeviceDetail.parsing.javascriptLabel');
    return codecProviders.value.find(({ id }) => id === provider)?.name || provider;
  };
  const typeDescription = computed(() => isScript.value ? $t('IotDeviceDetail.parsing.javascriptDesc') : '');
  const typescriptTip = reactive({
    typescript: ''
  })

  const resStyle = computed(() =>
      isBoolean(resultValue.value.success)
          ? {
                'margin-top': '10px',
                'border-color': resultValue.value.success ? 'green' : 'red',
            }
          : {
                'margin-top': '10px',
            },
  );

  const isDisabled = computed(() => !canUseCodec.value || loading.value || saving.value || !simulation.value || !editorValue.value.trim());

  const result = computed(() =>
      resultValue.value.success
          ? JSON.stringify(resultValue.value.outputs?.[0])
          : resultValue.value.reason,
  );

  const editorInit = (editor: any, monaco: any) => {
    editor.updateOptions({ readOnly: !canWriteCodec.value });
    if (!isScript.value) return;
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    // compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowJs: true,
      checkJs: true,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      strictNullChecks: false,
      strictPropertyInitialization: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      useDefineForClassFields: true,//permit class static fields with private name to have initializer
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      typeRoots: ["types"],
      lib: ["esnext"]
    });
  }

  const getTopic = async (id: string) => {
    try {
      const res = await getProtocal(productStore.current.messageProtocol, productStore.current.transportProtocol);
      if (productStore.current.id === id && res.status === 200) {
        topicList.value = res.result?.routes?.map(({ topic }: { topic: string }) => ({ value: topic })) ?? [];
      }
    } catch {
      // 获取不到协议路由时，仍可手动输入 Topic。
    }
  };

  const test = async (dataTest: Record<string, unknown>) => {
      const id = productStore.current.id;
      loading.value = true;
      try {
          const res = await testCode(dataTest);
          if (res.status !== 200) throw new Error('Decode request failed');
          if (productStore.current.id === id) resultValue.value = res.result;
      } catch {
          if (productStore.current.id === id) {
            resultValue.value = { success: false, reason: $t('deviceDetailOptimization.debugRequestFailed') };
          }
      } finally {
          loading.value = false;
      }
  };

  //保存产品解析规则
  const save = async () => {
      if (!canWriteCodec.value || saving.value || loading.value || !editorValue.value.trim()) return;
      const item = readCodecInput();
      if (!item) return;
      const id = productStore.current.id;
      saving.value = true;
      try {
        const res = await saveProductCode(id, item);
        if (res.status === 200 && productStore.current.id === id) {
          onlyMessage($t('DataAnalysis.index.571961-9'));
          await getProductCode();
        }
      } finally {
        saving.value = false;
      }
  };

  /** 调试与保存均提交已选且受支持的解析器，JSON 无效时不发送请求。 */
  const readCodecInput = () => {
      try {
          return buildProductCode();
      } catch {
          onlyMessage($t('InstanceDeviceAccess.codecDebug.jsonInvalid'), 'error');
      }
  };
  const debug = () => {
      if (!canWriteCodec.value || isDisabled.value) return;
      const isMqtt = productStore.current.transportProtocol === 'MQTT';
      const address = isMqtt ? topic.value : url.value;
      if (!address) {
          onlyMessage($t(isMqtt ? 'DataAnalysis.index.571961-10' : 'DataAnalysis.index.571961-11'), 'error');
          return;
      }
      const definition = readCodecInput();
      if (!definition) return;
      void test({ ...definition, headers: { [isMqtt ? 'topic' : 'url']: address }, payload: simulation.value });
  };

  onMounted(() => {
    watch(() => productStore.current.id, (id) => {
      void getProductCode();
      topicList.value = [];
      resultValue.value = {};
      if (id) void getTopic(id);
    }, { immediate: true });
    watch([() => productStore.current.id, isScript, canUseCodec], async ([id, script, supported], _, onCleanup) => {
      typescriptTip.typescript = '';
      if (!id || !script || !supported) return;
      let active = true;
      onCleanup(() => { active = false; });
      try {
        const res = await queryProductCodeTips(id);
        if (active && res.success) typescriptTip.typescript = res.result;
      } catch {
        // 类型提示不影响解析配置的读取与编辑。
      }
    }, { immediate: true });
  });

  return { canUpdate, canWriteCodec, canUseCodec, productStore, editorValue, editorLanguage,
    codecLoading, codecFailed, codecProvider, configuredProvider, codecProviders, isScript, providerLabel, typeDescription, selectProvider,
    getProductCode, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, result, resStyle, loading, saving, isDisabled, debug, save }
}