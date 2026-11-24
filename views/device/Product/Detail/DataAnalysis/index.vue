<template>
  <div class="product-codec">
    <div class="product-codec__toolbar">
      <div class="product-codec__type">
        <a-tag class="product-codec__provider" :bordered="false">
          {{ $t('IotDeviceDetail.parsing.javascriptLabel') }}
        </a-tag>
        <span>{{ $t('IotDeviceDetail.parsing.javascriptDesc') }}</span>
      </div>
      <div class="product-codec__actions">
        <a-button :loading="codecLoading" @click="getProductCode">{{ $t('IotDeviceDetail.parsing.reload') }}</a-button>
        <a-button v-if="canUpdate" type="primary" :loading="loading"
          :disabled="codecLoading || codecFailed || !editorValue.trim()"
          @click="save()">
          {{ $t('IotDeviceDetail.parsing.saveConfig') }}
        </a-button>
      </div>
    </div>
    <section class="product-codec__script">
      <div class="top">
        <strong>{{ $t('deviceDetailOptimization.script') }}</strong>
        <div class="product-codec__editor-actions">
          <span class="product-codec__language">JavaScript (ECMAScript 5)</span>
          <a-button type="text" :aria-label="$t('IotDeviceDetail.scriptCodec.fullscreen')" @click="toggle"><AIcon type="ExpandOutlined" /></a-button>
        </div>
      </div>
      <a-alert v-if="codecFailed" type="error" :message="$t('Product.codec.loadFailed')" show-icon>
        <template #action><a-button @click="getProductCode">{{ $t('PropertyRules.retry') }}</a-button></template>
      </a-alert>
      <a-spin v-else :spinning="codecLoading">
        <div class="edit" ref="el">
          <monaco-editor language="javascript" :read-only="!canUpdate"
            style="height: 100%" theme="vs" v-model:modelValue="editorValue"
            :registrationTypescript="typescriptTip" :init="editorInit" />
        </div>
      </a-spin>
    </section>
    <section class="product-codec__debug">
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
          <a-textarea :rows="5" :style="resStyle" v-model:value="result" />
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useProductDataAnalysis } from './useProductDataAnalysis'

defineOptions({ name: 'DataAnalysis' })
const { t: $t } = useI18n()
const { canUpdate, productStore, editorValue, codecLoading, codecFailed, getProductCode, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, result, resStyle, loading, isDisabled, debug, save } = useProductDataAnalysis()
</script>

<style scoped lang="less" src="./index.less" />
