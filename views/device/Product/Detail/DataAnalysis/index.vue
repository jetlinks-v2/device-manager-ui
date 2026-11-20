
<template>
    <div class="product-codec">
        <div class="product-codec__toolbar">
          <div class="product-codec__type">
            <a-radio-group :value="codec?.provider || 'jsr223'" button-style="solid" :disabled="!canUpdate || codecLoading || saving" @update:value="changeProvider(String($event))">
              <a-radio-button v-for="option in codecMenuItems" :key="option.value" :value="option.value">{{ option.label }}</a-radio-button>
            </a-radio-group>
            <span>{{ typeDescription }}</span>
          </div>
          <div class="product-codec__actions">
            <span v-if="isDirty" class="product-codec__unsaved">{{ $t('deviceDetailOptimization.unsaved') }}</span>
            <a-button :loading="codecLoading" :disabled="saving" @click="reload">{{ $t('IotDeviceDetail.parsing.reload') }}</a-button>
            <a-button v-if="canUpdate" type="primary" :loading="saving" :disabled="saveDisabled" @click="save">{{ $t('IotDeviceDetail.parsing.saveConfig') }}</a-button>
          </div>
        </div>
        <section class="product-codec__script">
        <div class="top">
            <strong>{{ $t(editorLanguage === 'javascript' ? 'deviceDetailOptimization.script' : 'deviceDetailOptimization.parsingConfiguration') }}</strong>
            <div>
                <span class="product-codec__language">{{ editorLanguage === 'javascript' ? 'JavaScript (ECMAScript 5)' : codec?.provider || 'JSON' }}</span>
                <a-button type="text" :aria-label="$t('IotDeviceDetail.scriptCodec.fullscreen')" @click="toggle"><AIcon type="ExpandOutlined" /></a-button>
            </div>
        </div>
        <a-alert v-if="codecFailed" type="error" :message="$t('Product.codec.loadFailed')" show-icon>
            <template #action><a-button @click="getProductCode">{{ $t('PropertyRules.retry') }}</a-button></template>
        </a-alert>
        <a-spin v-else :spinning="codecLoading">
            <div class="edit" ref="el">
                <monaco-editor
                    :key="editorLanguage"
                    :language="editorLanguage"
                    :read-only="!canUpdate || saving"
                    :auto-format="false"
                    style="height: 100%"
                    theme="vs"
                    v-model:modelValue="editorValue"
                    :registrationTypescript="typescriptTip"
                    :init="editorInit"
                />
            </div>
        </a-spin>
        </section>
        <CodecDebugPanel v-model:topic="topic" v-model:url="url" v-model:payload="simulation"
            :state="{ mqtt: productStore.current.transportProtocol === 'MQTT', options: topicList, loading, disabled: isDisabled, canDebug: canUpdate, result, success: resultSuccess, finishedAt: resultTime }"
            @debug="debug" />
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CodecDebugPanel from '../../../components/CodecDebugPanel.vue'
import { useProductDataAnalysis } from './useProductDataAnalysis'
defineOptions({ name: 'DataAnalysis' })
const { t: $t } = useI18n()
const { canUpdate, productStore, codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, reload, codecMenuItems, typeDescription, changeProvider, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, resultSuccess, resultTime, result, loading, isDisabled, isDirty, saving, saveDisabled, debug, save } = useProductDataAnalysis()
</script>

<style scoped lang="less" src="./index.less" />
