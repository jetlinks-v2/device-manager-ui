<template>
  <div class="parsing-script">
    <div class="script-toolbar">
      <div class="script-toolbar-hint">
        <AIcon type="ExclamationCircleOutlined" />
        <template v-if="topTitle === 'rest'">
          {{ $t('Parsing.index.217769-0') }}
          <j-permission-button
            type="link"
            hasPermission="device/Instance:update"
            @click="rest()"
          >
            {{ $t('Parsing.index.217769-1') }}
          </j-permission-button>
          {{ $t('Parsing.index.217769-2') }}
        </template>
        <template v-else>
          {{ $t('Parsing.index.217769-3') }}
          <j-permission-button
            type="link"
            hasPermission="device/Instance:update"
            @click="readOnly = false"
            :style="color"
          >
            {{ $t('Parsing.index.217769-4') }}
          </j-permission-button>
          {{ $t('Parsing.index.217769-5') }}
        </template>
      </div>
      <AIcon type="ExpandOutlined" class="script-toolbar-expand" @click="toggle" />
    </div>

    <div class="edit" ref="el">
      <div
        v-show="readOnly"
        class="edit-only"
        @click="
          () => {
            message.warning({
              key: 1,
              content: () => $t('Parsing.index.217769-7'),
              style: { marginTop: '260px' },
            });
          }
        "
      />
      <monaco-editor
        language="javascript"
        style="height: 100%"
        theme="vs"
        v-model:modelValue="editorValue"
        :registrationTypescript="typescriptTip"
        :init="editorInit"
      />
    </div>

    <div class="bottom">
      <div style="width: 49.5%">
        <div class="bottom-title">
          <div class="bottom-title-text">{{ $t('Parsing.index.217769-8') }}</div>
          <div class="bottom-title-topic">
            <template v-if="instanceStore.current.transport === 'MQTT'">
              <div style="margin-right: 5px">Topic:</div>
              <a-auto-complete
                :placeholder="$t('Parsing.index.217769-9')"
                style="width: 300px"
                :options="topicList"
                :allowClear="true"
                :filterOption="filterOption"
                v-model:value="topic"
              />
            </template>
            <template v-else>
              <div style="margin-right: 5px">URL:</div>
              <a-input
                :placeholder="$t('Parsing.index.217769-10')"
                v-model:value="url"
                style="width: 300px"
              />
            </template>
          </div>
        </div>
        <a-textarea
          :rows="5"
          placeholder="// 二进制数据以0x开头的十六进制输入，字符串数据输入原始字符串"
          style="margin-top: 10px"
          v-model:value="simulation"
        />
      </div>
      <div style="width: 49.5%">
        <div class="bottom-title">
          <div class="bottom-title-text">{{ $t('Parsing.index.217769-11') }}</div>
        </div>
        <a-textarea
          :value="resultDisplay"
          :readonly="true"
          :autoSize="{ minRows: 5 }"
          :style="resStyle"
        />
      </div>
    </div>

    <div class="script-actions">
      <j-permission-button
        type="primary"
        hasPermission="device/Instance:update"
        :loading="loading"
        :disabled="isDisabled"
        @click="debug()"
        :tooltip="{ title: $t('Parsing.index.217769-12') }"
      >
        {{ $t('Parsing.index.217769-13') }}
      </j-permission-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="ScriptTransparentCodec">
import { useFullscreen } from '@vueuse/core';
import { useInstanceStore } from '../../../../../store/instance';
import {
  getProtocal,
  testCode,
  saveDeviceCode,
  delDeviceCode,
  queryCodeTips,
} from '../../../../../api/instance';
import { message } from 'ant-design-vue';
import { isBoolean } from 'lodash-es';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const props = defineProps<{
  /** deviceCode 接口返回的 result，用于初始化编辑器与只读状态 */
  codec: Record<string, any> | null;
}>();

const emit = defineEmits<{
  (e: 'updated'): void;
}>();

const defaultValue = () =>
  `//${$t('Parsing.index.217769-20')}
      codec.onDownstream(function(ctx){

      });

      //${$t('Parsing.index.217769-21')}
      codec.onUpstream(function(ctx){

      });
    `;

const el = ref<HTMLElement | null>(null);
const { toggle } = useFullscreen(el);
const instanceStore = useInstanceStore();

const topTitle = ref<string>('');
const readOnly = ref<boolean>(true);
const url = ref<string>('');
const topic = ref<string>('');
const topicList = ref<any[]>([]);
const simulation = ref<string>('');
const resultValue = ref<any>({});
const loading = ref<boolean>(false);
/** 保存配置请求中（供外层顶栏按钮 loading） */
const savingConfig = ref<boolean>(false);
const editorValue = ref<string>('');

