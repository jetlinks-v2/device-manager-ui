
<template>
    <div>
        <div class="top">
            <div>
                {{ $t('DataAnalysis.index.571961-0') }}
                <a-select
                    :value="isSaaS && editorLanguage === 'json' ? codec?.provider || 'json' : 'JavaScript'"
                    style="width: 200px; margin-left: 5px"
                >
                    <a-select-option v-if="isSaaS && editorLanguage === 'json'" :value="codec?.provider || 'json'">
                        {{ codec?.provider || 'JSON' }}
                    </a-select-option>
                    <a-select-option v-else value="JavaScript"
                        >JavaScript(ECMAScript 5)</a-select-option
                    >
                </a-select>
                <AIcon
                    type="ExpandOutlined"
                    style="margin-left: 20px"
                    @click="toggle"
                />
            </div>
        </div>
        <a-alert v-if="codecFailed" type="error" :message="$t('Product.codec.loadFailed')" show-icon>
            <template #action><a-button @click="getProductCode">{{ $t('PropertyRules.retry') }}</a-button></template>
        </a-alert>
        <a-spin v-else :spinning="codecLoading">
            <j-empty v-if="isSaaS && !codecLoading && !codec" :description="$t('Product.codec.empty')" />
            <div v-else class="edit" ref="el">
                <monaco-editor
                    :key="editorLanguage"
                    :language="editorLanguage"
                    :read-only="isSaaS"
                    style="height: 100%"
                    theme="vs"
                    v-model:modelValue="editorValue"
                    :registrationTypescript="typescriptTip"
                    :init="editorInit"
                />
            </div>
        </a-spin>
        <div v-if="!isSaaS" class="bottom">
            <div style="width: 49.5%">
                <div class="bottom-title">
                    <div class="bottom-title-text">{{ $t('DataAnalysis.index.571961-1') }}</div>
                    <div class="bottom-title-topic">
                        <template
                            v-if="
                                productStore.current.transportProtocol ===
                                'MQTT'
                            "
                        >
                            <div style="margin-right: 5px">Topic:</div>
                            <a-auto-complete
                                :placeholder="$t('DataAnalysis.index.571961-2')"
                                style="width: 300px"
                                :options="topicList"
                                :allowClear="true"
                                :filterOption="(inputValue: any, option: any) =>
                                        option!.value.indexOf(inputValue) !== -1"
                                v-model:value="topic"
                            />
                        </template>
                        <template v-else>
                            <div style="margin-right: 5px">URL:</div>
                            <a-input
                                :placeholder="$t('DataAnalysis.index.571961-3')"
                                v-model:value="url"
                                style="width: 300px"
                            ></a-input>
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
                    <div class="bottom-title-text">{{ $t('DataAnalysis.index.571961-4') }}</div>
                </div>
                <a-textarea
                    :rows="5"
                    :style="resStyle"
                    v-model:value="result"
                />
            </div>
        </div>
    </div>
    <div style="margin-top: 10px; margin-left: 10px">
        <a-button
            type="primary"
            v-if="canUpdate"
            :loading="loading"
            :disabled="isDisabled"
            @click="debug()"
            :tooltip="{
                title: $t('DataAnalysis.index.571961-5'),
            }"
        >
            {{ $t('DataAnalysis.index.571961-6') }}
        </a-button>
        <a-button
            v-if="canUpdate"
            :loading="loading"
            :disabled="!isTest"
            @click="save()"
            :style="{ marginLeft: '10px' }"
            :tooltip="{
                title: isTest ? '' : $t('DataAnalysis.index.571961-7'),
            }"
        >
            {{ $t('DataAnalysis.index.571961-8') }}
        </a-button>
    </div>
</template>

<script setup lang='ts'>
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
import { isSaaS } from '@jetlinks-web-core/utils/consts';
import { useProductCodec } from './useProductCodec';

defineOptions({ name: 'DataAnalysis' })

const { t: $t } = useI18n();
const permissionStore = useAuthStore();
const canUpdate = computed(() => !isSaaS && permissionStore.hasPermission('device/Product:update'));

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
const isTest = ref<boolean>(false);
const { codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode } = useProductCodec(() => productStore.current.id, defaultValue);
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

const isDisabled = computed(() => !simulation.value || !editorValue.value);

const result = computed(() =>
    resultValue.value.success
        ? JSON.stringify(resultValue.value.outputs?.[0])
        : resultValue.value.reason,
);

const editorInit = (editor: any, monaco: any) => {
  editor.updateOptions({ readOnly: isSaaS });
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
    if (!canUpdate.value) return;
    const item = {
        provider: 'jsr223',
        configuration: {
            script: editorValue.value,
            lang: 'javascript',
        },
    };
    const res = await saveProductCode(productStore.current.id, item);
    if (res.status === 200) {
        onlyMessage($t('DataAnalysis.index.571961-9'));
        getProductCode();
    }
};

const debug = () => {
    if (!canUpdate.value) return;
    if (productStore.current.transportProtocol === 'MQTT') {
        if (topic.value !== '') {
            test({
                headers: {
                    topic: topic.value,
                },
                configuration: {
                    script: editorValue.value,
                    lang: 'javascript',
                },
                provider: 'jsr223',
                payload: simulation.value,
            });
            isTest.value = true;
        } else {
            onlyMessage($t('DataAnalysis.index.571961-10'), 'error');
        }
    } else {
        if (url.value !== '') {
            test({
                headers: {
                    url: url.value,
                },
                provider: 'jsr223',
                configuration: {
                    script: editorValue.value,
                    lang: 'javascript',
                },
                payload: simulation.value,
            });
            isTest.value = true;
        } else {
            onlyMessage($t('DataAnalysis.index.571961-11'), 'error');
        }
    }
};

onMounted(() => {
  if(productStore.current.id){
    getProductCode();
    if (!isSaaS) {
      getTopic();
      queryCodeTips()
    }
  }
});
</script>

<style scoped lang='less'>
.top {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 10px;
}

.edit {
    height: 550px;
    border: 1px solid #dcdcdc;

    .edit-only {
        height: 550px;
        width: 97%;
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
</style>
