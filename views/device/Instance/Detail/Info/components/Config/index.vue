<template>
    <template v-if="config.length || gatewaysDetail?.length">
        <a-card
            v-if="variant === 'card'"
            class="config-card"
            :bordered="true"
        >
        <template #title>
            <div class="card-title has-title-before">
                <div
                    class="title-before"
                    aria-hidden="true"
                />
                <span class="card-title__text">{{ $t('Config.index.926765-0') }}</span>
                <a-space class="card-title__actions">
                    <j-permission-button
                        type="link"
                        class="action-button"
                        @click="visible = true"
                        hasPermission="device/Instance:update"
                    >
                        <template #icon><AIcon type="EditOutlined" /></template>
                        {{ $t('Config.index.926765-1') }}
                    </j-permission-button>
                    <j-permission-button
                        type="link"
                        class="action-button"
                        v-if="instanceStore.detail.current?.value !== 'notActive'"
                        :popConfirm="{
                            title: $t('Config.index.926765-2'),
                            onConfirm: deployBtn,
                        }"
                        hasPermission="device/Instance:update"
                    >
                        <AIcon type="CheckOutlined" />{{ $t('Config.index.926765-3') }}<a-tooltip
                            :title="$t('Config.index.926765-4')"
                            ><AIcon type="QuestionCircleOutlined"
                        /></a-tooltip>
                    </j-permission-button>
                    <j-permission-button
                        type="link"
                        class="action-button"
                        v-if="instanceStore.detail.aloneConfiguration"
                        :popConfirm="{
                            title: $t('Config.index.926765-5'),
                            onConfirm: resetBtn,
                        }"
                        hasPermission="device/Instance:update"
                    >
                        <AIcon type="SyncOutlined" />{{ $t('Config.index.926765-6') }}<a-tooltip
                            :title="$t('Config.index.926765-7')"
                            ><AIcon type="QuestionCircleOutlined"
                        /></a-tooltip>
                    </j-permission-button>
                </a-space>
            </div>
        </template>
        <template v-if="access?.provider === 'composite-device-gateway'">
            <a-collapse v-model:activeKey="activeKey">
                <a-collapse-panel v-for="item in gatewaysDetail" :header="item.name" :key="item.id">
                    <template #extra>
                        {{ providers?.find(i => i.id === item.provider)?.description }}
                    </template>
                    <template v-if="item.transportDetail?.allConfig?.length">
                        <a-descriptions class="compact-descriptions" :labelStyle="{width: '120px'}" bordered size="small" v-for="i in item.transportDetail.allConfig" :key="i.name">
                            <template #title><h4 class="config-group-title">{{ i.name }}</h4></template>
                            <a-descriptions-item
                                v-for="item in i.properties"
                                :key="item.property"
                            >
                                <template #label>
                                    <j-ellipsis style="margin-right: 5px">
                                        {{ item.name }}
                                        <a-tooltip
                                            v-if="item.description"
                                            :title="item.description"
                                            ><AIcon type="QuestionCircleOutlined"
                                        /></a-tooltip>
                                    </j-ellipsis>
                                </template>
                                <span
                                    v-if="
                                        item.type.type === 'password' &&
                                        instanceStore.current?.configuration?.[item.property]
                                            ?.length > 0
                                    "
                                    >******</span
                                >
                                <span v-else-if="item.type.type === 'enum'">
                                    <j-ellipsis>{{
                                        item.type.elements?.find(
                                            (i) =>
                                                i.value ===
                                                instanceStore.current?.configuration?.[
                                                    item.property
                                                ],
                                        )?.text || ''
                                    }}</j-ellipsis>
                                    <a-tooltip
                                        v-if="isExit(item.property)"
                                        :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </span>
                                <span v-else-if="item.type.type === 'boolean'">
                                    <j-ellipsis>{{
                                        [
                                            {
                                                label: item?.type?.falseText,
                                                value: item?.type?.falseValue,
                                            },
                                            {
                                                label: item?.type?.trueText,
                                                value: item?.type?.trueValue,
                                            },
                                        ].find(
                                            (i) =>
                                                i.value ===
                                                instanceStore.current?.configuration?.[
                                                    item.property
                                                ],
                                        )?.label || ''
                                    }}</j-ellipsis>
                                </span>
                                <span v-else>
                                    <j-ellipsis>{{
                                        instanceStore.current?.configuration?.[item.property] ||
                                        ''
                                    }}</j-ellipsis>
                                    <a-tooltip
                                        v-if="isExit(item.property)"
                                        :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </span>
                            </a-descriptions-item>
                        </a-descriptions>
                    </template>
                    <j-empty v-else :description="$t('Config.index.926765-11')"></j-empty>
                </a-collapse-panel>
            </a-collapse>
        </template>
        <template v-else>
            <a-descriptions class="compact-descriptions" :labelStyle="{width: '120px'}" bordered size="small" v-for="i in config" :key="i.name">
                <template #title><h4 class="config-group-title">{{ i.name }}</h4></template>
                <a-descriptions-item
                    v-for="item in i.properties"
                    :key="item.property"
                >
                    <template #label>
                        <j-ellipsis style="margin-right: 5px">
                            {{ item.name }}
                            <a-tooltip
                                v-if="item.description"
                                :title="item.description"
                                ><AIcon type="QuestionCircleOutlined"
                            /></a-tooltip>
                        </j-ellipsis>
                    </template>
                    <span
                        v-if="
                            item.type.type === 'password' &&
                            instanceStore.current?.configuration?.[item.property]
                                ?.length > 0
                        "
                        >******</span
                    >
                    <span v-else-if="item.type.type === 'enum'">
                        <j-ellipsis>{{
                            item.type.elements?.find(
                                (i) =>
                                    i.value ===
                                    instanceStore.current?.configuration?.[
                                        item.property
                                    ],
                            )?.text || ''
                        }}</j-ellipsis>
                        <a-tooltip
                            v-if="isExit(item.property)"
                            :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                            ><AIcon type="QuestionCircleOutlined"
                        /></a-tooltip>
                    </span>
                    <span v-else-if="item.type.type === 'boolean'">
                        <j-ellipsis>{{
                            [
                                {
                                    label: item?.type?.falseText,
                                    value: item?.type?.falseValue,
                                },
                                {
                                    label: item?.type?.trueText,
                                    value: item?.type?.trueValue,
                                },
                            ].find(
                                (i) =>
                                    i.value ===
                                    instanceStore.current?.configuration?.[
                                        item.property
                                    ],
                            )?.label || ''
                        }}</j-ellipsis>
                    </span>
                    <span v-else>
                        <j-ellipsis>{{
                            instanceStore.current?.configuration?.[item.property] ||
                            ''
                        }}</j-ellipsis>
                        <a-tooltip
                            v-if="isExit(item.property)"
                            :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                            ><AIcon type="QuestionCircleOutlined"
                        /></a-tooltip>
                    </span>
                </a-descriptions-item>
            </a-descriptions>
        </template>
        </a-card>

        <a-list-item
            v-else
            class="access-list-item config-item"
        >
            <a-list-item-meta>
                <template #title>
                    <div class="plain-item-head has-title-before">
                        <div class="plain-item-head__left">
                            <div
                                class="title-before"
                                aria-hidden="true"
                            />
                            <span class="plain-item-title">{{ $t('Config.index.926765-0') }}</span>
                            <a-space class="plain-item-head__actions">
                                <j-permission-button
                                    type="link"
                                    class="action-button"
                                    @click="visible = true"
                                    hasPermission="device/Instance:update"
                                >
                                    <template #icon><AIcon type="EditOutlined" /></template>
                                    {{ $t('Config.index.926765-1') }}
                                </j-permission-button>
                                <j-permission-button
                                    type="link"
                                    class="action-button"
                                    v-if="instanceStore.detail.current?.value !== 'notActive'"
                                    :popConfirm="{
                                        title: $t('Config.index.926765-2'),
                                        onConfirm: deployBtn,
                                    }"
                                    hasPermission="device/Instance:update"
                                >
                                    <AIcon type="CheckOutlined" />{{ $t('Config.index.926765-3') }}<a-tooltip
                                        :title="$t('Config.index.926765-4')"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </j-permission-button>
                                <j-permission-button
                                    type="link"
                                    class="action-button"
                                    v-if="instanceStore.detail.aloneConfiguration"
                                    :popConfirm="{
                                        title: $t('Config.index.926765-5'),
                                        onConfirm: resetBtn,
                                    }"
                                    hasPermission="device/Instance:update"
                                >
                                    <AIcon type="SyncOutlined" />{{ $t('Config.index.926765-6') }}<a-tooltip
                                        :title="$t('Config.index.926765-7')"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </j-permission-button>
                            </a-space>
                        </div>
                    </div>
                </template>
                <template #description>
                    <template v-if="access?.provider === 'composite-device-gateway'">
                        <a-collapse v-model:activeKey="activeKey">
                            <a-collapse-panel v-for="item in gatewaysDetail" :header="item.name" :key="item.id">
                                <template #extra>
                                    {{ providers?.find(i => i.id === item.provider)?.description }}
                                </template>
                                <template v-if="item.transportDetail?.allConfig?.length">
                                    <a-descriptions class="compact-descriptions" :labelStyle="{width: '120px'}" bordered size="small" v-for="i in item.transportDetail.allConfig" :key="i.name">
                                        <template #title><h4 class="config-group-title">{{ i.name }}</h4></template>
                                        <a-descriptions-item
                                            v-for="item in i.properties"
                                            :key="item.property"
                                        >
                                            <template #label>
                                                <j-ellipsis style="margin-right: 5px">
                                                    {{ item.name }}
                                                    <a-tooltip
                                                        v-if="item.description"
                                                        :title="item.description"
                                                        ><AIcon type="QuestionCircleOutlined"
                                                    /></a-tooltip>
                                                </j-ellipsis>
                                            </template>
                                            <span
                                                v-if="
                                                    item.type.type === 'password' &&
                                                    instanceStore.current?.configuration?.[item.property]
                                                        ?.length > 0
                                                "
                                                >******</span
                                            >
                                            <span v-else-if="item.type.type === 'enum'">
                                                <j-ellipsis>{{
                                                    item.type.elements?.find(
                                                        (i) =>
                                                            i.value ===
                                                            instanceStore.current?.configuration?.[
                                                                item.property
                                                            ],
                                                    )?.text || ''
                                                }}</j-ellipsis>
                                                <a-tooltip
                                                    v-if="isExit(item.property)"
                                                    :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                                    ><AIcon type="QuestionCircleOutlined"
                                                /></a-tooltip>
                                            </span>
                                            <span v-else-if="item.type.type === 'boolean'">
                                                <j-ellipsis>{{
                                                    [
                                                        {
                                                            label: item?.type?.falseText,
                                                            value: item?.type?.falseValue,
                                                        },
                                                        {
                                                            label: item?.type?.trueText,
                                                            value: item?.type?.trueValue,
                                                        },
                                                    ].find(
                                                        (i) =>
                                                            i.value ===
                                                            instanceStore.current?.configuration?.[
                                                                item.property
                                                            ],
                                                    )?.label || ''
                                                }}</j-ellipsis>
                                            </span>
                                            <span v-else>
                                                <j-ellipsis>{{
                                                    instanceStore.current?.configuration?.[item.property] ||
                                                    ''
                                                }}</j-ellipsis>
                                                <a-tooltip
                                                    v-if="isExit(item.property)"
                                                    :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                                    ><AIcon type="QuestionCircleOutlined"
                                                /></a-tooltip>
                                            </span>
                                        </a-descriptions-item>
                                    </a-descriptions>
                                </template>
                                <j-empty v-else :description="$t('Config.index.926765-11')"></j-empty>
                            </a-collapse-panel>
                        </a-collapse>
                    </template>
                    <template v-else>
                        <a-descriptions class="compact-descriptions" :labelStyle="{width: '120px'}" bordered size="small" v-for="i in config" :key="i.name">
                            <template #title><h4 class="config-group-title">{{ i.name }}</h4></template>
                            <a-descriptions-item
                                v-for="item in i.properties"
                                :key="item.property"
                            >
                                <template #label>
                                    <j-ellipsis style="margin-right: 5px">
                                        {{ item.name }}
                                        <a-tooltip
                                            v-if="item.description"
                                            :title="item.description"
                                            ><AIcon type="QuestionCircleOutlined"
                                        /></a-tooltip>
                                    </j-ellipsis>
                                </template>
                                <span
                                    v-if="
                                        item.type.type === 'password' &&
                                        instanceStore.current?.configuration?.[item.property]
                                            ?.length > 0
                                    "
                                    >******</span
                                >
                                <span v-else-if="item.type.type === 'enum'">
                                    <j-ellipsis>{{
                                        item.type.elements?.find(
                                            (i) =>
                                                i.value ===
                                                instanceStore.current?.configuration?.[
                                                    item.property
                                                ],
                                        )?.text || ''
                                    }}</j-ellipsis>
                                    <a-tooltip
                                        v-if="isExit(item.property)"
                                        :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </span>
                                <span v-else-if="item.type.type === 'boolean'">
                                    <j-ellipsis>{{
                                        [
                                            {
                                                label: item?.type?.falseText,
                                                value: item?.type?.falseValue,
                                            },
                                            {
                                                label: item?.type?.trueText,
                                                value: item?.type?.trueValue,
                                            },
                                        ].find(
                                            (i) =>
                                                i.value ===
                                                instanceStore.current?.configuration?.[
                                                    item.property
                                                ],
                                        )?.label || ''
                                    }}</j-ellipsis>
                                </span>
                                <span v-else>
                                    <j-ellipsis>{{
                                        instanceStore.current?.configuration?.[item.property] ||
                                        ''
                                    }}</j-ellipsis>
                                    <a-tooltip
                                        v-if="isExit(item.property)"
                                        :title="$t('Config.index.926765-8', [instanceStore.current?.configuration?.[item.property]])"
                                        ><AIcon type="QuestionCircleOutlined"
                                    /></a-tooltip>
                                </span>
                            </a-descriptions-item>
                        </a-descriptions>
                    </template>
                </template>
            </a-list-item-meta>
        </a-list-item>
    </template>
        <Save
            v-if="visible"
            @save="saveBtn"
            @close="visible = false"
            :config="config"
            :gatewaysDetail="gatewaysDetail"
            :access="access"
        />
