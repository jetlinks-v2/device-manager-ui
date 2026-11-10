<template>
  <div class="card-last">
    <a-form
      id="gateway-onvif-config"
      :model="formState"
      name="basic"
      autocomplete="off"
      layout="vertical"
      @finish="onFinish"
    >
      <GatewayFrame
        :provider="provider"
        :form="formState"
        :protocol="{ name: provider.name, description: provider.description }"
        transport="ONVIF"
      >
        <a-form-item
          :label="$t('Media.Onvif.507446-1')"
          name="name"
          :rules="[
            {
              required: true,
              message: $t('Media.Onvif.507446-2'),
              trigger: 'blur'
            },
            {
              max: 64,
              message: $t('Media.Onvif.507446-3'),
              trigger: 'blur'
            }
          ]"
        >
          <I18nTextField
            :placeholder="$t('Media.Onvif.507446-2')"
            v-model:value="formState.name"
            v-model:i18nMessages="formState.i18nMessages"
            field="name"
            :label="$t('Media.Onvif.507446-1')"
            :i18n-max-length="64"
          />
        </a-form-item>
        <DeviceLibraryBizKeyPicker
          v-model="formState.bizKey"
          :provider="provider.id"
        />
        <a-form-item
          :label="$t('Media.Onvif.507446-4')"
          name="description"
        >
          <I18nTextField
            :placeholder="$t('Media.Onvif.507446-5')"
            :rows="4"
            v-model:value="formState.description"
            v-model:i18nMessages="formState.i18nMessages"
            field="description"
            :label="$t('Media.Onvif.507446-4')"
            textarea
            show-count
            :maxlength="200"
          />
        </a-form-item>

        <template #summary>
          <GatewayGuide>
            <div class="doc">
              <h1>{{ $t('Media.Onvif.507446-7') }}</h1>
              <p>
                {{ $t('Media.Onvif.507446-8') }}
              </p>
              <h1>{{ $t('Media.Onvif.507446-9') }}</h1>
              <p>
                {{ $t('Media.Onvif.507446-10') }}
              </p>
            </div>
          </GatewayGuide>
        </template>
        <template #actions>
          <j-permission-button
            v-if="view === 'false'"
            type="primary"
            html-type="submit"
            form="gateway-onvif-config"
            :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`"
            :loading="loading"
          >
            {{ $t('GatewayEditor.confirm') }}
          </j-permission-button>
        </template>
      </GatewayFrame>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import GatewayFrame from '../GatewayFrame.vue';
import GatewayGuide from '../GatewayGuide.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useOnvifEditor, editorProps } from './useOnvifEditor';
const props = defineProps(editorProps);
const editor = useOnvifEditor(props);
const {
  update, $t, view, id, loading, formState, onFinish
} = editor;
</script>
<style lang="less" scoped>
.card-last {
    padding-right: 5px;
    overflow-y: auto;
    overflow-x: hidden;
}
</style>
