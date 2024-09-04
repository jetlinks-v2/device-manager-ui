<template>
    <j-page-container>
        <div>
            <pro-search
                :columns="columns"
                target="search-protocol"
                @search="handleSearch"
            />
            <FullPage>
                <j-pro-table
                    ref="tableRef"
                    :columns="columns"
                    :request="list"
                    :defaultParams="{
                        sorts: [{ name: 'createTime', order: 'desc' }],
                    }"
                    :params="params"
                    modeValue="CARD"
                >
                    <template #headerLeftRender>
                        <j-permission-button
                            type="primary"
                            @click="handleAdd"
                            hasPermission="link/Protocol:add"
                        >
                            <template #icon
                                ><AIcon type="PlusOutlined"
                            /></template>
                            新增
                        </j-permission-button>
                    </template>
                    <template #card="slotProps">
                        <CardBox
                            :showStatus="false"
                            :value="slotProps"
                            :actions="getActions(slotProps, 'card')"
                            v-bind="slotProps"
                        >
                            <template #img>
                                <slot name="img">
                                    <img :src="link.protocol" />
                                </slot>
                            </template>
                            <template #content>
                                <div class="card-item-content">
                                    <j-ellipsis style="margin-bottom: 18px">
                                        <span
                                            style="
                                                font-size: 16px;
                                                font-weight: 600;
                                            "
                                        >
                                            {{ slotProps.name }}
                                        </span>
                                    </j-ellipsis>
                                    <a-row class="card-item-content-box">
                                        <a-col
                                            :span="12"
                                            class="card-item-content-text"
                                        >
                                            <div class="card-item-content-text">
                                                ID
                                            </div>
                                            <div class="card-item-content-text">
                                                <a-tooltip>
                                                    <template #title>{{
                                                        slotProps.id
                                                    }}</template>
                                                    {{ slotProps.id }}
                                                </a-tooltip>
                                            </div>
                                        </a-col>
                                        <a-col :span="12">
                                            <div class="card-item-content-text">
                                                类型
                                            </div>
                                            <div class="card-item-content-text">
                                                <a-tooltip>
                                                    <template #title>{{
                                                        slotProps.type
                                                    }}</template>
                                                    {{ slotProps.type }}
                                                </a-tooltip>
                                            </div>
                                        </a-col>
                                    </a-row>
                                </div>
                            </template>
                            <template #actions="item">
                                <j-permission-button
                                    :disabled="item.disabled"
                                    :popConfirm="item.popConfirm"
                                    :tooltip="{
                                        ...item.tooltip,
                                    }"
                                    @click="item.onClick"
                                    :hasPermission="'link/Protocol:' + item.key"
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
                    <template #action="slotProps">
                        <a-space :size="16">
                            <template
                                v-for="i in getActions(slotProps, 'table')"
                                :key="i.key"
                            >
                                <j-permission-button
                                    :disabled="i.disabled"
                                    :popConfirm="i.popConfirm"
                                    :tooltip="{
                                        ...i.tooltip,
                                    }"
                                    style="padding: 0px"
                                    @click="i.onClick"
                                    type="link"
                                    :danger="i.key === 'delete'"
                                    :hasPermission="'link/Protocol:' + i.key"
                                >
                                    <template #icon
                                        ><AIcon :type="i.icon"
                                    /></template>
                                </j-permission-button>
                            </template>
                        </a-space>
                    </template>
                </j-pro-table>
            </FullPage>
        </div>
        <Save v-if="visible" :data="current" @change="saveChange" />
    </j-page-container>
</template>
<script lang="ts" setup name="AccessConfigPage">
import { list, remove } from '../../../api/link/protocol';
import { onlyMessage } from '@jetlinks-web/utils';
import Save from './Save/index.vue';
import { link } from '../../../assets'
import { cloneDeep } from 'lodash-es';

const tableRef = ref<Record<string, any>>({});
const params = ref<Record<string, any>>({});
const route = useRoute();
const visible = ref(false);
const current = ref({});

const columns = [
    {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        search: {
            type: 'string',
            defaultTermType: 'eq',
        },
        width: 200,
        fixed: 'left',
    },
    {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        search: {
            type: 'string',
        },
        ellipsis: true,
    },
    {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        search: {
            type: 'select',
            options: [
                {
                    label: 'jar',
                    value: 'jar',
                },
                {
                    label: 'local',
                    value: 'local',
                },
            ],
        },
        scopedSlots: true,
    },
    {
        title: '说明',
        dataIndex: 'description',
        key: 'description',
        search: {
            type: 'string',
        },
        ellipsis: true,
    },
    {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 100,
        scopedSlots: true,
    },
];

const getActions = (
    data: Partial<Record<string, any>>,
    type: 'card' | 'table',
): any[] => {
    if (!data) return [];
    const actions = [
        {
            key: 'update',
            text: '编辑',
            tooltip: {
                title: '编辑',
            },
            icon: 'EditOutlined',
            onClick: () => {
                handleEdit(data);
            },
        },
        {
            key: 'delete',
            text: '删除',
            tooltip: {
                title: '删除',
            },
            popConfirm: {
                title: '确认删除?',
                onConfirm:  () => {
                    const response: any = remove(data.id);
                    response.then((res)=>{
                        if (res.status === 200) {
                        onlyMessage('操作成功', 'success');
                        tableRef.value.reload();
                    } else {
                        onlyMessage(res?.message, 'error');
                    }
                    })
                    return response
                },
            },
            icon: 'DeleteOutlined',
        },
    ];
    return actions;
};

const handleAdd = () => {
    current.value = {};
    visible.value = true;
};
const handleEdit = (data: object) => {
    current.value = cloneDeep(data);
    visible.value = true;
};

const saveChange = (value: object) => {
    visible.value = false;
    current.value = {};
    if (value) {
        onlyMessage('操作成功', 'success');
        tableRef.value.reload();
    }
};

watch(
    () => route.query?.save,
    (value) => {
        value === 'true' && handleAdd();
    },
    { deep: true, immediate: true },
);

/**
 * 搜索
 * @param params
 */
const handleSearch = (e: any) => {
    params.value = e;
};
</script>
<style lang="less" scoped>
.card-item-content {
    min-height: 100px;

    .card-item-content-box {
        min-height: 50px;
    }
    .card-item-content-text {
        color: rgba(0, 0, 0, 0.75);
        font-size: 12px;
        overflow: hidden; //超出的文本隐藏
        text-overflow: ellipsis; //溢出用省略号显示
        white-space: nowrap; //溢出不换行
    }
}
</style>