</template>

<script lang="ts" setup>
import { useInstanceStore } from '@device-manager-ui/store/instance';
import type { ConfigMetadata } from '../../../../../Product/typings';
import {
    getConfigMetadata,
    _deploy,
    configurationReset,
} from '@device-manager-ui/api/instance';
import { getCompositeProviderDetail, list, getProviders } from '@device-manager-ui/api/link/accessConfig';
import Save from './Save.vue';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';
import { useRequest } from '@jetlinks-web/hooks';

const emit = defineEmits<{
    /**
     * 配置保存成功（包括刷新实例信息之后）
     */
    (e: 'saved'): void
}>()

withDefaults(
    defineProps<{
        /** card：实例信息页；item：设备接入等列表内纯条目 */
        variant?: 'card' | 'item'
    }>(),
    { variant: 'card' },
)

const { t: $t } = useI18n();
const instanceStore = useInstanceStore();
const visible = ref<boolean>(false);
const config = ref<ConfigMetadata[]>([]);
const activeKey = ref<string[]>([]);
const { run, data: gatewaysDetail } = useRequest(getCompositeProviderDetail, {
    immediate: false,
    onSuccess: (resp) => {
        activeKey.value = [resp.result?.[0].id]
    }
})

const { data: providers } = useRequest(getProviders, {
    immediate: true,
})

