<template>
  <DefineEmptyCreate>
    <j-permission-button
      v-if="showAddBtn"
      type="primary"
      @click="addProcotol"
      hasPermission="link/Protocol:add"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Cloud.OneNet.808542-38') }}
    </j-permission-button>
  </DefineEmptyCreate>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    :provider="provider"
    :form="formData"
    :steps="steps"
    :current="stepCurrent"
    :protocol="findGatewayResource(allProcotolList, procotolCurrent)"
    transport="HTTP"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 0"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Cloud.OneNet.808542-0') }}
        </div>
        <div style="margin-top: 42px">
          <OneNetServiceForm :editor="editor" />
        </div>
      </div>
    </div>
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 1"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Cloud.OneNet.808542-36') }}
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
              :key="item.id"
            >
              <AccessCard
                @checkedChange="procotolChange"
                :checked="procotolCurrent"
                :disabled="!showAddBtn"
                :data="{ ...item, type: 'protocol' }"
              ></AccessCard>
            </a-col>
          </a-row>
          <CloudEmpty
            style="margin-top: 10%"
            v-else
            :description="$t('Cloud.OneNet.808542-39')"
            :search="emptyCreateSearch"
            :search-name="$t('DeviceAccess.accessModal.132524-4')"
          >
            <EmptyCreateButton />
          </CloudEmpty>
        </div>
      </div>
    </div>
    <div
      v-show="current === 2"
      class="card-last"
    >
      <title-component :data="$t('Cloud.OneNet.808542-40')" />
      <div>
        <a-form
          :model="formData"
          name="basic"
          autocomplete="off"
          layout="vertical"
          ref="formRef2"
        >
          <a-form-item
            :label="$t('Cloud.OneNet.808542-41')"
            name="name"
            :rules="[
              {
                required: true,
                message: $t('Cloud.OneNet.808542-42'),
                trigger: 'blur'
              },
              {
                max: 64,
                message: $t('Cloud.OneNet.808542-4'),
                trigger: 'blur'
              }
            ]"
          >
            <I18nTextField
              :placeholder="$t('Cloud.OneNet.808542-42')"
              v-model:value="formData.name"
              v-model:i18nMessages="formData.i18nMessages"
              field="name"
              :label="$t('Cloud.OneNet.808542-41')"
              :i18n-max-length="64"
            />
          </a-form-item>
          <DeviceLibraryBizKeyPicker
            v-model="formData.bizKey"
            :provider="provider.id"
          />
          <a-form-item
            :label="$t('Cloud.OneNet.808542-10')"
            name="description"
          >
            <I18nTextField
              :placeholder="$t('Cloud.OneNet.808542-11')"
              :rows="4"
              v-model:value="formData.description"
              v-model:i18nMessages="formData.i18nMessages"
              field="description"
              :label="$t('Cloud.OneNet.808542-10')"
              textarea
              show-count
              :maxlength="200"
            />
          </a-form-item>
        </a-form>
      </div>

    </div>
    <template #summary>
      <OneNetGuide1 v-show="current === 0" :editor="editor" />
      <OneNetGuide2 v-show="current === 2" :editor="editor" />
    </template>
    <template #actions>
      <j-permission-button v-if="view === 'false'" type="primary" :loading="loading || wizard.pending.value"
        :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`" @click="wizard.submit">
        {{ $t('GatewayEditor.confirm') }}
      </j-permission-button>
    </template>
  </GatewayFrame>
</template>

<script setup lang="ts">
import OneNetServiceForm from './OneNetServiceForm.vue';
import OneNetGuide2 from './OneNetGuide2.vue';
import OneNetGuide1 from './OneNetGuide1.vue';
import { useCloudWizard } from './useCloudWizard';
import GatewayFrame from '../GatewayFrame.vue';
import { findGatewayResource } from '../gatewayOverview';
import AccessCard from '../AccessCard/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useOneNetEditor, editorProps } from './useOneNetEditor';
const props = defineProps(editorProps);
const editor = useOneNetEditor(props);
const wizard = useCloudWizard(editor);
const {
  update, emptyCreateSearch, $t, view, id, formRef2, formData, loading, current, stepCurrent, steps,
  procotolList, allProcotolList, procotolCurrent, showAddBtn, procotolChange, procotolSearch, saveData,
  addProcotol, next, prev, DefineEmptyCreate, EmptyCreateButton
} = editor;
</script>

<style scoped lang="less" src="./useOneNetEditor.less"></style>
