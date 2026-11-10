<template>
  <div class="container">
    <div
      v-if="channel === 'fixed-media'"
      class="card-last"
    >
      <a-form
        id="gateway-media-config"
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
          transport="URL"
        >
          <a-form-item
            :label="$t('Media.index.962215-1')"
            name="name"
            :rules="[
              {
                required: true,
                message: $t('Media.index.962215-2'),
                trigger: 'blur'
              },
              {
                max: 64,
                message: $t('Media.index.962215-3'),
                trigger: 'blur'
              }
            ]"
          >
            <I18nTextField
              :placeholder="$t('Media.index.962215-2')"
              v-model:value="formState.name"
              v-model:i18nMessages="formState.i18nMessages"
              field="name"
              :label="$t('Media.index.962215-1')"
              :i18n-max-length="64"
            />
          </a-form-item>
          <DeviceLibraryBizKeyPicker
            v-model="formState.bizKey"
            :provider="provider.id"
          />
          <a-form-item
            :label="$t('Media.index.962215-4')"
            name="description"
          >
            <I18nTextField
              :placeholder="$t('Media.index.962215-5')"
              :rows="4"
              v-model:value="formState.description"
              v-model:i18nMessages="formState.i18nMessages"
              field="description"
              :label="$t('Media.index.962215-4')"
              textarea
              show-count
              :maxlength="200"
            />
          </a-form-item>

          <template #summary>
            <GatewayGuide>
              <div class="doc">
                <h1>{{ $t('Media.index.962215-7') }}</h1>
                <p>
                  {{ provider.name }}
                </p>
                <p>
                  {{ provider.description }}
                </p>
                <h1>{{ $t('Media.index.962215-8') }}</h1>
                <p>
                  {{ provider.id === 'fixed-media' ? 'URL' : 'SIP' }}
                </p>
              </div>
            </GatewayGuide>
          </template>
          <template #actions>
            <j-permission-button
              v-if="view === 'false'"
              type="primary"
              html-type="submit"
              form="gateway-media-config"
              :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`"
              :loading="loading"
            >
              {{ $t('GatewayEditor.confirm') }}
            </j-permission-button>
          </template>
        </GatewayFrame>
      </a-form>
    </div>
    <div v-else-if="channel === 'gb28181'">
      <GB28181
        :provider="props.provider"
        :data="props.data"
      ></GB28181>
    </div>
    <div v-else-if="channel === 'onvif'">
      <Onvif
        :provider="props.provider"
        :data="props.data"
      ></Onvif>
    </div>
    <div v-else-if="channel === 'plugin'">
      <Plugin
        :bindProduct="bindProduct"
        :data="data"
        :provider="provider"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import GatewayFrame from '../GatewayFrame.vue';
import GatewayGuide from '../GatewayGuide.vue';
import GB28181 from './GB28181.vue';
import Onvif from './Onvif.vue';
import Plugin from '../Plugin/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useFixedMediaEditor, editorProps } from './useFixedMediaEditor';
const props = defineProps(editorProps);
const editor = useFixedMediaEditor(props);
const {
  update, $t, view, id, loading, channel, formState, onFinish
} = editor;
</script>

<style lang="less" scoped>
.container {
    margin: 20px;
}

.card-last {
    padding-right: 5px;
    overflow-y: auto;
    overflow-x: hidden;
}
</style>