const { run: runList, data: access } = useRequest(list, {
    immediate: false,
    onSuccess: (resp) => {
        if(resp.result?.data?.[0].provider === 'composite-device-gateway') {
            run(resp.result.data?.[0].configuration?.gateways)
            return resp.result.data?.[0]
        }
    }
})


const isExit = (property: string) => {
    return (
        instanceStore.current?.cachedConfiguration &&
        instanceStore.current?.cachedConfiguration[property] !== undefined &&
        instanceStore.current?.configuration &&
        instanceStore.current?.configuration[property] !==
            instanceStore.current?.cachedConfiguration[property]
    );
};

const deployBtn = () => {
    if (instanceStore.current.id) {
        const response = _deploy(instanceStore.current.id);
        response.then((resp) => {
            if (resp.status === 200) {
                onlyMessage($t('Config.index.926765-9'));
                instanceStore.refresh(instanceStore.current.id);
            }
        });
        return response;
    }
};

const resetBtn = () => {
    if (instanceStore.current.id) {
        const response = configurationReset(instanceStore.current.id);
        response.then((resp) => {
            if (resp.status === 200) {
                onlyMessage($t('Config.index.926765-10'));
                instanceStore.refresh(instanceStore.current.id);
            }
        });
        return response
    }
};

const saveBtn = () => {
    visible.value = false;
    if (instanceStore.current.id) {
        const refreshPromise = instanceStore.refresh(instanceStore.current.id);
        // 兼容 refresh 返回 Promise 或非 Promise 的情况
        if (refreshPromise && typeof (refreshPromise as any).then === 'function') {
            (refreshPromise as Promise<any>).then(() => {
                emit('saved');
            });
        } else {
            // 非异步刷新，短暂延迟后通知父组件
            setTimeout(() => emit('saved'), 0);
        }
    } else {
        emit('saved');
    }
};


