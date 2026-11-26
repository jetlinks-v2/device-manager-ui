<!-- 设备接入 -->
<template>
  <a-alert v-if="accessError" type="error" :message="$t('GatewayEditor.loadFailed')" show-icon>
    <template #action><a-button size="small" @click="getData">{{ $t('GatewayEditor.retry') }}</a-button></template>
  </a-alert>
  <a-spin v-if="accessLoading && !access.id" />
  <div
    v-else-if="!access.id"
    style="margin-top: 20%; transform: translateY(-50%)"
  >
    <j-empty>
      <template #description>
        <span v-if="permissionStore.hasPermission('device/Product:update')">
          {{ $t("DeviceAccess.index.594346-0")
          }}<a-button type="link" @click="showModal">{{
            $t("DeviceAccess.index.594346-1")
          }}</a-button
          >{{ $t("DeviceAccess.index.594346-2") }}
        </span>
        <span v-else>{{ $t("DeviceAccess.index.594346-3") }}</span>
      </template>
    </j-empty>
  </div>
  <div v-else class="product-device-access">
    <a-row :gutter="24">
      <a-col :span="12" class="product-device-access__content">
        <section class="product-device-access__section product-device-access__section--access">
        <Title
          class="product-device-access__section-title"
          :data="$t('DeviceAccess.index.594346-4')"
        >
          <template #extra>
            <j-permission-button
              class="product-device-access__change"
              type="primary"
              size="small"
              :tooltip="{
                title: tooltip,
              }"
              :disabled="checkDisabled"
              ghost
              @click="showDevice"
              hasPermission="device/Product:update"
            >
              {{ $t("DeviceAccess.index.594346-5") }}
            </j-permission-button>
          </template>
        </Title>
        <div class="product-device-access__access-method">
          <div class="product-device-access__access-name">
            {{ getI18nText(access, 'name') }}
          </div>
          <div class="product-device-access__access-description">
            {{
              getI18nText(access, 'description') ||
              dataSource.find((item) => item?.id === access?.provider)
                ?.description
            }}
          </div>
        </div>
        <template v-if="access?.provider === 'composite-device-gateway'">
          <div class="product-device-access__composite">
              <a-collapse v-model:activeKey="activeKey">
                <a-collapse-panel
                  v-for="item in access?.configuration?.gateways"
                  :key="item.id" :header="getI18nText(item, 'name')"
                >
                  <template #extra>
                    {{ dataSource.find((i) => i?.id === item?.provider)?.description }}
                  </template>
                  <div class="item-style">
                    <Title :data="$t('DeviceAccess.index.594346-6')"></Title>
                    <div>
                      {{ getI18nText(item?.protocolDetail, 'name') }}
                    </div>
                  </div>
                  <div class="item-style">
                    <Title :data="$t('DeviceAccess.index.594346-7')"></Title>
                    <div v-if="item?.channelInfo?.addresses.length > 0">
                      <div
                        v-for="channel in item?.channelInfo?.addresses"
                        :key="channel.address"
                      >
                        <a-badge
                          :color="channel.health === -1 ? 'red' : 'green'"
                          :text="channel.address"
                        >
                        </a-badge>
                      </div>
                    </div>
                    <div v-else>{{ $t("DeviceAccess.index.594346-8") }}</div>
                  </div>
                  <ProductAccessFields ref="formRef" :groups="item?.transportDetail?.allConfig || []"
                    v-model="formData.data" :disabled="submitLoading || accessLoading" />
                </a-collapse-panel>
              </a-collapse>
          </div>
        </template>
        <template v-else>
          <div class="item-style">
            <Title :data="$t('DeviceAccess.index.594346-6')"></Title>
            <div>
              {{ getI18nText(access?.protocolDetail, 'name') }}
            </div>
          </div>
          <div class="item-style">
            <Title :data="$t('DeviceAccess.index.594346-7')"></Title>
            <div v-if="access?.channelInfo?.addresses.length > 0">
              <div
                  v-for="item in access?.channelInfo?.addresses"
                  :key="item.address"
              >
                <a-badge
                    :color="item.health === -1 ? 'red' : 'green'"
                    :text="item.address"
                >
                </a-badge>
              </div>
            </div>
            <div v-else>{{ $t("DeviceAccess.index.594346-8") }}</div>
          </div>
          <!--        {{ $t('DeviceAccess.index.594346-9') }}        -->
          <a-form
              ref="pluginFormRef"
              :model="productData"
              layout="vertical"
              v-if="productTypes.length"
          >
            <a-form-item
                name="id"
                :label="$t('DeviceAccess.index.594346-9')"
                :rules="[
                { required: true, message: $t('DeviceAccess.index.594346-10') },
              ]"
            >
              <a-select
                  v-model:value="productData.id"
                  :disabled="submitLoading || accessLoading"
                  :options="productTypes"
                  @change="productTypeChange"
                  :placeholder="$t('DeviceAccess.index.594346-10')"
              />
            </a-form-item>
          </a-form>
          <!--        其它接入配置        -->
          <ProductAccessFields ref="formRef" :groups="metadata" v-model="formData.data"
            :disabled="submitLoading || accessLoading" />
        </template>
        </section>
        <section class="product-device-access__section product-device-access__section--storage">
        <Title
          class="product-device-access__section-title"
          :data="$t('DeviceAccess.index.594346-14')"
        >
          <template #extra>
            <a-tooltip :title="$t('DeviceAccess.index.594346-15')">
              <AIcon type="QuestionCircleOutlined" style="margin-left: 2px" />
            </a-tooltip>
          </template>
        </Title>
        <a-form layout="vertical">
          <a-form-item>
            <a-select ref="select" v-model:value="form.storePolicy" :disabled="submitLoading || accessLoading">
              <a-select-option
                v-for="(item, index) in storageList"
                :key="index"
                :value="item.id"
                >{{ item.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
        <j-permission-button
          class="product-device-access__save"
          type="primary"
          @click="submitDevice"
          hasPermission="device/Product:update"
          :loading="submitLoading || accessLoading"
          :disabled="submitLoading || accessLoading || accessError || metadataVisible"
          >{{ $t("DeviceAccess.index.594346-16") }}
        </j-permission-button>
        </section>
      </a-col>
    </a-row>
  </div>
  <!-- 选择设备 -->
  <AccessModal
    v-if="visible"
    :product-id="productStore.current.id"
    :deviceType="productStore.current.deviceType?.value"
    :accessId="accessId"
    :providersList="dataSource"
    @cancel="visible = false"
    @submit="checkAccess"
  />
  <!-- 物模型处理方式 -->
  <MetaDataModal
    v-if="metadataVisible && metadataModalCacheData"
    :data="metadataModalCacheData"
    @cancel="
      () => {
        (metadataVisible = false), (metadataModalCacheData = undefined);
      }
    "
    @submit="MetaDataModalSubmit"
  />
</template>

<script lang="ts" setup>
import Title from "../Title/index.vue";
import AccessModal from "./accessModal.vue";
import MetaDataModal from "./metadataModal.vue";
import ProductAccessFields from "./ProductAccessFields.vue";
import { getI18nText } from '../../../../../utils/i18n';
import { useProductDeviceAccess } from './hooks/useProductDeviceAccess';

defineOptions({ name: 'AccessConfig' })

const {
  productStore, permissionStore, formRef, visible, access, accessId, metadata, dataSource,
  storageList, activeKey, form, formData, productTypes, productData, pluginFormRef,
  metadataVisible, metadataModalCacheData, submitLoading, accessLoading, accessError, getData, showModal,
  showDevice, checkAccess, productTypeChange, submitDevice, MetaDataModalSubmit, tooltip, checkDisabled,
} = useProductDeviceAccess();
defineExpose({ openAccessSelector: showDevice });
</script>
<style lang="less" scoped src="./index.less"></style>
