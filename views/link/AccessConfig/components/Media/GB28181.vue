<template>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    :provider="provider"
    :form="formData"
    :steps="steps"
    :current="stepCurrent"
    :protocol="{ name: provider.name }"
    transport="SIP"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 0"
      >
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Media.GB28181.666483-0') }}
        </div>

        <Gb28181SignalForm :editor="editor" />
        <div v-if="!formState.shareCluster">
          <Gb28181ClusterForm :editor="editor" />
        </div>
      </div>
      <div
        class="steps-box"
        v-show="current === 1"
      >
        <div
          class="card-last"
          :style="`max-height:${clientHeight > 900 ? 750 : clientHeight * 0.7}px`"
        >
          <title-component :data="$t('Media.GB28181.666483-26')" />
          <div>
            <a-form
              :model="formData"
              layout="vertical"
            >
              <a-form-item
                :label="$t('Media.GB28181.666483-27')"
                v-bind="validateInfos.name"
              >
                <I18nTextField
                  v-model:value="formData.name"
                  v-model:i18nMessages="formData.i18nMessages"
                  field="name"
                  :label="$t('Media.GB28181.666483-27')"
                  :i18n-max-length="64"
                  allowClear
                  :placeholder="$t('Media.GB28181.666483-28')"
                />
              </a-form-item>
              <DeviceLibraryBizKeyPicker
                v-model="formData.bizKey"
                :provider="provider.id"
              />

              <a-form-item
                :label="$t('Media.GB28181.666483-29')"
                v-bind="validateInfos.description"
              >
                <I18nTextField
                  :placeholder="$t('Media.GB28181.666483-30')"
                  :rows="4"
                  v-model:value="formData.description"
                  v-model:i18nMessages="formData.i18nMessages"
                  field="description"
                  :label="$t('Media.GB28181.666483-29')"
                  textarea
                  show-count
                  :maxlength="200"
                />
              </a-form-item>
            </a-form>
          </div>

        </div>
      </div>
    </div>
    <template #summary>
      <GatewayGuide v-show="current === 1">
        <div class="doc">
          <title-component :data="$t('Media.GB28181.666483-31')" />
          <a-descriptions
            :column="1"
            :labelStyle="{ width: '80px' }"
          >
            <a-descriptions-item :label="$t('Media.GB28181.666483-32')">
              {{ provider.name }}
            </a-descriptions-item>
            <a-descriptions-item>
              <span style="color: #a3a3a3">{{ provider.description }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('Media.GB28181.666483-1')">
              {{ formState.domain }}
            </a-descriptions-item>
            <a-descriptions-item label="SIP ID">{{ formState.sipId }}</a-descriptions-item>
            <a-descriptions-item>
              <!--               {{ $t('Media.GB28181.666483-8') }}                 -->
              <template v-if="formState.shareCluster">
                <a-badge
                  :text="`${formState.hostPort.publicHost}:${formState.hostPort.publicPort}`"
                  status="processing"
                />
              </template>
              <template v-else>
                <a-badge
                  v-for="i in dynamicValidateForm.cluster"
                  :text="`${i.publicHost}:${i.publicPort}`"
                  status="processing"
                />
              </template>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </GatewayGuide>
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
import Gb28181ClusterForm from './Gb28181ClusterForm.vue';
import Gb28181SignalForm from './Gb28181SignalForm.vue';
import { useSignalWizard } from './useSignalWizard';
import GatewayFrame from '../GatewayFrame.vue';
import GatewayGuide from '../GatewayGuide.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useGb28181Editor, editorProps } from './useGb28181Editor';
const props = defineProps(editorProps);
const editor = useGb28181Editor(props);
const wizard = useSignalWizard(editor);
const {
  update, $t, view, id, loading, clientHeight, current, stepCurrent, steps, formData, formState,
  dynamicValidateForm, validateInfos, saveData, next, prev
} = editor;
</script>

<style scoped lang="less" src="./useGb28181Editor.less"></style>