const typescriptTip = reactive({
  typescript: '',
});

const color = computed(() => ({
  color: readOnly.value ? '#415ed1' : '#a6a6a6',
}));

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

const filterOption = (inputValue: any, option: any) => option!.value.indexOf(inputValue) !== -1;

const isDisabled = computed(() => simulation.value === '' || readOnly.value);

const resultDisplay = computed(() =>
  resultValue.value.success
    ? JSON.stringify(resultValue.value.outputs?.[0])
    : resultValue.value.reason,
);

const editorInit = (editor: any, monaco: any) => {
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
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
  });
};

function applyCodecFromProps() {
  const r = props.codec;
  if (!r) {
    editorValue.value = defaultValue();
    readOnly.value = true;
    topTitle.value = 'edit';
    return;
  }
  const item = r.configuration?.script ? r.configuration.script : defaultValue();
  if (r.deviceId) {
    readOnly.value = false;
    topTitle.value = 'rest';
    editorValue.value = item;
  } else {
    readOnly.value = true;
    topTitle.value = 'edit';
    editorValue.value = item;
  }
}

watch(
  () => props.codec,
  () => {
    applyCodecFromProps();
  },
  { deep: true, immediate: true },
);

const rest = async () => {
  const res = await delDeviceCode(instanceStore.current.productId, instanceStore.current.id);
  if (res.status === 200) {
    emit('updated');
    onlyMessage($t('Parsing.index.217769-16'));
  }
};

const getTopic = async () => {
  const res: any = await getProtocal(instanceStore.current.protocol, instanceStore.current.transport);
  if (res.status === 200) {
    topicList.value =
      res.result.routes?.map((items: any) => ({
        value: items.topic,
      })) ?? [];
  }
};

const queryCode = () => {
  queryCodeTips(instanceStore.current.productId, instanceStore.current.id).then((res: any) => {
    if (res.success) {
      typescriptTip.typescript = res.result;
    }
  });
};

const test = async (dataTest: any) => {
  loading.value = true;
  const res = await testCode(dataTest);
  loading.value = false;
  if (res.status === 200) {
    resultValue.value = res?.result;
  }
};

const saveCodec = async () => {
  const item = {
    provider: 'jsr223',
    configuration: {
      script: editorValue.value,
      lang: 'javascript',
    },
  };
  savingConfig.value = true;
  try {
    const res = await saveDeviceCode(instanceStore.current.productId, instanceStore.current.id, item);
    if (res.status === 200) {
      onlyMessage($t('Parsing.index.217769-17'));
      emit('updated');
    }
  } finally {
    savingConfig.value = false;
  }
};

const debug = () => {
  if (instanceStore.current.transport === 'MQTT') {
    if (topic.value !== '') {
      test({
        headers: { topic: topic.value },
        configuration: {
          script: editorValue.value,
          lang: 'javascript',
        },
        provider: 'jsr223',
        payload: simulation.value,
      });
    } else {
      onlyMessage($t('Parsing.index.217769-18'), 'error');
    }
  } else {
    if (url.value !== '') {
      test({
        headers: { url: url.value },
        provider: 'jsr223',
        configuration: {
          script: editorValue.value,
          lang: 'javascript',
        },
        payload: simulation.value,
      });
    } else {
      onlyMessage($t('Parsing.index.217769-19'), 'error');
    }
  }
};

watch(
  () => instanceStore.current?.id,
  () => {
    if (instanceStore.current?.id) {
      getTopic();
      queryCode();
    }
  },
  { immediate: true },
);

defineExpose({
  saveCodec,
  savingConfig,
});
</script>

<style scoped lang="less">
.parsing-script {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.script-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.script-toolbar-hint {
  flex: 1;
  min-width: 0;
}

.script-toolbar-expand {
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
}

.edit {
  flex: 1;
  min-height: 340px;
  position: relative;
  border: 1px solid #dcdcdc;

  .edit-only {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: absolute;
    z-index: 1;
    background-color: #eeeeee70;
    cursor: not-allowed;
  }
}

.bottom {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background-color: #f7f7f7;

  .bottom-title {
    display: flex;
    justify-content: space-between;

    .bottom-title-text {
      font-weight: 600;
      font-size: 14px;
      margin-top: 10px;
    }

    .bottom-title-topic {
      display: flex;
      align-items: center;
    }
  }
}

.script-actions {
  padding-top: 10px;
  flex-shrink: 0;
}
</style>
