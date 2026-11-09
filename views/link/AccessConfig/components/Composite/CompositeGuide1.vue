<template>
  <GatewayGuide>
    <j-scrollbar height="600">
      <div>
        <h1>{{ $t('Network.index.041705-12') }}</h1>
        <p>
          {{ $t('Composite.index.636069-8') }}
        </p>
        <p>
          {{ $t('Composite.index.636069-9') }}
        </p>
      </div>
      <div>
        <h1>{{ $t('Composite.index.636069-10') }}</h1>
        <CardBox
          style="margin-bottom: 16px"
          :showStatus="false"
          v-for="slotProps in choosenProviderList"
        >
          <template #img>
            <img
              :src="device.deviceAccess"
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
        </CardBox>
      </div>
    </j-scrollbar>
  </GatewayGuide>
</template>
<script setup lang="ts">
import type { useCompositeEditor } from './useCompositeEditor';
import GatewayGuide from '../GatewayGuide.vue';
const viewProps = defineProps<{
    editor: ReturnType<typeof useCompositeEditor>;
}>();
const editor = viewProps.editor;
const {
  device, $t, choosenProviderList, getDescription, getStatus
} = editor;
</script>

<style scoped lang="less" src="./useCompositeEditor.less"></style>
