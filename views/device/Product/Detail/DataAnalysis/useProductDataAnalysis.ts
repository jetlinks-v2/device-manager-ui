import { computed, ref, reactive, onMounted, onScopeDispose } from 'vue'

import { useFullscreen } from '@vueuse/core';
import { useProductStore } from '../../../../../store/product';
import {
  getProtocal,
  testCode,
  saveProductCode, queryProductCodeTips,
  getTransparentCodecSupports,
} from '../../../../../api/instance';
import { isBoolean } from 'lodash-es';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useAuthStore } from '@jetlinks-web-core/store';
import { useI18n } from 'vue-i18n';
import { useProductCodec } from './useProductCodec';
import { useCodecLeaveGuard } from '../../../components/useCodecLeaveGuard';




export function useProductDataAnalysis() {
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
  const topicList = ref([]);
  const simulation = ref<string>('');
  const resultValue = ref<any>({});
  const resultTime = ref('');
  let debugRequest = 0;
  onScopeDispose(() => { debugRequest++; });
  const resultSuccess = computed<boolean | undefined>(() => isBoolean(resultValue.value.success) ? resultValue.value.success : undefined);
  const loading = ref<boolean>(false);
  const saving = ref(false);
  const savedEditorValue = ref('');
  const { codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode: loadProductCode, buildProductCode, selectProvider } = useProductCodec(() => productStore.current.id, defaultValue);
  const snapshot = () => JSON.stringify({ provider: codec.value?.provider || 'jsr223', source: editorValue.value.replace(/\r\n?/g, '\n') });
  const savedSnapshot = ref(snapshot());
  const savedCodec = ref<typeof codec.value>();
  const isDirty = computed(() => canUpdate.value && !codecLoading.value && !codecFailed.value && snapshot() !== savedSnapshot.value);
  const saveDisabled = computed(() => codecLoading.value || codecFailed.value || saving.value || !editorValue.value.trim());
  const { confirmLeave } = useCodecLeaveGuard({ dirty: () => isDirty.value, busy: () => saving.value,
    save, discard: () => { codec.value = savedCodec.value && JSON.parse(JSON.stringify(savedCodec.value)); editorValue.value = savedEditorValue.value; } });
  const supports = ref<Array<{ id: string; name?: string }>>([{ id: 'jsr223' }, { id: 'modbus' }]);
  const codecMenuItems = computed(() => {
    const options = [...supports.value];
    const current = codec.value?.provider;
    if (current && !options.some(item => item.id === current)) options.push({ id: current });
    return options.map(item => ({ value: item.id, label: item.id === 'jsr223' ? $t('IotDeviceDetail.parsing.javascriptLabel') : item.id === 'modbus' ? $t('IotDeviceDetail.parsing.modbusLabel') : item.name || item.id }));
  });
  const typeDescription = computed(() => {
    const provider = codec.value?.provider || 'jsr223';
    return provider === 'jsr223' ? $t('IotDeviceDetail.parsing.javascriptDesc') : provider === 'modbus' ? $t('IotDeviceDetail.parsing.modbusDesc') : '';
  });

  async function loadSupports() {
    try {
      const res = await getTransparentCodecSupports();
      if (res.status === 200 && res.result?.length) supports.value = res.result;
    } catch { /* 保留与设备端一致的基础解析器入口。 */ }
  }

  async function changeProvider(provider: string) {
    if (!canUpdate.value || saving.value || codecLoading.value || provider === (codec.value?.provider || 'jsr223')) return;
    if (!await confirmLeave()) return;
    selectProvider(provider);
    clearDebugResult();
  }

  function clearDebugResult() {
    debugRequest++;
    resultValue.value = {};
    resultTime.value = '';
    loading.value = false;
  }

  async function getProductCode() {
    clearDebugResult();
    await loadProductCode();
    savedEditorValue.value = editorValue.value;
    savedCodec.value = codec.value && JSON.parse(JSON.stringify(codec.value));
    savedSnapshot.value = snapshot();
  }

  async function reload() {
    if (saving.value || codecLoading.value) return;
    await getProductCode();
    if (!codecFailed.value) onlyMessage($t('deviceDetailOptimization.reloaded'));
  }
  const typescriptTip = reactive({
    typescript: ''
  })

  const isDisabled = computed(() => codecLoading.value || codecFailed.value || !simulation.value || !editorValue.value);

  const result = computed(() =>
      resultValue.value.success
          ? JSON.stringify(resultValue.value.outputs?.[0])
          : resultValue.value.reason,
  );

  const editorInit = (editor: any, monaco: any) => {
    editor.updateOptions({ readOnly: !canUpdate.value });
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

  //获取topic
  const getTopic = async () => {
      const res: any = await getProtocal(
          productStore.current.messageProtocol,
          productStore.current.transportProtocol,
      );
      if (res.status === 200) {
          const item = res.result.routes?.map((items: any) => ({
              value: items.topic,
          }));
          topicList.value = item;
      }
  };

  const queryCodeTips = () => {
    queryProductCodeTips(productStore.current.id).then((res: any) => {
      if (res.success) {
        typescriptTip.typescript = res.result
      }
    })
  }


  //调试
  const test = async (dataTest: any) => {
      const request = ++debugRequest;
      loading.value = true;
      try {
          const res = await testCode(dataTest);
          if (request !== debugRequest) return;
          if (res.status !== 200) throw new Error('Decode request failed');
          resultValue.value = res?.result;
      } catch {
          if (request === debugRequest) resultValue.value = { success: false, reason: $t('deviceDetailOptimization.debugRequestFailed') };
      } finally {
          if (request === debugRequest) {
              resultTime.value = new Date().toLocaleTimeString();
              loading.value = false;
          }
      }
  };

  //保存产品解析规则
  async function save(): Promise<boolean> {
      if (!canUpdate.value || saveDisabled.value) return false;
      const item = readCodecInput();
      if (!item) return false;
      const submittedValue = editorValue.value;
      saving.value = true;
      try {
          const res = await saveProductCode(productStore.current.id, { ...item });
          if (res.status !== 200) return false;
          savedEditorValue.value = submittedValue;
          savedCodec.value = JSON.parse(JSON.stringify(item));
          savedSnapshot.value = JSON.stringify({ provider: item.provider || 'jsr223', source: submittedValue.replace(/\r\n?/g, '\n') });
          onlyMessage($t('DataAnalysis.index.571961-9'));
          return true;
      } catch {
          return false;
      } finally {
          saving.value = false;
      }
  }

  /** 调试和保存共用原解析器的配置，避免 JSON 类型被误写为 JavaScript。 */
  const readCodecInput = () => {
      if (codecLoading.value || codecFailed.value) return undefined;
      try { return buildProductCode(); }
      catch { onlyMessage($t('InstanceDeviceAccess.codecDebug.jsonInvalid'), 'error'); return undefined; }
  };
  const debug = () => {
      if (!canUpdate.value) return;
      const isMqtt = productStore.current.transportProtocol === 'MQTT';
      const address = isMqtt ? topic.value : url.value;
      if (!address) {
          onlyMessage($t(isMqtt ? 'DataAnalysis.index.571961-10' : 'DataAnalysis.index.571961-11'), 'error');
          return;
      }
      const definition = readCodecInput();
      if (!definition) return;
      void test({ ...definition, headers: { [isMqtt ? 'topic' : 'url']: address }, payload: simulation.value }).catch(() => {});
  };

  onMounted(() => {
    if(productStore.current.id){
      getProductCode();
      getTopic();
      queryCodeTips()
      void loadSupports();
    }
  });

  return { canUpdate, productStore, codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, reload, codecMenuItems, typeDescription, changeProvider, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, resultSuccess, resultTime, result, loading, isDisabled, isDirty, saving, saveDisabled, debug, save }

}
