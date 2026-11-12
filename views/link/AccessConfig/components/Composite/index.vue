<template>
  <DefineEmptyCreate>
    <j-permission-button
      hasPermission="link/Type:add"
      type="primary"
      @click="handleAdd"
    >
      <template #icon>
        <AIcon type="PlusOutlined" />
      </template>
      {{ $t('GatewayEditor.addChild') }}
    </j-permission-button>
  </DefineEmptyCreate>
  <GatewayChildEditor v-if="childDraft" :draft="childDraft" @save="saveChild" @cancel="cancelChild" @reselect="reselectChild" />
  <ProviderListDrawer v-else-if="providerListVisible" :otherProvider="otherProvider" @close="closeDrawer" @choose="openChild" />
  <GatewayFrame v-else
    :plain="stepCurrent === 0"
    v-bind="$attrs"
    :form="formData"
    :steps="[$t('Composite.index.636069-17'), $t('GatewayEditor.basic')]"
    :current="stepCurrent"
    transport="composite"
    @select="stepCurrent = $event"
  >
    <div class="steps-content">
      <div
        class="steps-box"
        v-if="stepCurrent === 0"
      >
        <div v-if="choosenProviderList.length" class="composite-add"><EmptyCreateButton /></div>
        <CloudEmpty v-else class="composite-empty">
          <template #description>
            <div>{{ $t('GatewayEditor.emptyChildren') }}</div>
            <div class="composite-empty__hint">{{ $t('GatewayEditor.emptyChildrenHint') }}</div>
          </template>
          <EmptyCreateButton />
        </CloudEmpty>
        <j-scrollbar v-if="choosenProviderList.length" height="480">
          <j-pro-table
            mode="CARD"
            modeValue="CARD"
            :dataSource="filterProviderList"
            :noPagination="true"
            :gridColumn="2"
            :gridColumns="[1, 2]"
          >
            <template #emptyText>
              <CloudEmpty
                :search="searchValue"
                :search-name="$t('DeviceDetail.edgeGuides.common.keywords.gateway')"
              >
                <EmptyCreateButton />
              </CloudEmpty>
            </template>
            <template #card="slotProps">
              <CardBox
                :showStatus="false"
                :actions="getActions(slotProps)"
                @click="handleAccessItemDetail(slotProps)"
              >
                <template #img>
                  <img
                    :src="BackMap.get(slotProps.provider)"
                    alt=""
                  />
                </template>
                <template #content>
                  <div class="card-item-content">
                    <j-ellipsis style="width: calc(100% - 100px)">
                      <span class="card-title">
                        {{ slotProps.name }}
                      </span>
                    </j-ellipsis>
                    <a-row class="card-item-content-box">
                      <a-col
                        :span="12"
                        v-if="slotProps.channelInfo"
                        class="card-item-content-text"
                      >
                        <j-ellipsis>
                          <div class="card-item-content-text-title">
                            {{ slotProps.channelInfo.name }}
                          </div>
                        </j-ellipsis>
                        <j-ellipsis
                          style="width: calc(100% - 10px); display: flex; margin-top: 4px"
                          v-if="slotProps.channelInfo.addresses"
                        >
                          <a-badge :status="getStatus(slotProps)" />
                          <span>
                            {{ slotProps.channelInfo.addresses[0].address }}
                          </span>
                        </j-ellipsis>
                      </a-col>
                      <a-col
                        :span="12"
                        v-if="slotProps.protocolDetail"
                        class="card-item-content-text"
                      >
                        <div class="card-item-content-text-title">
                          {{ $t('AccessConfig.index.764793-1') }}
                        </div>
                        <j-ellipsis
                          style="width: calc(100% - 10px)"
                          :lineClamp="2"
                        >
                          <div>
                            {{ slotProps.protocolDetail.name }}
                          </div>
                        </j-ellipsis>
                      </a-col>
                    </a-row>
                    <a-row class="card-item-content-description">
                      <a-col :span="24">
                        <j-ellipsis
                          :lineClamp="2"
                          style="width: calc(100% - 10px)"
                        >
                          {{ getDescription(slotProps) }}
                        </j-ellipsis>
                      </a-col>
                    </a-row>
                  </div>
                </template>
                <template #actions="item">
                  <j-permission-button
                    :disabled="item.disabled"
                    :popConfirm="item.popConfirm"
                    :tooltip="{
                      ...item.tooltip
                    }"
                    @click="item.onClick"
                    :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`"
                  >
                    <AIcon
                      type="DeleteOutlined"
                      v-if="item.key === 'delete'"
                    />
                    <template v-else>
                      <AIcon :type="item.icon" />
                      <span>{{ item?.text }}</span>
                    </template>
                  </j-permission-button>
                </template>
              </CardBox>
            </template>
          </j-pro-table>
        </j-scrollbar>
      </div>
      <div
        v-else
        class="steps-box"
        :style="`max-height:${clientHeight > 900 ? 850 : clientHeight * 0.7}px`"
      >
        <title-component :data="$t('Composite.index.636069-3')"></title-component>
        <a-form
          ref="formRef"
          :model="formData"
          layout="vertical"
        >
          <a-form-item
            :label="$t('Composite.index.636069-4')"
            name="name"
            :rules="[
              { required: true, message: $t('Composite.index.636069-5') },
              { max: 64, message: $t('Composite.index.636069-6') }
            ]"
          >
            <I18nTextField
              v-model:value="formData.name"
              v-model:i18nMessages="formData.i18nMessages"
              field="name"
              :label="$t('Composite.index.636069-4')"
              :i18n-max-length="64"
              :placeholder="$t('Composite.index.636069-5')"
            />
          </a-form-item>
          <DeviceLibraryBizKeyPicker
            v-model="formData.bizKey"
            provider="composite-device-gateway"
          />
          <a-form-item :label="$t('Composite.index.636069-7')">
            <I18nTextField
              v-model:value="formData.description"
              v-model:i18nMessages="formData.i18nMessages"
              field="description"
              :label="$t('Composite.index.636069-7')"
              textarea
              showCount
              :rows="4"
              :maxlength="200"
            />
          </a-form-item>
        </a-form>

      </div>
    </div>
    <template #summary>
      <p>{{ $t('GatewayEditor.subGateways', { count: choosenProviderList.length }) }}</p>
      <CompositeGuide1 :editor="editor" />
    </template>
    <template #actions>
      <a-button
        v-if="stepCurrent === 0"
        type="primary"
        @click="handleNext"
      >
        {{ $t('Network.index.041705-18') }}
      </a-button>
      <a-space v-else>
        <a-button @click="handleBack">
          {{ $t('Network.index.041705-16') }}
        </a-button>
        <j-permission-button
          :hasPermission="`link/AccessConfig:${id === ':id' ? 'add' : 'update'}`"
          type="primary"
          :loading="loading"
          @click="handleSave"
        >
          {{ $t('GatewayEditor.confirm') }}
        </j-permission-button>
      </a-space>
    </template>
  </GatewayFrame>
  <Outline
    v-if="outlineVisible"
    :data="current"
    draft
    @closeDrawer="outlineVisible = false"
  ></Outline>
</template>

<script setup lang="ts">
import CompositeGuide1 from './CompositeGuide1.vue';
import GatewayFrame from '../GatewayFrame.vue';
import ProviderListDrawer from './ProviderListDrawer.vue';
import GatewayChildEditor from './GatewayChildEditor.vue';
import Outline from '../../Outline/index.vue';
import { I18nTextField } from '@jetlinks-web-core/components';
import DeviceLibraryBizKeyPicker from '../DeviceLibraryBizKeyPicker.vue';
import { useCompositeEditor, editorProps } from './useCompositeEditor';
const props = defineProps(editorProps);
const editor = useCompositeEditor(props);
const {
  save, update, device, BackMap, $t, choosenProviderList, searchValue, filterProviderList, id, stepCurrent,
  childDraft, openChild, saveChild, cancelChild, reselectChild, providerListVisible, current, outlineVisible, formRef, formData, loading, getDescription, getStatus,
  clientHeight, getActions, handleAccessItemDetail, handleNext, handleBack, handleSearch, handleAdd,
  handleSave, closeDrawer, handleAddProvider, DefineEmptyCreate, EmptyCreateButton
} = editor;
</script>

<style scoped lang="less" src="./useCompositeEditor.less"></style>
<style scoped>
.composite-empty { min-height: 28rem; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.composite-empty__hint { margin-top: var(--space-2); }
.composite-add { display: flex; justify-content: flex-end; margin-bottom: var(--space-4); }
</style>
