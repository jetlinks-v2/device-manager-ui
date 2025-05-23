<template>
    <div class="inkling-device">
        <a-spin :spinning="spinning">
            <div class="search-box">
                <div class="search-warp">
                    <j-advanced-search
                        v-if="!spinning"
                        :columns="columns"
                        type="simple"
                        @search="handleSearch"
                        class="device-inkling"
                        target="device-inkling"
                    />
                </div>
                <div class="multiple" v-if="multiple">
                    <a-checkbox v-model:checked="checkAll" @change="checkChange">{{ $t('InklingDevice.index.743184-0') }}</a-checkbox>
                </div>
            </div>
            <div class="device-list-warp">
                <j-scrollbar v-if="deviceList.length">
                    <a-spin :spinning="deviceSpinning">
                        <div class="device-list-items">
                            <template v-for="item in deviceList">
                                <template v-if="disabledKeys.includes(item.id)">
                                    <a-tooltip :title="$t('InklingDevice.index.743184-1')">
                                        <div
                                            :class="{
                                                'device-list-item': true,
                                                active: checkKeys.includes(
                                                    item.id,
                                                ),
                                                disabled: disabledKeys.includes(
                                                    item.id,
                                                ),
                                            }"
                                            @click="
                                                () => deviceClick(item.id, item)
                                            "
                                        >
                                            <div class="item-title">
                                                <span
                                                    class="title-name no-tooltip"
                                                >
                                                    {{ item.name }}
                                                </span>
                                                <span class="title-id">
                                                    ({{ item.id }})
                                                </span>
                                            </div>
                                        </div>
                                    </a-tooltip>
                                </template>
                                <div
                                    v-else
                                    :class="{
                                        'device-list-item': true,
                                        active: checkKeys.includes(item.id),
                                        disabled: disabledKeys.includes(
                                            item.id,
                                        ),
                                    }"
                                    @click="() => deviceClick(item.id, item)"
                                >
                                    <div class="item-title">
                                        <span class="title-name">
                                            <j-ellipsis>
                                                {{ item.name }}
                                            </j-ellipsis>
                                        </span>
                                        <span class="title-id">
                                            <j-ellipsis>
                                                ({{ item.id }})
                                            </j-ellipsis>
                                        </span>
                                    </div>
                                    <a-icon
                                        v-if="checkKeys.includes(item.id)"
                                        type="CheckOutlined"
                                    />
                                </div>
                            </template>
                        </div>
                    </a-spin>
                </j-scrollbar>
                <j-empty
                    v-else
                    :description="$t('InklingDevice.index.743184-2')"
                    style="padding-top: 24px"
                />
                <div class="device-list-pagination">
                    <j-pagination
                        v-if="showPage"
                        :total="pageData.total"
                        :current="pageData.pageIndex + 1"
                        :pageSize="pageData.pageSize"
                        :show-total="
                            () => {
                                const minSize =
                                    pageData.pageIndex * pageData.pageSize + 1;
                                const MaxSize =
                                    (pageData.pageIndex + 1) *
                                    pageData.pageSize;
                                $t('InklingDevice.index.743184-3', [minSize,MaxSize > pageData.total? pageData.total : MaxSize ,pageData.total]);
                            }
                        "
                        @change="pageChange"
                    />
                </div>
            </div>
        </a-spin>
    </div>
</template>

<script setup lang="ts" name="InklingDevice">
import {
    getCommandsByAccess,
    getCommandsDevicesByAccessId,
} from '../../../../api/link/accessConfig';
import { cloneDeep, isArray } from 'lodash-es';
import { getInkingDevices } from '../../../../api/instance';

type Emit = {
    (e: 'update:value', data: string | string[]): void;
    (e: 'change', data: any | any[]): void;
};
const props = defineProps({
    value: {
        type: [String, Array],
        default: undefined,
    },
    accessId: {
        type: String,
        default: undefined,
    },
    multiple: {
        type: Boolean,
        default: false,
    },
    pluginId: {
        type: String,
        default: undefined,
    },
    type: {
        type: String,
        default: 'device',
    },
    internalId: {
        type: String,
        default: undefined,
    },
});

const emit = defineEmits<Emit>();

const spinning = ref(true);
const deviceSpinning = ref(false);
const deviceList = ref([]);
const disabledKeys = ref<string[]>([]);
const checkKeys = ref<string[]>([]);
const checkCache = ref<Map<string, any>>(new Map());
const showPage = ref(false);
const pageData = reactive({
    pageSize: 10,
    pageIndex: 0,
    total: 0,
});
const params = ref({
    terms: [],
});
const checkAll = ref(false);
const columns = ref([]);

const queryInkingDevices = (data: string[]) => {
    return new Promise(async (resolve) => {
        if (!data.length) {
            resolve(true);
            return;
        }

        const res = await getInkingDevices(data, props.accessId);
        if (res) {
            disabledKeys.value =
                res.result?.map((item) => item.externalId) || [];
        }

        resolve(true);
    });
};

const getDeviceList = async () => {
    const resp = await getCommandsDevicesByAccessId(props.accessId!, {
        pageIndex: pageData.pageIndex,
        pageSize: pageData.pageSize,
        terms: params.value.terms,
    }).catch(() => ({ success: false }));
    if (resp.success) {
        await queryInkingDevices(
            resp.result?.data.map((item) => item.id) || [],
        );
        deviceList.value = resp.result?.data || [];
        pageData.total = resp.result?.total || 0;
    }
};

