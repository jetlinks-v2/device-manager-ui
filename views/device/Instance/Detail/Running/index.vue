<template>
    <div class="property-box">
        <div class="property-box-left">
            <a-input-search
                v-model:value="value"
                :placeholder="$t('Running.index.376017-0')"
                style="width: 200px; margin-bottom: 10px"
                @search="onSearch"
                :allowClear="true"
            />
            <a-tabs
                tab-position="left"
                style="height: calc(100% - 32px)"
                v-if="tabList.length"
                v-model:activeKey="activeKey"
                :tabBarStyle="{ width: '200px' }"
                @change="tabChange"
            >
                <a-tab-pane v-for="i in tabList" :key="i.key">
                    <template #tab>
                        <a-tooltip>
                            <template #title>
                                {{ i.tab }}
                            </template>
                            <div style="max-width: 150px" class="tabTitle">
                                {{ i.tab }}
                            </div>
                        </a-tooltip>
                    </template>
                </a-tab-pane>
            </a-tabs>
            <JEmpty v-else style="margin: 180px 0" />
        </div>
        <div class="property-box-right">
            <a-alert
                v-if="showNoneStorageTip"
                type="warning"
                show-icon
                class="property-box-right__storage-alert"
            >
                <template #message>
                    <span>
                        {{ $t('Running.index.storagePolicyNonePrefix') }}
                        <button
                            v-if="canJumpProductConfig"
                            type="button"
                            class="property-box-right__storage-link"
                            @click="jumpProductConfig"
                        >
                            {{ $t('Running.index.storagePolicyLink') }}
                        </button>
                        <span v-else>{{ $t('Running.index.storagePolicyLink') }}</span>
                        {{ $t('Running.index.storagePolicyNoneSuffix') }}
                    </span>
                </template>
            </a-alert>
            <div class="property-box-right__content">
                <Event v-if="type === 'event'" :data="data" :key="activeKey"/>
                <Property v-else-if="type === 'property'" :data="properties" />
                <JEmpty v-else style="margin: 220px 0" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useInstanceStore } from '../../../../../store/instance';
import { cloneDeep } from 'lodash-es';
import Event from './Event/index.vue';
import Property from './Property/index.vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { detail as queryProductDetail } from '../../../../../api/product';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useAuthStore } from '@jetlinks-web-core/store';

const { t: $t } = useI18n();
const activeKey = ref<string>('property');
const tabList = ref<{ key: string; tab: string; type: 'property' | 'event' }[]>(
    [
        {
            key: 'property',
            tab: $t('Running.index.376017-1'),
            type: 'property',
        },
    ],
);
const type = ref<string>('property');
const data = ref<Record<string, any>>({});
const value = ref<string>('');
const instanceStore = useInstanceStore();
const menuStore = useMenuStore();
const permissionStore = useAuthStore();
const { current } = storeToRefs(instanceStore);

const properties: any = ref(undefined);
const events: any = ref(undefined);
const productStorePolicy = ref<string | undefined>(undefined);
const showNoneStorageTip = computed(() => productStorePolicy.value === 'none');
const canJumpProductConfig = computed(
    () => permissionStore.hasPermission('device/Product:view') && !!current.value?.productId,
);

let productStorePolicyRequest = 0;

watch(
    () => current.value,
    (value) => {
        tabList.value = [{
            key: 'property',
            tab: $t('Running.index.376017-1'),
            type: 'property',
        }]
        const metadata = JSON.parse(value?.metadata || '{}');
        properties.value = metadata.properties;
        events.value = metadata.events;
        if (events.value && events.value.length) {
            events.value.map((item: any) => {
                tabList.value.push({
                    ...item,
                    key: item.id,
                    tab: item.name,
                    type: 'event',
                });
            });
        }
    },
    {
        immediate: true,
        deep: true,
    },
);

watch(
    () => current.value?.productId,
    async (productId) => {
        const requestId = ++productStorePolicyRequest;
        productStorePolicy.value = undefined;

        if (!productId) {
            return;
        }

        const resp: any = await queryProductDetail(productId);

        if (requestId !== productStorePolicyRequest) {
            return;
        }

        if (resp.status === 200) {
            productStorePolicy.value = resp.result?.storePolicy;
        }
    },
    {
        immediate: true,
    },
);
// watch(
//     () => events.value,
//     (newVal) => {
//         console.log(events.value,'test')
//         if (events.value && newVal.length) {
//             newVal.map((item: any) => {
//                 tabList.value.push({
//                     ...item,
//                     key: item.id,
//                     tab: item.name,
//                     type: 'event',
//                 });
//             });
//         }
//     },
//     {
//         deep: true,
//         immediate: true,
//     },
// );

const onSearch = () => {
    const arr = [
        {
            key: 'property',
            tab: $t('Running.index.376017-1'),
            type: 'property',
        },
        ...events.value.map((item: any) => {
            return {
                ...item,
                key: item.id,
                tab: item.name,
                type: 'event',
            };
        }),
    ];
    if (value.value) {
        const li = arr.filter((i: any) => {
            return i?.tab.indexOf(value.value) !== -1;
        });
        tabList.value = cloneDeep(li);
    } else {
        tabList.value = cloneDeep(arr);
    }
    const dt = tabList.value?.[0];
    if (dt) {
        data.value = dt;
        type.value = dt.type;
    } else {
        type.value = '';
    }
};
const tabChange = (key: string) => {
    const dt = tabList.value.find((i) => i.key === key);
    if (dt) {
        data.value = dt;
        type.value = dt.type;
    }
};

const jumpProductConfig = () => {
    if (!current.value?.productId || !canJumpProductConfig.value) {
        return;
    }

    menuStore.jumpPage('device/Product/Detail', {
        params: {
            id: current.value.productId,
            tab: 'Device',
        },
    });
};
</script>

<style lang="less" scoped>
.property-box {
    display: flex;
    height: 100%;

    .property-box-left {
        width: 200px;
      height: 100%;
    }
    .property-box-right {
        flex: 1;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;

      &__storage-alert {
        margin-bottom: 16px;
      }

      &__storage-link {
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        color: #1677ff;
        cursor: pointer;
        text-decoration: underline;
      }

      &__content {
        flex: 1;
        min-height: 0;
      }

      :deep(.ant-spin-nested-loading) {
        height: 100%;
        .ant-spin-container {
          height: 100%;
        }
      }
    }
}
.tabTitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
