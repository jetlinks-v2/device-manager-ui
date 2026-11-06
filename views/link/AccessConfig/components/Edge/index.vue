<template>
  <DefineEmptyCreate>
    <j-permission-button type="primary" @click="addNetwork" hasPermission="link/Type:add">
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Edge.index.066653-2') }}
    </j-permission-button>
  </DefineEmptyCreate>
  <GatewayFrame
    :wizard="wizard"
    v-bind="$attrs"
    v-if="type === 'edge'"
    :provider="provider"
    :form="formState"
    :steps="channel === 'edge-child-device' ? undefined : steps"
    :current="stepCurrent"
    :network="
      channel === 'edge-child-device' ? undefined : findGatewayResource(allNetworkList, networkCurrent)
    "
    :protocol="{ name: 'official-edge-protocol' }"
    :transport="ProtocolMapping.get(provider.id)"
  >
    <div v-if="channel !== 'edge-child-device'" class="steps-content">
      <div class="steps-box" v-show="current === 0">
        <div class="alert">
          <AIcon type="InfoCircleOutlined" />
          {{ $t('Edge.index.066653-0') }}
        </div>
        <div class="gateway-options">
          <a-row :gutter="[24, 24]" style="width: 100%" v-if="networkList.length > 0">
            <a-col :xs="24" :xl="12" v-for="item in networkList" :key="item.id">
              <AccessCard
                @checkedChange="checkedChange"
                :checked="networkCurrent"
                :data="{
                  ...item,
                  description: item.description ? item.description : descriptionList[provider.id]
                }"
              >
                <template #other>
                  <div class="other">
                    <a-tooltip placement="top" :title="addressesTip(item.addresses)">
                      <!-- <div
                                                v-if="
                                                    (item.addresses || [])
                                                        .length > 1
                                                "
                                            >
                                                <div
                                                    v-for="i in item.addresses ||
                                                    []"
                                                    :key="i.address"
                                                    class="item"
                                                >
                                                    <a-badge
                                                        :status="getColor(i)"
                                                    />{{ i.address }}
                                                </div>
                                            </div> -->
                      <div v-for="i in (item.addresses || []).slice(0, 1)" :key="i.address" class="item">
                        <a-badge :status="getColor(i)" :text="i.address" />
                        <span v-if="(item.addresses || []).length > 1">
                          {{ $t('Edge.index.066653-3') }}{{ item.addresses.length
                          }}{{ $t('Edge.index.066653-4') }}
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
            :description="$t('Edge.index.066653-5')"
            :search="emptyCreateSearch"
            :search-name="$t('Status.index.565893-0')"
          >
            <EmptyCreateButton />
          </CloudEmpty>
        </div>
      </div>
    </div>
    <div v-show="channel === 'edge-child-device' || current === 1" class="card-last">
      <title-component :data="$t('Edge.index.066653-6')" />
      <a-form
        id="gateway-edge-config"
        :model="formState"
        name="basic"
        autocomplete="off"
        layout="vertical"
        @finish="wizard.submit"
        ref="formRef"
      >
        <a-form-item
          :label="$t('Edge.index.066653-7')"
          name="name"
          :rules="[
            {
              required: true,
              message: $t('Edge.index.066653-8'),
              trigger: 'blur'
            },
            {
              max: 64,
              message: $t('Edge.index.066653-9'),
              trigger: 'blur'
            }
          ]"
        >
          <I18nTextField
            :placeholder="$t('Edge.index.066653-8')"
            v-model:value="formState.name"
            v-model:i18nMessages="formState.i18nMessages"
            field="name"
            :label="$t('Edge.index.066653-7')"
            :i18n-max-length="64"
          />
        </a-form-item>
        <DeviceLibraryBizKeyPicker v-model="formState.bizKey" :provider="provider.id" />
        <a-form-item :label="$t('Edge.index.066653-10')" name="description">
          <I18nTextField
            :placeholder="$t('Edge.index.066653-11')"
            :rows="4"
            v-model:value="formState.description"
            v-model:i18nMessages="formState.i18nMessages"
            field="description"
            :label="$t('Edge.index.066653-10')"
            textarea
            show-count
            :maxlength="200"
          />
        </a-form-item>
      </a-form>
    </div>
    <template #summary>
      <GatewayGuide v-show="channel === 'edge-child-device' || current === 1">
        <div class="doc">
          <TitleComponent :data="$t('Edge.index.066653-13')" />
          <p>{{ $t('Edge.index.066653-14') }}{{ provider.name }}</p>
          <p>
            {{ provider.description }}
          </p>
          <p>{{ $t('Edge.index.066653-15') }}{{ provider.id }}</p>
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
import { useEdgeWizard } from './useEdgeWizard';
import GatewayFrame from '../GatewayFrame.vue';
import { findGatewayResource } from '../gatewayOverview';
import GatewayGuide from '../GatewayGuide.vue';
import AccessCard from '../AccessCard/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useEdgeEditor, editorProps } from './useEdgeEditor';
const props = defineProps(editorProps);
const editor = useEdgeEditor(props);
const wizard = useEdgeWizard(editor);
const {
  update, descriptionList, ProtocolMapping, emptyCreateSearch, $t, view, id, loading, type, channel,
  formState, formRef, current, stepCurrent, steps, networkCurrent, networkList, allNetworkList, onFinish,
  checkedChange, getColor, networkSearch, saveData, addNetwork, next, prev, addressesTip, DefineEmptyCreate,
  EmptyCreateButton
} = editor;
</script>

<style lang="less" scoped>
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
.steps-action-save {
    margin-left: 0;
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

.card-last {
    padding-right: 5px;
    overflow-y: auto;
    overflow-x: hidden;
}
.config-right {
    padding: 20px;
    .config-right-item {
        margin-bottom: 10px;

        .config-right-item-title {
            width: 100%;
            margin-bottom: 10px;
            font-weight: 600;
        }

        .config-right-item-context {
            margin: 5px 0;
            color: rgba(0, 0, 0, 0.8);
        }
    }
}
</style>