watch(
    () => instanceStore.current.id,
    (val) => {
        if (val) {
            getConfigMetadata(val).then((resp) => {
                if (resp.status === 200) {
                    config.value = resp?.result as ConfigMetadata[];
                }
            });
            runList({
                terms: [
                    { column: 'id', value: instanceStore.current.accessId }
                ]
            })
        }
    },
    { immediate: true },
);


</script>

<style lang="less" scoped>
.config-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
    border: 1px solid #f0f0f0;
    margin-top: 16px;
    margin-bottom: 16px;

    &:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        border-color: #d9d9d9;
    }

    :deep(.ant-card-head) {
        border-bottom: 1px solid #f0f0f0;
        padding: 12px 24px;
        min-height: 48px;
    }

    :deep(.ant-card-body) {
        padding: 16px 20px;
    }
}

.compact-descriptions {
    :deep(.ant-descriptions-item-label) {
        font-size: 14px;
        padding: 8px 12px;
    }

    :deep(.ant-descriptions-item-content) {
        font-size: 15px;
        padding: 8px 12px;
    }

    :deep(.ant-descriptions-row) {
        > td {
            padding-bottom: 8px;
        }
    }

    :deep(.config-group-title) {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 8px;
        color: rgba(0, 0, 0, 0.55);
    }
}

.card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.85);

    &.has-title-before {
        position: relative;
        flex-wrap: wrap;
        padding-left: 10px;

        > .title-before {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 4px;
            height: 16px;
            background-color: @primary-color;
            border-radius: 0 3px 3px 0;
        }

        .card-title__actions {
            flex-shrink: 0;
        }
    }

}

.action-button {
    padding: 0;
    height: auto;
    font-size: 14px;
}

.plain-item-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    width: 100%;

    &__left {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        padding-left: 10px;
        min-height: 22px;
        flex: 1;
        min-width: 0;

        > .title-before {
            position: absolute;
            left: 0;
            top: 2px;
            width: 4px;
            height: calc(100% - 4px);
            min-height: 14px;
            background-color: @primary-color;
            border-radius: 0 3px 3px 0;
        }

        .plain-item-head__actions {
            flex-shrink: 0;
        }
    }
}

.plain-item-title {
    font-weight: 600;
    font-size: 16px;
    color: rgba(0, 0, 0, 0.85);
}

.config-item {
    :deep(.ant-list-item-meta-title) {
        width: 100%;
    }
}
</style>
