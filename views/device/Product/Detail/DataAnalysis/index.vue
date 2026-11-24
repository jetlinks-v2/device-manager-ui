<template>
  <div class="product-codec">
    <div class="product-codec__toolbar">
      <div class="product-codec__type">
        <a-tag class="product-codec__provider" :bordered="false">
          {{ codec?.provider === 'modbus' ? $t('IotDeviceDetail.parsing.modbusLabel') : !codec?.provider || codec.provider === 'jsr223' ? $t('IotDeviceDetail.parsing.javascriptLabel') : codec.provider }}
        </a-tag>
        <span v-if="!codec?.provider || codec.provider === 'jsr223'">{{ $t('IotDeviceDetail.parsing.javascriptDesc') }}</span>
        <span v-else-if="codec.provider === 'modbus'">{{ $t('IotDeviceDetail.parsing.modbusDesc') }}</span>
      </div>
      <div class="product-codec__actions">
        <a-button :loading="codecLoading || modbusRef?.loading" @click="getProductCode().then(() => modbusRef?.loadConfig())">{{ $t('IotDeviceDetail.parsing.reload') }}</a-button>
        <a-button v-if="canUpdate" type="primary" :loading="isModbus ? modbusRef?.saving : loading"
          :disabled="codecLoading || codecFailed || (isModbus ? !modbusRef || modbusRef.loading : !editorValue.trim())"
          @click="isModbus ? modbusRef?.saveConfig() : save()">
          {{ $t('IotDeviceDetail.parsing.saveConfig') }}
        </a-button>
      </div>
    </div>
    <a-config-provider v-if="isModbus" :component-disabled="!canUpdate">
      <FullPage flex :padding="0" class="product-codec__modbus">
        <ModbusMapping :key="productStore.current.id" ref="modbusRef" scope="product"
          :product-id="productStore.current.id" :metadata="productStore.current.metadata" />
      </FullPage>
    </a-config-provider>
    <template v-else>
    <section class="product-codec__script">
      <div class="top">
        <strong>{{ $t(editorLanguage === 'javascript' ? 'deviceDetailOptimization.script' : 'deviceDetailOptimization.parsingConfiguration') }}</strong>
        <div class="product-codec__editor-actions">
          <span class="product-codec__language">{{ editorLanguage === 'javascript' ? 'JavaScript (ECMAScript 5)' : codec?.provider || 'JSON' }}</span>
          <a-button type="text" :aria-label="$t('IotDeviceDetail.scriptCodec.fullscreen')" @click="toggle"><AIcon type="ExpandOutlined" /></a-button>
        </div>
      </div>
      <a-alert v-if="codecFailed" type="error" :message="$t('Product.codec.loadFailed')" show-icon>
        <template #action><a-button @click="getProductCode">{{ $t('PropertyRules.retry') }}</a-button></template>
      </a-alert>
      <a-spin v-else :spinning="codecLoading">
        <div class="edit" ref="el">
          <monaco-editor :key="editorLanguage" :language="editorLanguage" :read-only="!canUpdate"
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { FullPage } from '@jetlinks-web-core/layout'
import ModbusMapping from '@device-manager-ui/views/device/Instance/Detail/Parsing/ModbusMapping.vue'
import { useProductDataAnalysis } from './useProductDataAnalysis'

defineOptions({ name: 'DataAnalysis' })
const { t: $t } = useI18n()
const { canUpdate, productStore, codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, toggle, el, typescriptTip, editorInit, topicList, topic, url, simulation, result, resStyle, loading, isDisabled, debug, save } = useProductDataAnalysis()
const isModbus = computed(() => codec.value?.provider === 'modbus')
const modbusRef = ref<InstanceType<typeof ModbusMapping>>()
</script>

<style scoped lang="less" src="./index.less" />
