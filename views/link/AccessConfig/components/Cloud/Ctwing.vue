<template>
  <DefineEmptyCreate>
    <j-permission-button
      v-if="showAddBtn"
      type="primary"
      @click="addProtocol"
      hasPermission="link/Protocol:add"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Cloud.Ctwing.076179-24') }}
    </j-permission-button>
  </DefineEmptyCreate>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    :provider="provider"
    :form="formData"
    :steps="steps"
    :current="stepCurrent"
    :protocol="findGatewayResource(allProtocolList, protocolCurrent)"
    transport="HTTP"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 0"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Cloud.Ctwing.076179-0') }}
        </div>
        <div style="margin-top: 42px">
          <a-form
            :model="formState"
            ref="formRef1"
            name="basic"
            autocomplete="off"
            layout="vertical"
          >
            <a-row :gutter="[24, 24]">
              <a-col :span="12">
                <a-form-item
                  :label="$t('Cloud.Ctwing.076179-1')"
                  name="apiAddress"
                  :rules="[
                    {
                      required: true
                    }
                  ]"
                >
                  <a-input v-model:value="formState.apiAddress" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item
                  label="appKey"
                  name="appKey"
                  :rules="[
                    {
                      required: true,
                      message: $t('Cloud.Ctwing.076179-2')
                    },
                    {
                      max: 64,
                      message: $t('Cloud.Ctwing.076179-3'),
                      trigger: 'blur'
                    }
                  ]"
                >
                  <a-input
                    v-model:value="formState.appKey"
                    :placeholder="$t('Cloud.Ctwing.076179-2')"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="[24, 24]">
              <a-col :span="12">
                <a-form-item
                  label="appSecret"
                  name="appSecret"
                  :rules="[
                    {
                      required: true,
                      message: $t('Cloud.Ctwing.076179-4')
                    },
                    {
                      max: 64,
                      message: $t('Cloud.Ctwing.076179-3'),
                      trigger: 'blur'
                    }
                  ]"
                >
                  <a-input
                    v-model:value="formState.appSecret"
                    :placeholder="$t('Cloud.Ctwing.076179-4')"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="[24, 24]">
              <a-col :span="24">
                <a-form-item
                  :label="$t('Cloud.Ctwing.076179-5')"
                  name="description"
                >
                  <a-textarea
                    :placeholder="$t('Cloud.Ctwing.076179-6')"
                    :rows="4"
                    v-model:value="formState.description"
                    show-count
                    :maxlength="200"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
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
          {{ $t('Cloud.Ctwing.076179-22') }}
        </div>
        <div class="gateway-options">
          <a-row
            :gutter="[24, 24]"
            style="width: 100%"
            v-if="protocolList.length > 0"
          >
            <a-col
              :xs="24" :xl="12"
              v-for="item in protocolList"
              :key="item.id"
            >
              <AccessCard
                @checkedChange="protocolChange"
                :checked="protocolCurrent"
                :disabled="!showAddBtn"
                :data="{ ...item, type: 'protocol' }"
              ></AccessCard>
            </a-col>
          </a-row>
          <CloudEmpty
            style="margin-top: 10%"
            v-else
            :description="$t('Cloud.Ctwing.076179-25')"
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
      <TitleComponent :data="$t('Cloud.Ctwing.076179-26')" />
      <a-form
        :model="formData"
        name="basic"
        autocomplete="off"
        layout="vertical"
        ref="formRef2"
      >
        <a-form-item
          :label="$t('Cloud.Ctwing.076179-27')"
          name="name"
          :rules="[
            {
              required: true,
              message: $t('Cloud.Ctwing.076179-28'),
              trigger: 'blur'
            },
            {
              max: 64,
              message: $t('Cloud.Ctwing.076179-3'),
              trigger: 'blur'
            }
          ]"
        >
          <I18nTextField
            :placeholder="$t('Cloud.Ctwing.076179-28')"
            v-model:value="formData.name"
            v-model:i18nMessages="formData.i18nMessages"
            field="name"
            :label="$t('Cloud.Ctwing.076179-27')"
            :i18n-max-length="64"
          />
        </a-form-item>
        <DeviceLibraryBizKeyPicker
          v-model="formData.bizKey"
          :provider="provider.id"
        />
        <a-form-item
          :label="$t('Cloud.Ctwing.076179-5')"
          name="description"
        >
          <I18nTextField
            :placeholder="$t('Cloud.Ctwing.076179-6')"
            :rows="4"
            v-model:value="formData.description"
            v-model:i18nMessages="formData.i18nMessages"
            field="description"
            :label="$t('Cloud.Ctwing.076179-5')"
            textarea
            show-count
            :maxlength="200"
          />
        </a-form-item>
      </a-form>

    </div>
    <template #summary>
      <CtwingGuide1 v-show="current === 0" :editor="editor" />
      <CtwingGuide2 v-show="current === 2" :editor="editor" />
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
import CtwingGuide2 from './CtwingGuide2.vue';
import CtwingGuide1 from './CtwingGuide1.vue';
import { useCloudWizard } from './useCloudWizard';
import GatewayFrame from '../GatewayFrame.vue';
import { findGatewayResource } from '../gatewayOverview';
import AccessCard from '../AccessCard/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useCtwingEditor, editorProps } from './useCtwingEditor';
const props = defineProps(editorProps);
const editor = useCtwingEditor(props);
const wizard = useCloudWizard(editor);
const {
  update, emptyCreateSearch, $t, view, id, loading, formRef1, formRef2, formState, formData, showAddBtn,
  current, stepCurrent, steps, protocolList, allProtocolList, protocolCurrent, protocolChange,
  protocolSearch, saveData, addProtocol, next, prev, DefineEmptyCreate, EmptyCreateButton
} = editor;
</script>

<style scoped lang="less" src="./useCtwingEditor.less"></style>
