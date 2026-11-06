<template>
  <DefineEmptyCreate1>
    <j-permission-button
      type="primary"
      @click="addNetwork"
      hasPermission="link/Type:add"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Network.index.041705-2') }}
    </j-permission-button>
  </DefineEmptyCreate1>
  <DefineEmptyCreate2>
    <j-permission-button
      v-if="showAddBtn"
      type="primary"
      @click="addProcotol"
      hasPermission="link/Protocol:add"
      :disabled="id !== ':id'"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Network.index.041705-2') }}
    </j-permission-button>
  </DefineEmptyCreate2>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    :provider="provider"
    :form="formData"
    :steps="steps"
    :current="isAgent ? (current === 2 ? 1 : 0) : stepCurrent"
    :network="findGatewayResource(allNetworkList, networkCurrent)"
    :protocol="isAgent ? provider : findGatewayResource(allProcotolList, procotolCurrent)"
    :transport="transport"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 0"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Network.index.041705-0') }}
        </div>
        <div class="gateway-options">
          <a-row
            :gutter="[24, 24]"
            style="width: 100%"
            v-if="networkList.length > 0"
          >
            <a-col
              :xs="24" :xl="12"
              v-for="item in networkList"
              :key="item.id"
            >
              <AccessCard
                @checkedChange="checkedChange"
                :checked="networkCurrent"
                :data="{
                  ...item,
                  description: item.description ? item.description : descriptionList[provider.id],
                  type: 'network'
                }"
              >
                <template #other>
                  <div class="other">
                    <a-tooltip
                      placement="top"
                      :title="addressesTip(item.addresses)"
                    >
                      <div
                        v-for="i in (item.addresses || []).slice(0, 1)"
                        :key="i.address"
                        class="item"
                      >
                        <a-badge
                          :status="getColor(i)"
                          :text="i.address"
                        />
                        <span v-if="(item.addresses || []).length > 1">
                          {{ $t('Network.index.041705-3') }}{{ item.addresses.length
                          }}{{ $t('Network.index.041705-4') }}
                        </span>
                      </div>
                    </a-tooltip>
                  </div>
                </template>
              </AccessCard>
            </a-col>
          </a-row>
          <CloudEmpty
            style="margin-top: 10%"
            v-else
            :description="$t('Network.index.041705-5')"
            :search="emptyNetworkSearch"
            :search-name="$t('Status.index.565893-0')"
          >
            <EmptyCreateButton1 />
          </CloudEmpty>
        </div>
      </div>
      <div
        class="steps-box"
        v-show="current === 1"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Network.index.041705-6') }}
        </div>
        <div class="gateway-options">
          <a-row
            :gutter="[24, 24]"
            style="width: 100%"
            v-if="procotolList.length > 0"
          >
            <a-col
              :xs="24" :xl="12"
              v-for="item in procotolList"
              :key="item?.id"
            >
              <AccessCard
                @checkedChange="procotolChange"
                :checked="procotolCurrent"
                :disabled="!showAddBtn || id !== ':id'"
                :data="{ ...item, type: 'protocol' }"
              ></AccessCard>
            </a-col>
          </a-row>
          <CloudEmpty
            style="margin-top: 10%"
            v-else
            :description="$t('Network.index.041705-5')"
            :search="emptyProtocolSearch"
            :search-name="$t('DeviceAccess.accessModal.132524-4')"
          >
            <EmptyCreateButton2 />
          </CloudEmpty>
        </div>
      </div>
      <div
        class="steps-box"
        v-show="current === 2"
      >
        <div
          class="card-last"
          :style="`max-height:${clientHeight > 900 ? 750 : clientHeight * 0.7}px`"
        >
          <title-component :data="$t('Network.index.041705-7')" />
          <a-form
            ref="formRef"
            :model="formData"
            layout="vertical"
          >
            <a-form-item
              :label="$t('Network.index.041705-8')"
              v-bind="validateInfos.name"
            >
              <I18nTextField
                v-model:value="formData.name"
                v-model:i18nMessages="formData.i18nMessages"
                field="name"
                :label="$t('Network.index.041705-8')"
                :i18n-max-length="64"
                allowClear
                :placeholder="$t('Network.index.041705-9')"
              />
            </a-form-item>
            <a-form-item
              :label="$t('Network.index.041705-10')"
              v-bind="validateInfos.description"
            >
              <I18nTextField
                :placeholder="$t('Network.index.041705-11')"
                :rows="4"
                v-model:value="formData.description"
                v-model:i18nMessages="formData.i18nMessages"
                field="description"
                :label="$t('Network.index.041705-10')"
                textarea
                show-count
                :maxlength="200"
              />
            </a-form-item>
            <DeviceLibraryBizKeyPicker
              v-model="formData.bizKey"
              :provider="provider.id"
            />
          </a-form>


        </div>
      </div>
    </div>
    <template #detail-1><NetworkGuide1 :editor="editor" /></template>
    <template #actions>
      <j-permission-button v-if="view === 'false'" type="primary" :loading="loading || wizard.pending.value"
        :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`" @click="wizard.submit">
        {{ $t('GatewayEditor.confirm') }}
      </j-permission-button>
    </template>
  </GatewayFrame>
</template>

<script setup lang="ts">
import NetworkGuide1 from './NetworkGuide1.vue';
import { useNetworkWizard } from './useNetworkWizard';
import GatewayFrame from '../GatewayFrame.vue';
import { findGatewayResource } from '../gatewayOverview';
import AccessCard from "../AccessCard/index.vue";
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useNetworkEditor, editorProps } from './useNetworkEditor';
const props = defineProps(editorProps);
const editor = useNetworkEditor(props);
const wizard = useNetworkWizard(editor);
const {
  update, descriptionList, emptyNetworkSearch, emptyProtocolSearch, $t, clientHeight, type, view, id,
  formRef, isAgent, current, stepCurrent, steps, networkList, allNetworkList, procotolList, allProcotolList,
  networkCurrent, procotolCurrent, formData, loading, validateInfos, showAddBtn, addNetwork, addProcotol,
  getColor, checkedChange, networkSearch, procotolChange, procotolSearch, transport, saveData, next, prev,
  addressesTip, DefineEmptyCreate1, EmptyCreateButton1, DefineEmptyCreate2, EmptyCreateButton2
} = editor;
</script>

<style scoped lang="less" src="./useNetworkEditor.less"></style>
