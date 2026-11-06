<template>
  <div
    v-if="type === 'channel'"
    class="card-last"
  >
    <a-form
      id="gateway-channel-config"
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
        :transport="ProtocolMapping.get(provider.id)"
      >
        <a-form-item
          :label="$t('Channel.index.456223-1')"
          name="name"
          :rules="[
            {
              required: true,
              message: $t('Channel.index.456223-2'),
              trigger: 'blur'
            },
            {
              max: 64,
              message: $t('Channel.index.456223-3'),
              trigger: 'blur'
            }
          ]"
        >
          <I18nTextField
            :placeholder="$t('Channel.index.456223-2')"
            v-model:value="formState.name"
            v-model:i18nMessages="formState.i18nMessages"
            field="name"
            :label="$t('Channel.index.456223-1')"
            :i18n-max-length="64"
          />
        </a-form-item>
        <a-form-item
          :label="$t('Channel.index.456223-4')"
          name="description"
        >
          <I18nTextField
            :placeholder="$t('Channel.index.456223-5')"
            :rows="4"
            v-model:value="formState.description"
            v-model:i18nMessages="formState.i18nMessages"
            field="description"
            :label="$t('Channel.index.456223-4')"
            textarea
            show-count
            :maxlength="200"
          />
        </a-form-item>
        <DeviceLibraryBizKeyPicker
          v-model="formState.bizKey"
          :provider="provider.id"
        />

        <template #summary>
          <GatewayGuide>
            <div
              class="doc"
              style="height: 600px"
            >
              <TitleComponent :data="$t('Channel.index.456223-7')" />
              <p>{{ $t('Channel.index.456223-8') }}{{ provider.name }}</p>
              <p>
                {{ provider.description }}
              </p>
              <!-- <p>消息协议：{{ provider.id }}</p> -->
              <TitleComponent :data="$t('Channel.index.456223-9')" />
              <p>{{ $t('Channel.index.456223-10') }}{{ provider.name }}{{ $t('Channel.index.456223-11') }}</p>
              <p>{{ $t('Channel.index.456223-12') }}{{ provider.name }}{{ $t('Channel.index.456223-13') }}</p>
              <p>{{ $t('Channel.index.456223-14') }}{{ provider.name }}</p>
              <p>{{ $t('Channel.index.456223-15') }}</p>
            </div>
          </GatewayGuide>
        </template>
        <template #actions>
          <j-permission-button
            v-if="view === 'false'"
            type="primary"
            html-type="submit"
            form="gateway-channel-config"
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
import { useChannelEditor, editorProps } from './useChannelEditor';
const props = defineProps(editorProps);
const editor = useChannelEditor(props);
const {
  update, ProtocolMapping, $t, view, id, loading, type, formState, onFinish
} = editor;
</script>

<style lang="less" scoped>
.card-last {
    padding-right: 5px;
    overflow-y: auto;
    overflow-x: hidden;
}
</style>
