<template>
    <div class="device-detail-metadata" ref="metadataRef" style="position: relative">
        <!-- <div class="tips">-->
        <!--        <a-tooltip :title="instanceStore.detail?.independentMetadata && type === 'device'-->
        <!--        ? '该设备已脱离产品物模型，修改产品物模型对该设备无影响'-->
        <!--        : '设备会默认继承产品的物模型，修改设备物模型后将脱离产品物模型'">-->
        <!--          <div class="ellipsis" style='color: #999;'>-->
        <!--            <AIcon type="InfoCircleOutlined" style="margin-right: 3px" />-->
        <!--            {{-->
        <!--              instanceStore.detail?.independentMetadata && type === 'device'-->
        <!--                ? '该设备已脱离产品物模型，修改产品物模型对该设备无影响'-->
        <!--                : '设备会默认继承产品的物模型，修改设备物模型后将脱离产品物模型'-->
        <!--            }}-->
        <!--          </div>-->
        <!--        </a-tooltip> -->
        <!-- </div> -->
        <a-tabs
            class="metadataNav"
            :activeKey="tabActiveKey"
            destroyInactiveTabPane
            type="card"
            @change="tabsChange"
        >
            <template #rightExtra>
                <a-space>
                    <j-permission-button
                        v-if="showReset"
                        key="reload"
                        :hasPermission="updatePermission"
                        :popConfirm="{
                            title: $t('Metadata.index.838029-0'),
                            onConfirm: resetMetadata,
                        }"
                        :tooltip="{ title: $t('Metadata.index.838029-1') }"
                    >
                        {{ $t('Metadata.index.838029-2') }}
                    </j-permission-button>
                    <j-permission-button
                        :hasPermission="updatePermission"
                        @click="visible = true"
                        key="import"
                        v-if="type === 'product'"
                        >{{ $t('Metadata.index.838029-3') }}</j-permission-button
                    >
                    <j-permission-button
                        :hasPermission="updatePermission"
                        @click="cat = true"
                        key="tsl"
                        >{{ $t('Metadata.index.838029-4') }}</j-permission-button
                    >
                </a-space>
            </template>
            <a-tab-pane :tab="$t('Metadata.index.838029-6')" key="properties">
                <BaseMetadata
                    :target="type"
                    type="properties"
                    :permission="updatePermission"
                />
            </a-tab-pane>
            <a-tab-pane :tab="$t('Metadata.index.838029-7')" key="functions">
                <BaseMetadata
                    :target="type"
                    type="functions"
                    :permission="updatePermission"
                />
            </a-tab-pane>
            <a-tab-pane :tab="$t('Metadata.index.838029-8')" key="events">
                <BaseMetadata
                    :target="type"
                    type="events"
                    :permission="updatePermission"
                />
            </a-tab-pane>
            <a-tab-pane :tab="$t('Metadata.index.838029-9')" key="tags">
                <BaseMetadata
                    :target="type"
                    type="tags"
                    :permission="updatePermission"
                />
            </a-tab-pane>
        </a-tabs>
        <teleport v-if="content" :to="content">
          <div
            class="center-extra-content"
            :style="{ width: centerExtraWidth }"
          >
            <span class="desc">{{ $t('Metadata.index.838029-5') }}</span >
          </div>
        </teleport>
        <Import
            v-if="visible"
            v-model:visible="visible"
            :type="type"
            @close="visible = false"
        />
        <Cat v-model:visible="cat" @close="cat = false" :type="type" />
    </div>
</template>
<script setup lang="ts" name="Metadata">
import { deleteMetadata } from '../../../../api/instance.js';
import { message } from 'ant-design-vue';
import { useInstanceStore } from '../../../../store/instance';
import Import from './Import/index.vue';
import Cat from './Cat/index.vue';
import BaseMetadata from './Base/Base.vue';
import { useMetadataStore } from '../../../../store/metadata';
import { EventEmitter } from '@jetlinks-web/utils';
import { useAuthStore } from '@jetlinks-web-core/store';
import { isEqual } from 'lodash-es';
import { useI18n } from 'vue-i18n';
import { useElementSize } from '@vueuse/core';

const { t: $t } = useI18n();

const route = useRoute();
const instanceStore = useInstanceStore();
const metadataStore = useMetadataStore();
const authStore = useAuthStore();
interface Props {
    type: 'product' | 'device';
    independentMetadata?: boolean;
    /**
     * 资源中心详情不沿用旧菜单权限码时传入最终更新权限；未传入则保持旧页面行为。
     */
    updatePermission?: string | string[] | boolean;
}
const props = defineProps<Props>();

const permission = computed(() =>
    props.type === 'device' ? 'device/Instance' : 'device/Product',
);
// j-permission-button 的共享 Hook 只监听权限码本身，不会在菜单异步加载后重新计算。
// 这里将最终权限解析为响应式布尔值，既复用真实菜单授权，也能随权限仓库更新刷新按钮状态。
const updatePermission = computed(() => {
    const code = props.updatePermission ?? `${permission.value}:update`;
    return typeof code === 'boolean' ? code : authStore.hasPermission(code);
});
const visible = ref(false);
const cat = ref(false);
const tabActiveKey = ref('properties');
const metadataRef = ref()
const content = ref()
const centerExtraWidth = ref();
const { width } = useElementSize(metadataRef);

provide('_metadataType', props.type);

const showReset = computed(() => {
    if (props.type === 'device' && instanceStore.current.productMetadata) {
        const proMetadata = JSON.parse(
            instanceStore.current.productMetadata || '{}',
        );
        const _metadata = JSON.parse(instanceStore.current.metadata || '{}');
        return !isEqual(_metadata, proMetadata);
    }

    return false;
});

// 重置物模型
const resetMetadata = () => {
    const { id } = route.params;
    const response = deleteMetadata(id as string);
    response.then((resp) => {
        if (resp.status === 200) {
            message.info($t('Metadata.index.838029-10'));
            instanceStore.refresh(id as string).then(() => {
                metadataStore.set('importMetadata', true);
                EventEmitter.emit('MetadataChanged', { type: 'device', id });
            });
        }
    });
    return response
};

const tabsChange = (e: string) => {
    EventEmitter.emit('MetadataTabs', () => {
        tabActiveKey.value = e;
    });
};

watch(
  width,
  () => {
    if (metadataRef.value) {
      centerExtraWidth.value =
        metadataRef.value.querySelector('.ant-tabs-nav-wrap').clientWidth -
        metadataRef.value.querySelector('.ant-tabs-nav-list').clientWidth -
        10 +
        'px';
      content.value = metadataRef.value.querySelector('.ant-tabs-nav-wrap');
    }
  },
  { immediate: true },
);

</script>
<style scoped lang="less">
.device-detail-metadata {
    .tips {
        // width: calc(100% - 670px);
        position: absolute;
        top: 12px;
        z-index: 1;
        margin-left: 420px;
        font-weight: 100;
    }

    .metadataNav {
        :deep(.ant-card-body) {
            padding: 0;
        }
    }
    .desc {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.8);
        display: inline-block;
        margin-top: 12px;
        margin-left: 5px;
    }
    .center-extra-content {
      overflow: hidden;
    }
}
</style>
