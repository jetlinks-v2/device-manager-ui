<template>
  <div class="product-codec">
    <div class="product-codec__toolbar">
      <div v-if="codecProvider" class="product-codec__type">
        <a-radio-group v-if="canUpdate && !configuredProvider && codecProviders.length > 1"
          :value="codecProvider" :disabled="codecLoading || loading || saving" button-style="solid"
          @update:value="selectProvider(String($event))">
          <a-radio-button v-for="option in codecProviders" :key="option.id" :value="option.id">
            {{ providerLabel(option.id) }}
          </a-radio-button>
        </a-radio-group>
        <a-tag v-else class="product-codec__provider" :bordered="false">{{ providerLabel(codecProvider) }}</a-tag>
        <span v-if="typeDescription">{{ typeDescription }}</span>
      </div>
      <div class="product-codec__actions">
        <a-button :loading="codecLoading" :disabled="saving || loading" @click="getProductCode(true)">{{ $t('IotDeviceDetail.parsing.reload') }}</a-button>
        <a-button v-if="canUpdate && codecProvider && (canUseCodec || codecLoading)" type="primary" :loading="saving"
          :disabled="!canWriteCodec || loading || !editorValue.trim()"
          @click="save()">
          {{ $t('IotDeviceDetail.parsing.saveConfig') }}
        </a-button>
      </div>
    </div>
    <a-alert v-if="codecFailed" type="error" :message="$t('Product.codec.loadFailed')" show-icon>
      <template #action><a-button @click="getProductCode(true)">{{ $t('PropertyRules.retry') }}</a-button></template>
    </a-alert>
    <a-spin v-else-if="codecLoading && !codecProvider" :tip="$t('IotDeviceDetail.parsing.loading')" />
    <CloudEmpty v-else-if="!codecProvider" :description="$t(codecProviders.length ? 'Product.codec.empty' : 'Product.codec.noSupportedProvider')" />
    <template v-else>
      <a-alert v-if="!canUseCodec && !codecLoading" type="warning" show-icon
        :message="$t('Product.codec.providerUnavailable', { provider: providerLabel(codecProvider) })" />
      <section class="product-codec__script">
        <div class="top">
          <strong>{{ $t(isScript ? 'deviceDetailOptimization.script' : 'deviceDetailOptimization.parsingConfiguration') }}</strong>
          <div class="product-codec__editor-actions">
            <span class="product-codec__language">{{ isScript ? 'JavaScript (ECMAScript 5)' : 'JSON' }}</span>
            <a-button type="text" :aria-label="$t('IotDeviceDetail.scriptCodec.fullscreen')" @click="toggle"><AIcon type="ExpandOutlined" /></a-button>
          </div>
        </div>
        <a-spin :spinning="codecLoading">
          <div class="edit" ref="el">
            <monaco-editor :key="editorLanguage" :language="editorLanguage" :read-only="!canWriteCodec || saving" :auto-format="isScript"
              style="height: 100%" theme="vs" v-model:modelValue="editorValue"
              :registrationTypescript="isScript ? typescriptTip : undefined" :init="editorInit" />
          </div>
        </a-spin>
      </section>
      <section v-if="canUseCodec || codecLoading" class="product-codec__debug">
        <div class="product-codec__debug-header">
          <strong>{{ $t('IotDeviceDetail.scriptCodec.mockInput') }}</strong>
          <a-button v-if="canUpdate" type="primary" :loading="loading" :disabled="isDisabled"
            :tooltip="{ title: $t('DataAnalysis.index.571961-5') }" @click="debug()">
            {{ $t('IotDeviceDetail.scriptCodec.debug') }}
          </a-button>
        </div>
        <div class="product-codec__debug-body">
          <a-form layout="vertical" class="product-codec__debug-form">
            <a-form-item :label="productStore.current.transportProtocol === 'MQTT' ? 'Topic' : 'URL'" class="product-codec__address">
              <template v-if="productStore.current.transportProtocol === 'MQTT'">
                <a-auto-complete :placeholder="$t('DataAnalysis.index.571961-2')" :options="topicList" :allowClear="true"
                  :filterOption="(inputValue: any, option: any) => option!.value.indexOf(inputValue) !== -1" v-model:value="topic" />
              </template>
              <template v-else>
                <a-input :placeholder="$t('DataAnalysis.index.571961-3')" v-model:value="url" />
              </template>
            </a-form-item>
            <a-form-item :label="$t('InstanceDeviceAccess.payloadView.raw')">
              <a-textarea :rows="4" :placeholder="$t('IotDeviceDetail.scriptCodec.dataPlaceholder')" v-model:value="simulation" />
            </a-form-item>
          </a-form>
          <section class="product-codec__result">
            <div class="product-codec__result-header"><strong>{{ $t('IotDeviceDetail.scriptCodec.parseResult') }}</strong></div>
            <a-textarea :rows="5" :style="resStyle" :value="result" readonly />
          </section>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { productCodecSupportKey } from './useProductCodec'
import { useProductDataAnalysis } from './useProductDataAnalysis'

defineOptions({ name: 'DataAnalysis' })
const { t: $t } = useI18n()
const { canUpdate, canWriteCodec, canUseCodec, productStore, editorValue, editorLanguage, codecLoading, codecFailed,
  codecProvider, configuredProvider, codecProviders, isScript, providerLabel, typeDescription, selectProvider,
  getProductCode, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, result, resStyle, loading, saving, isDisabled, debug, save } = useProductDataAnalysis(inject(productCodecSupportKey))
</script>

<style scoped lang="less" src="./index.less" />
