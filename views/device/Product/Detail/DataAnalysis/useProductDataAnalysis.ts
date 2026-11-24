import { computed, ref, reactive, onMounted } from 'vue'
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
import { useProductCodec } from './useProductCodec';

/** 产品解析配置的读取、保存与独立调试。 */
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
  const loading = ref<boolean>(false);
  const { codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, buildProductCode } = useProductCodec(() => productStore.current.id, defaultValue);
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
    queryProductCodeTips(productStore.current.id).then(res => {
      if (res.success) {
        typescriptTip.typescript = res.result
      }
    })
  }


  //调试
  const test = async (dataTest: any) => {
      loading.value = true;
      const res = await testCode(dataTest);
      if (res.status === 200) {
          loading.value = false;
          resultValue.value = res?.result;
      } else {
          loading.value = false;
      }
  };

  //保存产品解析规则
  const save = async () => {
      if (!canUpdate.value || !editorValue.value.trim()) return;
      const item = readCodecInput();
      if (!item) return;
      const res = await saveProductCode(productStore.current.id, item);
      if (res.status === 200) {
          onlyMessage($t('DataAnalysis.index.571961-9'));
          getProductCode();
      }
  };

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
      void test({ ...definition, headers: { [isMqtt ? 'topic' : 'url']: address }, payload: simulation.value });
  };

  onMounted(() => {
    if(productStore.current.id){
      getProductCode();
      getTopic();
      queryCodeTips()
    }
  });

  return { canUpdate, productStore, codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, result, resStyle, loading, isDisabled, debug, save }
}