const checkChange = (e: any) => {
    // 全选
    if (e.target.checked) {
        const keys = deviceList.value
            .filter((item) => {
                //  过滤已选中和已绑定
                const type =
                    !checkKeys.value.includes(item.id) &&
                    !disabledKeys.value.includes(item.id);
                if (type && !checkCache.value.has(item.id)) {
                    checkCache.value.set(item.id, item);
                }
                return type;
            })
            .map((item) => item.id);
        checkKeys.value = [...checkKeys.value, ...keys];
        emit('update:value', checkKeys.value);
        emit('change', [...checkCache.value.values()]);
    } else {
        const keys = deviceList.value
            .filter((item) => {
                //  过滤已选中和已绑定
                const type =
                    checkKeys.value.includes(item.id) &&
                    !disabledKeys.value.includes(item.id);
                if (type && checkCache.value.has(item.id)) {
                    checkCache.value.delete(item.id);
                }
                return type;
            })
            .map((item) => item.id);
        // const dealCheck = cloneDeep(checkKeys.value);
        const dealCheck = checkKeys.value.filter((item) => {
            return !keys.find((i) => {
                return i === item;
            });
        });
        checkKeys.value = cloneDeep(dealCheck);
        emit('update:value', checkKeys.value);
        emit('change', [...checkCache.value.values()]);
    }
};

const handleSearch = (p: any) => {
    // 查询
    pageData.pageIndex = 0;
    params.value = p;
    getDeviceList();
};

const pageChange = (page: number, pageSize: number) => {
    // 分页变化
    pageData.pageSize = pageSize;
    pageData.pageIndex = page - 1;
    getDeviceList();
};

const init = async () => {
    if (props.accessId) {
        const resp = await getCommandsByAccess(props.accessId);
        if (resp.success && resp.result?.length) {
            // 获取分页查询条件
            const item = resp.result.find(item => item.id === 'QueryDevicePage');
            if (item) {
                showPage.value = true;
                columns.value = item.expands?.terms?.map((t) => ({
                    title: t.name,
                    dataIndex: t.id,
                    search: {
                        type: t.valueType.type,
                    },
                }));
            }
        }
        spinning.value = false;
        await getDeviceList();
    }
};

const deviceClick = (id: string, option: any) => {
    if (option.disabled || disabledKeys.value.includes(id)) return;

    const _check = new Set(checkKeys.value);

    if (props.multiple) {
        // 多选
        if (_check.has(id)) {
            _check.delete(id);
            checkCache.value.delete(id);
        } else {
            checkCache.value.set(id, option);
            _check.add(id);
        }
        checkKeys.value = [..._check.values()];
        emit('update:value', checkKeys.value);
        emit('change', [...checkCache.value.values()]);
    } else {
        checkKeys.value = [id];
        emit('update:value', id);
        emit('change', option);
    }
};

watch(
    () => props.value,
    (newValue) => {
        if (!newValue) {
            checkKeys.value = [];
            return;
        }
        if (isArray(newValue)) {
            checkKeys.value = newValue;
        } else {
            checkKeys.value = [newValue as string];
        }
    },
    { immediate: true, deep: true },
);

watch(
    () => [deviceList.value, checkCache.value],
    () => {
        checkAll.value = !deviceList.value.find((i) => {
            return !checkCache.value.has(i.id);
        });
    },
    {
        deep: true,
    },
);

onMounted(() => {
    init();
});
</script>

<style scoped lang="less">
.inkling-device {
    min-height: 200px;
}

.search-box {
    padding-bottom: 24px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    margin-bottom: 12px;
    gap: 24px;
    align-items: center;

    :deep(.device-inkling) {
        padding: 0;
        margin: 0;
        padding-bottom: 0;
    }

    .search-warp {
        flex: 1 1 auto;
    }

    .multiple {
        width: 60px;
    }
}

.device-list-warp {
  height: 400px;
    .device-list-items {
        .device-list-item {
            padding: 10px 16px;
            color: #4f4f4f;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;

            > .item-title {
                display: flex;
                min-width: 0;
                flex-grow: 1;
                gap: 8px;

                .title-name {
                    max-width: 70%;
                }

                .no-tooltip {
                    overflow: hidden;
                    vertical-align: bottom;
                    cursor: pointer;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    word-break: break-all;
                    max-height: 380px;
                    -webkit-line-clamp: 1;
                    text-overflow: ellipsis;
                }

                .title-id {
                    flex: 1 1 auto;
                    color: #a3a3a3;
                }
            }

            &:hover {
                background-color: rgba(47, 84, 235, 0.06);
            }

            &.active {
                background-color: rgba(153, 153, 153, 0.06);
                color: @primary-color;
                .title-id {
                    color: @primary-color;
                    opacity: 0.8;
                }
            }

            &.disabled {
                cursor: not-allowed;
                background-color: rgba(153, 153, 153, 0.06);
            }
        }
    }

    .device-list-pagination {
        margin-top: 24px;
        text-align: right;
    }
}
</style>
