<template>
  <DefineEmptyCreate>
    <j-permission-button
      v-if="showAddBtn"
      type="primary"
      @click="addPlugin"
      hasPermission="link/plugin:add"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Plugin.index.626239-3') }}
    </j-permission-button>
  </DefineEmptyCreate>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    :provider="provider"
    :form="formData"
    :steps="[$t('Plugin.index.626239-0'), $t('GatewayEditor.basic')]"
    :current="current"
    :protocol="findGatewayResource(pluginList, AccessCurrent)"
    transport="plugin"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-show="current === 0"
      >
        <div class="gateway-options">
          <a-row
            :gutter="[24, 24]"
            style="width: 100%"
            v-if="pluginList.length > 0"
          >
            <a-col
              :xs="24" :xl="12"
              v-for="item in pluginList"
              :key="item.id"
            >
              <AccessCard
                @checkedChange="AccessChange"
                :checked="AccessCurrent"
                :disabled="!showAddBtn"
                :data="{ ...item, type: 'plugin' }"
              >
                <template #other>
                  <div class="plugin-other">
                    <div class="plugin-id">
                      <div class="plugin-text">
                        {{ $t('Plugin.index.626239-4') }}
                      </div>
                      <div class="other-content">
                        <j-ellipsis>
                          {{ item.id }}
                        </j-ellipsis>
                      </div>
                    </div>
                    <div class="plugin-version">
                      <div class="plugin-text">
                        {{ $t('Plugin.index.626239-5') }}
                      </div>
                      <div class="other-content">
                        <j-ellipsis>
                          {{ item.version }}
                        </j-ellipsis>
                      </div>
                    </div>
                  </div>
                </template>
              </AccessCard>
            </a-col>
          </a-row>
          <CloudEmpty
            style="margin-top: 10%"
            v-else
            :description="$t('Plugin.index.626239-6')"
            :search="emptyCreateSearch"
            :search-name="$t('components.SecondKind.311605-0')"
          >
            <EmptyCreateButton />
          </CloudEmpty>
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
          <a-row :gutter="[24, 24]">
            <a-col :span="24">
              <title-component :data="$t('Plugin.index.626239-7')" />
              <a-form
                ref="formRef"
                :model="formData"
                layout="vertical"
              >
                <a-form-item
                  :label="$t('Plugin.index.626239-8')"
                  :rules="[
                    {
                      required: true,
                      message: $t('Plugin.index.626239-9'),
                      trigger: 'blur'
                    },
                    {
                      max: 64,
                      message: $t('Plugin.index.626239-10')
                    }
                  ]"
                  name="name"
                >
                  <I18nTextField
                    v-model:value="formData.name"
                    v-model:i18nMessages="formData.i18nMessages"
                    field="name"
                    :label="$t('Plugin.index.626239-8')"
                    :i18n-max-length="64"
                    allowClear
                    :placeholder="$t('Plugin.index.626239-9')"
                  />
                </a-form-item>
                <a-form-item
                  :label="$t('Plugin.index.626239-11')"
                  :rules="[
                    {
                      max: 200,
                      message: $t('Plugin.index.626239-12')
                    }
                  ]"
                  name="description"
                >
                  <I18nTextField
                    :placeholder="$t('Plugin.index.626239-13')"
                    :rows="4"
                    v-model:value="formData.description"
                    v-model:i18nMessages="formData.i18nMessages"
                    field="description"
                    :label="$t('Plugin.index.626239-11')"
                    textarea
                    show-count
                    :maxlength="200"
                  />
                </a-form-item>
                <DeviceLibraryBizKeyPicker
                  v-model="formData.bizKey"
                  :provider="provider.id"
                />
                <template v-if="config.length">
                  <title-component :data="$t('Plugin.index.626239-14')" />
                  <a-form-item
                    v-for="item in config"
                    :key="item.name"
                    :name="['configuration', item.name]"
                    :label="item.label"
                    :rules="item.rules"
                    :required="!!item.type?.expands?.required"
                  >
                    <j-value-item
                      v-model:modelValue="formData.configuration[item.name]"
                      :itemType="item.type"
                      :options="item.options"
                    />
                  </a-form-item>
                </template>
              </a-form>
            </a-col>
          </a-row>
        </div>
      </div>
    </div>
    <template #actions>
      <j-permission-button v-if="view === 'false'" type="primary" :loading="loading || wizard.pending.value"
        :hasPermission="`link/AccessConfig:${paramsId === ':id' ? 'add' : 'update'}`" @click="wizard.submit">
        {{ $t('GatewayEditor.confirm') }}
      </j-permission-button>
    </template>
  </GatewayFrame>
</template>

<script setup lang="ts">
import { usePluginWizard } from './usePluginWizard';
import GatewayFrame from '../GatewayFrame.vue';
import { findGatewayResource } from '../gatewayOverview';
import AccessCard from '../AccessCard/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { usePluginEditor, editorProps } from './usePluginEditor';
const props = defineProps(editorProps);
const editor = usePluginEditor(props);
const wizard = usePluginWizard(editor);
const {
  update, emptyCreateSearch, $t, paramsId, current, pluginList, AccessCurrent, view, clientHeight, loading, formData,
  formRef, config, showAddBtn, pluginSearch, AccessChange, addPlugin, next, prev, saveData,
  DefineEmptyCreate, EmptyCreateButton
} = editor;
</script>

<style scoped lang="less">
.steps-content {
    margin-top: 20px;
}
.steps-box {
    min-height: 400px;
    .card-last {
        padding-right: 5px;
        overflow-y: auto;
        overflow-x: hidden;
    }
}
.steps-action {
    width: 100%;
    margin-top: 24px;
}
.alert {
    height: 40px;
    padding-left: 10px;
    color: rgba(0, 0, 0, 0.55);
    line-height: 40px;
    background-color: #f6f6f6;
}
.search {
    display: flex;
    margin: 15px 0;
    justify-content: space-between;
}

.other {
    width: 100%;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    .item {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
}

.plugin-other {
    display: flex;
    gap: 16px;
    .plugin-id,
    .plugin-version {
        color: rgba(0, 0, 0, 0.85);
        opacity: 0.45;
        display: flex;

        .plugin-text {
            white-space: nowrap;
        }
    }

    .plugin-id {
        width: 50%;
        // .other-content {
        //   display: flex;
        //   width: 0;
        //   flex-grow: 1;
        // }
    }
}
</style>
