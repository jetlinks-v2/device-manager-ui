<template>
  <div class="card-last">
    <a-form
      id="gateway-collector-config"
      :model="formState"
      autocomplete="off"
      layout="vertical"
      name="basic"
      @finish="onFinish"
    >
      <GatewayFrame
        :provider="provider"
        :form="formState"
        :protocol="{ name: provider.name, description: provider.description }"
        :transport="ProtocolMapping.get(provider.id)"
      >
        <a-form-item
          :rules="[
            {
              required: true,
              message: $t('Edge.geteway.598238-1'),
              trigger: 'blur'
            },
            {
              max: 64,
              message: $t('Edge.geteway.598238-2'),
              trigger: 'blur'
            }
          ]"
          :label="$t('Edge.geteway.598238-3')"
          name="name"
        >
          <I18nTextField
            v-model:value="formState.name"
            v-model:i18nMessages="formState.i18nMessages"
            field="name"
            :label="$t('Edge.geteway.598238-0')"
            :i18n-max-length="64"
            :placeholder="$t('Edge.geteway.598238-1')"
          />
        </a-form-item>
        <a-form-item
          :label="$t('Edge.geteway.598238-4')"
          name="description"
        >
          <I18nTextField
            v-model:value="formState.description"
            v-model:i18nMessages="formState.i18nMessages"
            field="description"
            :label="$t('Edge.geteway.598238-4')"
            textarea
            :maxlength="200"
            :rows="4"
            :placeholder="$t('Edge.geteway.598238-5')"
            show-count
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
              <TitleComponent :data="$t('Edge.geteway.598238-7')" />
              <p>{{ $t('Edge.geteway.598238-8') }}{{ provider.name }}</p>
              <p>
                {{ provider.description }}
              </p>
              <p>{{ $t('Edge.geteway.598238-9') }}</p>
              <TitleComponent :data="$t('Edge.geteway.598238-9')" />
              <p>{{ $t('Edge.geteway.598238-10') }}</p>
              <p>{{ $t('Edge.geteway.598238-11') }}</p>
              <p>{{ $t('Edge.geteway.598238-12') }}</p>
              <p>{{ $t('Edge.geteway.598238-13') }}</p>
            </div>
          </GatewayGuide>
        </template>
        <template #actions>
          <j-permission-button
            v-if="view === 'false'"
            :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`"
            html-type="submit"
            form="gateway-collector-config"
            type="primary"
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
import { useCollectorEditor, editorProps } from './useCollectorEditor';
const props = defineProps(editorProps);
const editor = useCollectorEditor(props);
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
